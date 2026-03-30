"""UserPromptSubmit hook: inject relevant memory context into Claude's prompt.

Called by Claude Code's UserPromptSubmit hook before each assistant response.
Searches FTS5 for chunks relevant to the user's prompt, ranks them with
time decay, and outputs formatted context to stdout.

Also records injected chunk IDs to ~/.claude-mem/last_injected.json
for the Stop hook to perform implicit voting.

Official UserPromptSubmit hook stdin JSON fields:
  session_id, transcript_path, cwd, permission_mode, hook_event_name, prompt

stdout: Formatted context text (added to Claude's context by hook protocol)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from store import MemoryStore, DEFAULT_DB_PATH
from ranking import rank_results

MAX_RESULTS = 5
MAX_CHUNK_CHARS = 600

INJECTED_DIR = Path.home() / ".claude-mem"


def _injected_path(session_id: str) -> Path:
    """Per-session injected file: last_injected_{session_id}.json"""
    safe_id = session_id.replace("/", "_").replace("\\", "_")
    return INJECTED_DIR / f"last_injected_{safe_id}.json"


def _truncate(text: str, max_chars: int = MAX_CHUNK_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


def _save_injected(session_id: str, chunk_ids: list[int]) -> None:
    """Record injected chunk IDs for the Stop hook's implicit voting."""
    INJECTED_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "session_id": session_id,
        "chunk_ids": chunk_ids,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _injected_path(session_id).write_text(json.dumps(data), encoding="utf-8")


def run_injector(
    input_data: dict,
    db_path: Path = DEFAULT_DB_PATH,
    max_results: int = MAX_RESULTS,
) -> str:
    """Search for relevant memory and format as context string."""
    query = input_data.get("prompt", "")
    if not query:
        return ""

    # Extract meaningful keywords from prompt for better FTS5 search
    # Full prompt text often has too many common words; extract terms >= 3 chars
    # that aren't pure stopwords
    _stopwords = {
        "the", "and", "for", "that", "this", "with", "from", "are", "was", "were",
        "been", "have", "has", "had", "but", "not", "you", "all", "can", "her",
        "his", "one", "our", "out", "also", "about", "into", "just", "than",
        "them", "then", "some", "what", "when", "who", "how", "its", "may",
        "する", "ある", "いる", "なる", "れる", "できる", "ない", "この", "その",
        "これ", "それ", "です", "ます", "した", "して", "から", "まで", "ため",
        "こと", "もの", "ところ", "よう", "ほう",
    }
    words = query[:500].split()
    keywords = [w for w in words if len(w) >= 3 and w.lower() not in _stopwords]
    if not keywords:
        # Fallback: use first 200 chars as-is
        search_query = query[:200].strip()
    else:
        # Use top keywords (limit to avoid overly long query)
        search_query = " ".join(keywords[:15])
    if not search_query:
        return ""

    session_id = input_data.get("session_id", "")
    cwd = input_data.get("cwd", "")
    project_path = None
    if cwd:
        project_path = cwd.replace("\\", "/").replace("/", "-").lstrip("-")

    store = MemoryStore(db_path=db_path)
    try:
        results = store.search_fts(search_query, limit=max_results * 2)
        if not results:
            return ""

        ranked = rank_results(results, current_project=project_path)
        top = ranked[:max_results]

        if not top:
            return ""

        # Record injected chunk IDs for implicit voting
        chunk_ids = [r.chunk_id for r in top]
        if session_id:
            _save_injected(session_id, chunk_ids)

        lines: list[str] = []
        lines.append("<claude-mem-context>")
        lines.append("## Relevant memories from past sessions:")
        lines.append("")

        for i, r in enumerate(top, 1):
            lines.append(f"### Memory {i} [{r.project_path}]")
            lines.append(_truncate(r.text_content))
            lines.append("")

        lines.append("</claude-mem-context>")
        return "\n".join(lines)

    finally:
        store.close()


def main() -> None:
    input_text = sys.stdin.read().strip()
    if input_text:
        try:
            input_data = json.loads(input_text)
        except json.JSONDecodeError:
            input_data = {}
    else:
        input_data = {}

    context = run_injector(input_data)
    if context:
        print(context)


if __name__ == "__main__":
    main()
