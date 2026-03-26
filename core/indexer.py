"""Indexer: JSONL → parse → chunk → store pipeline.

Provides both single-session indexing and batch backfill scanning.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from parser import parse_jsonl
from chunker import chunk_events
from store import MemoryStore, DEFAULT_DB_PATH

logger = logging.getLogger(__name__)

# Default Claude Code projects directory
DEFAULT_PROJECTS_DIR = Path.home() / ".claude" / "projects"


def _extract_session_id(jsonl_path: Path) -> str:
    """Extract session ID from JSONL filename (UUID.jsonl)."""
    return jsonl_path.stem


def _extract_project_path(jsonl_path: Path) -> str:
    """Extract project path from the parent directory name.

    Claude Code stores logs in ~/.claude/projects/<cwd-dashed>/
    The directory name is the CWD with / replaced by -.
    """
    return jsonl_path.parent.name


def index_session(
    jsonl_path: Path,
    store: MemoryStore | None = None,
    db_path: Path = DEFAULT_DB_PATH,
) -> int:
    """Index a single JSONL session file.

    Args:
        jsonl_path: Path to the .jsonl file
        store: Optional existing store instance
        db_path: Database path if store not provided

    Returns:
        Number of chunks indexed (0 if already indexed or empty)
    """
    own_store = store is None
    if own_store:
        store = MemoryStore(db_path=db_path)

    try:
        session_id = _extract_session_id(jsonl_path)
        project_path = _extract_project_path(jsonl_path)

        if store.is_session_indexed(session_id):
            logger.info(f"Session {session_id} already indexed, skipping")
            return 0

        events = parse_jsonl(jsonl_path)
        if not events:
            logger.info(f"Session {session_id} has no events, skipping")
            return 0

        chunks = chunk_events(events)
        if not chunks:
            logger.info(f"Session {session_id} produced no chunks, skipping")
            return 0

        internal_id = store.insert_session(session_id, project_path)
        count = store.insert_chunks(internal_id, chunks)
        logger.info(f"Indexed session {session_id}: {count} chunks")
        return count
    finally:
        if own_store:
            store.close()


def backfill_scan(
    projects_dir: Path = DEFAULT_PROJECTS_DIR,
    db_path: Path = DEFAULT_DB_PATH,
) -> dict:
    """Scan all project directories for unindexed JSONL files.

    Returns:
        Dict with scan results: {total_files, indexed, skipped, chunks_total}
    """
    store = MemoryStore(db_path=db_path)
    stats = {"total_files": 0, "indexed": 0, "skipped": 0, "chunks_total": 0}

    try:
        if not projects_dir.exists():
            logger.warning(f"Projects directory not found: {projects_dir}")
            return stats

        for project_dir in sorted(projects_dir.iterdir()):
            if not project_dir.is_dir():
                continue

            for jsonl_file in sorted(project_dir.glob("*.jsonl")):
                stats["total_files"] += 1
                try:
                    count = index_session(jsonl_file, store=store)
                    if count > 0:
                        stats["indexed"] += 1
                        stats["chunks_total"] += count
                    else:
                        stats["skipped"] += 1
                except Exception as e:
                    logger.error(f"Error indexing {jsonl_file}: {e}")
                    stats["skipped"] += 1

        return stats
    finally:
        store.close()


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python indexer.py <session_id> <jsonl_path>")
        print("  python indexer.py --backfill [projects_dir]")
        sys.exit(1)

    if sys.argv[1] == "--backfill":
        projects_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PROJECTS_DIR
        result = backfill_scan(projects_dir=projects_dir)
        print(f"Backfill complete: {result}")
    else:
        if len(sys.argv) < 3:
            print("Error: need both session_id and jsonl_path")
            sys.exit(1)
        jsonl_path = Path(sys.argv[2])
        count = index_session(jsonl_path)
        print(f"Indexed {count} chunks")
