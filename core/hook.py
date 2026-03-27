"""Stop hook: incremental indexing of Claude Code session transcripts.

Called by Claude Code's Stop hook after each assistant response.
Reads the JSONL session file, indexes only new lines since last run,
and stores chunks in SQLite FTS5.

Official Stop hook stdin JSON fields:
  session_id, transcript_path, cwd, permission_mode, hook_event_name,
  stop_hook_active, last_assistant_message

Usage (settings.json):
  "Stop": [{"command": "uv run --project /path/to/core python -m hook"}]

stdout: Nothing (Stop hook must not pollute stdout; use stderr for logs)
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from parser import parse_jsonl_lines
from chunker import chunk_events
from store import MemoryStore, DEFAULT_DB_PATH

logger = logging.getLogger(__name__)

# Fallback: Claude Code projects directory (used when transcript_path is absent)
PROJECTS_DIR = Path.home() / ".claude" / "projects"


def _find_jsonl_fallback(session_id: str) -> Path | None:
    """Fallback: scan projects dir for JSONL file matching session_id."""
    if not PROJECTS_DIR.exists():
        return None
    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        jsonl_path = project_dir / f"{session_id}.jsonl"
        if jsonl_path.exists():
            return jsonl_path
    return None


def _extract_project_path(jsonl_path: Path) -> str:
    """Extract project path from JSONL file's parent directory name."""
    return jsonl_path.parent.name


def _find_safe_boundary(lines: list[str]) -> int:
    """Find the safe index boundary to avoid Q/A split.

    If the last meaningful event in the new lines is a 'user' message
    (no following assistant), exclude it from this batch so the Q&A
    pair can be chunked together in the next run.

    Returns the number of lines to index (may be less than len(lines)).
    """
    # Walk backwards to find the last user/assistant event
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if not line:
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue
        event_type = raw.get("type", "")
        if event_type == "assistant":
            # Last meaningful event is assistant — safe to index all lines
            return len(lines)
        if event_type == "user":
            # Last meaningful event is user with no following assistant
            # Exclude from this line backwards to the user event
            return i  # index up to (not including) this user line
    # No user/assistant events found — safe to index all (nothing to chunk anyway)
    return len(lines)


def run_hook(input_data: dict, db_path: Path = DEFAULT_DB_PATH) -> dict:
    """Process a Stop hook event: incrementally index new lines.

    Atomicity: insert_chunks + set_indexed_lines happen in a single transaction.
    Q/A boundary: if new lines end with a user message (no assistant yet),
    that user message is deferred to the next run to prevent Q-only chunks.
    """
    session_id = input_data.get("session_id", "")
    transcript_path = input_data.get("transcript_path", "")

    if not session_id:
        return {"indexed": 0, "error": "no session_id"}

    if transcript_path:
        jsonl_path = Path(transcript_path)
        if not jsonl_path.exists():
            return {"indexed": 0, "error": f"transcript_path not found: {transcript_path}"}
    else:
        jsonl_path = _find_jsonl_fallback(session_id)
        if not jsonl_path:
            return {"indexed": 0, "error": f"JSONL not found for {session_id}"}

    store = MemoryStore(db_path=db_path)
    try:
        project_path = _extract_project_path(jsonl_path)
        last_line = store.get_indexed_lines(session_id)

        with open(jsonl_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()

        total_lines = len(all_lines)
        if total_lines <= last_line:
            return {"indexed": 0, "skipped": True, "reason": "no new lines"}

        new_lines = all_lines[last_line:]

        # Find safe Q/A boundary to prevent chunk splitting
        safe_count = _find_safe_boundary(new_lines)
        if safe_count == 0:
            return {"indexed": 0, "new_lines": len(new_lines), "deferred": True}

        indexable_lines = new_lines[:safe_count]
        index_up_to = last_line + safe_count

        events = parse_jsonl_lines(indexable_lines)
        if not events:
            # No meaningful events, but advance the cursor
            store.set_indexed_lines(session_id, index_up_to)
            return {"indexed": 0, "new_lines": len(indexable_lines), "events": 0}

        chunks = chunk_events(events)
        if not chunks:
            store.set_indexed_lines(session_id, index_up_to)
            return {"indexed": 0, "new_lines": len(indexable_lines), "chunks": 0}

        # Ensure session exists
        if not store.is_session_indexed(session_id):
            store.insert_session(session_id, project_path)

        internal_id = store.conn.execute(
            "SELECT id FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()[0]

        # ATOMIC: insert chunks + update indexed_lines in single transaction
        rows = [
            (internal_id, c.prompt_number, c.chunk_type, c.text)
            for c in chunks
        ]
        store.conn.executemany(
            "INSERT INTO memory_chunks (session_id, prompt_number, chunk_type, text_content) "
            "VALUES (?, ?, ?, ?)",
            rows,
        )
        store.conn.execute(
            "INSERT INTO indexed_lines (session_id, last_line_number) VALUES (?, ?) "
            "ON CONFLICT(session_id) DO UPDATE SET last_line_number = ?",
            (session_id, index_up_to, index_up_to),
        )
        store.conn.commit()

        count = len(rows)
        logger.info(f"Hook indexed {count} chunks from {len(indexable_lines)} lines (atomic)")
        return {"indexed": count, "new_lines": len(indexable_lines), "total_lines": total_lines}

    finally:
        store.close()


def main() -> None:
    """Entry point for Stop hook. Logs to stderr only (stdout must stay clean)."""
    logging.basicConfig(
        level=logging.WARNING,
        format="%(levelname)s: %(message)s",
        stream=sys.stderr,
    )

    input_text = sys.stdin.read().strip()
    if input_text:
        try:
            input_data = json.loads(input_text)
        except json.JSONDecodeError:
            input_data = {}
    else:
        input_data = {}

    run_hook(input_data)


if __name__ == "__main__":
    main()
