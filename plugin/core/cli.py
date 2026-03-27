"""CLI for claude-mem v2 core.

Commands:
  index <jsonl_path>    Index a single JSONL session file
  backfill [dir]        Scan and index all unprocessed JSONL files
  search <query>        Search memory chunks via FTS5
  stats                 Show database statistics
  serve [--port N]      Start the HTTP API server
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from indexer import index_session, backfill_scan, DEFAULT_PROJECTS_DIR
from store import MemoryStore, DEFAULT_DB_PATH
from ranking import rank_results


def cmd_index(args: argparse.Namespace) -> None:
    """Index a single JSONL file."""
    jsonl_path = Path(args.jsonl_path)
    if not jsonl_path.exists():
        print(f"Error: File not found: {jsonl_path}", file=sys.stderr)
        sys.exit(1)

    count = index_session(jsonl_path, db_path=Path(args.db))
    print(f"Indexed {count} chunks from {jsonl_path.name}")


def cmd_backfill(args: argparse.Namespace) -> None:
    """Scan and index all unprocessed JSONL files."""
    projects_dir = Path(args.projects_dir) if args.projects_dir else DEFAULT_PROJECTS_DIR
    stats = backfill_scan(projects_dir=projects_dir, db_path=Path(args.db))
    print(f"Backfill complete:")
    print(f"  Total files scanned: {stats['total_files']}")
    print(f"  Newly indexed: {stats['indexed']}")
    print(f"  Skipped (already indexed): {stats['skipped']}")
    print(f"  Total chunks created: {stats['chunks_total']}")


def cmd_search(args: argparse.Namespace) -> None:
    """Search memory chunks."""
    store = MemoryStore(db_path=Path(args.db))
    try:
        results = store.search_fts(args.query, limit=args.limit, project_path=args.project)
        ranked = rank_results(results, current_project=args.project)

        if not ranked:
            print("No results found.")
            return

        for i, r in enumerate(ranked, 1):
            print(f"\n--- Result {i} [{r.session_id[:8]}] [{r.project_path}] ---")
            # Show first 300 chars of text
            text = r.text_content[:300]
            if len(r.text_content) > 300:
                text += "..."
            print(text)

        print(f"\n({len(ranked)} results)")
    finally:
        store.close()


def cmd_stats(args: argparse.Namespace) -> None:
    """Show database statistics."""
    store = MemoryStore(db_path=Path(args.db))
    try:
        stats = store.get_stats()
        print(f"Database: {args.db}")
        print(f"Sessions: {stats['sessions']}")
        print(f"Chunks:   {stats['chunks']}")
    finally:
        store.close()


def cmd_serve(args: argparse.Namespace) -> None:
    """Start the HTTP API server."""
    from server import run_server
    print(f"Starting server on port {args.port}...")
    run_server(port=args.port, host=args.host)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="claude-mem v2: JSONL indexer + FTS5 search"
    )
    parser.add_argument(
        "--db", default=str(DEFAULT_DB_PATH),
        help=f"Database path (default: {DEFAULT_DB_PATH})"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Enable verbose logging"
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # index
    p_index = sub.add_parser("index", help="Index a JSONL session file")
    p_index.add_argument("jsonl_path", help="Path to .jsonl file")

    # backfill
    p_backfill = sub.add_parser("backfill", help="Index all unprocessed JSONL files")
    p_backfill.add_argument("projects_dir", nargs="?", help="Projects directory")

    # search
    p_search = sub.add_parser("search", help="Search memory chunks")
    p_search.add_argument("query", help="Search query")
    p_search.add_argument("--limit", type=int, default=10, help="Max results")
    p_search.add_argument("--project", help="Filter by project path")

    # stats
    sub.add_parser("stats", help="Show database statistics")

    # serve
    p_serve = sub.add_parser("serve", help="Start HTTP API server")
    p_serve.add_argument("--port", type=int, default=37778, help="Port (default: 37778)")
    p_serve.add_argument("--host", default="127.0.0.1", help="Host (default: 127.0.0.1)")

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
    else:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    commands = {
        "index": cmd_index,
        "backfill": cmd_backfill,
        "search": cmd_search,
        "stats": cmd_stats,
        "serve": cmd_serve,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
