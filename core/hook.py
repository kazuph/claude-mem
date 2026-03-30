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

import re

from parser import parse_jsonl_lines
from chunker import chunk_events
from store import MemoryStore, DEFAULT_DB_PATH

logger = logging.getLogger(__name__)

PROJECTS_DIR = Path.home() / ".claude" / "projects"
INJECTED_DIR = Path.home() / ".claude-mem"

import unicodedata

# Keyword extraction patterns (3 systems)
# 1. File paths/names: foo.py, src/hooks/hook.ts, package.json
FILE_PATH_RE = re.compile(r"[\w./\\-]+\.(?:py|ts|js|json|toml|yaml|yml|md|sql|sh|css|html|tsx|jsx|go|rs|rb)\b")
# 2. Technical identifiers: CamelCase, snake_case, kebab-case, dotted names
IDENT_RE = re.compile(r"[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)+")  # dotted/snake/kebab
CAMEL_RE = re.compile(r"[A-Z][a-z]+(?:[A-Z][a-z]+)+")  # CamelCase
WORD_RE = re.compile(r"[A-Za-z_]\w{2,}", re.UNICODE)  # plain words 3+ chars
# 3. Japanese: kanji+kana blocks
JP_RE = re.compile(r"[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{2,}")

# Stopwords (common words that don't help identify relevant chunks)
STOPWORDS = frozenset({
    # Japanese
    "する", "ある", "いる", "こと", "もの", "ため", "これ", "それ", "あれ",
    "この", "その", "から", "まで", "ここ", "そこ", "どこ", "なに", "なぜ",
    "です", "ます", "した", "して", "される", "できる", "なる", "れる",
    "という", "について", "として",
    # English
    "the", "and", "for", "that", "this", "with", "from", "have", "has",
    "are", "was", "were", "been", "being", "not", "but", "can", "will",
    "use", "used", "using", "get", "set", "new", "add", "run", "fix",
    "let", "var", "true", "false", "none", "null", "undefined",
})


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


def _extract_keywords(text: str) -> set[str]:
    """Extract significant keywords from text using 3 systems.

    1. File paths/names (highest signal)
    2. Technical identifiers (CamelCase, snake_case, dotted)
    3. Japanese kanji/kana blocks

    All normalized with NFKC + casefold. Stopwords excluded.
    """
    keywords: set[str] = set()

    # Normalize
    normalized = unicodedata.normalize("NFKC", text)

    # 1. File paths (keep as-is, very high signal)
    for m in FILE_PATH_RE.findall(normalized):
        keywords.add(m.casefold())

    # 2. Technical identifiers
    for m in IDENT_RE.findall(normalized):
        keywords.add(m.casefold())
    for m in CAMEL_RE.findall(normalized):
        keywords.add(m.casefold())
    for m in WORD_RE.findall(normalized):
        w = m.casefold()
        if len(w) >= 3 and w not in STOPWORDS and not w.isdigit():
            keywords.add(w)

    # 3. Japanese blocks (3-4 grams from kanji/kana sequences, 3+ chars only)
    for block in JP_RE.findall(normalized):
        if block in STOPWORDS:
            continue
        # Full block (3+ chars)
        if len(block) >= 3:
            keywords.add(block)
        # Extract 3-4 grams for longer blocks
        if len(block) > 4:
            for n in range(3, 5):
                for i in range(len(block) - n + 1):
                    gram = block[i:i+n]
                    if gram not in STOPWORDS:
                        keywords.add(gram)

    return keywords


def _get_last_assistant_text(jsonl_path: Path) -> str:
    """Get the text of the last assistant message from the JSONL file."""
    last_text = ""
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            if raw.get("type") != "assistant":
                continue
            msg = raw.get("message", {})
            content = msg.get("content", "")
            if isinstance(content, str):
                last_text = content
            elif isinstance(content, list):
                parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
                if parts:
                    last_text = "\n".join(parts)
    return last_text


# Vote thresholds: require meaningful overlap, not single-word matches
VOTE_MIN_OVERLAP = 3        # Minimum keyword overlap count
VOTE_MIN_RATIO = 0.15       # Minimum overlap/total ratio (15%)


def _extract_answer_keywords(text: str) -> set[str]:
    """Extract keywords from the Answer part of a Q&A chunk only."""
    # Split Q/A and use only the A portion
    import re as _re
    match = _re.search(r"\nA:\s*", text)
    if match:
        answer_part = text[match.end():]
    else:
        answer_part = text  # If no Q/A split, use entire text
    return _extract_keywords(answer_part)


def _injected_path_for(session_id: str) -> Path:
    """Get the per-session injected file path."""
    safe_id = session_id.replace("/", "_").replace("\\", "_")
    return INJECTED_DIR / f"last_injected_{safe_id}.json"


def run_implicit_vote(
    input_data: dict,
    db_path: Path = DEFAULT_DB_PATH,
) -> dict:
    """Perform implicit voting with threshold-based matching.

    Reads per-session last_injected_{session_id}.json,
    extracts A-part keywords from each injected chunk,
    votes if overlap >= 3 or overlap/total >= 15%.
    """
    session_id = input_data.get("session_id", "")
    transcript_path = input_data.get("transcript_path", "")

    if not session_id:
        return {"voted": 0, "reason": "no session_id"}

    injected_file = _injected_path_for(session_id)
    if not injected_file.exists():
        return {"voted": 0, "reason": "no injected file for session"}

    try:
        injected = json.loads(injected_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"voted": 0, "reason": "failed to read injected file"}

    # Verify session_id matches
    if injected.get("session_id") != session_id:
        return {"voted": 0, "reason": "session_id mismatch"}

    chunk_ids = injected.get("chunk_ids", [])
    if not chunk_ids:
        return {"voted": 0, "reason": "no injected chunks"}

    # Get last assistant response text
    if transcript_path and Path(transcript_path).exists():
        assistant_text = _get_last_assistant_text(Path(transcript_path))
    else:
        assistant_text = input_data.get("last_assistant_message", "")

    if not assistant_text:
        return {"voted": 0, "reason": "no assistant text"}

    assistant_keywords = _extract_keywords(assistant_text)
    if not assistant_keywords:
        return {"voted": 0, "reason": "no keywords in assistant response"}

    store = MemoryStore(db_path=db_path)
    voted = 0
    try:
        for cid in chunk_ids:
            chunk = store.get_chunk(cid)
            if not chunk:
                continue
            # Use A-part keywords only (more relevant for comparing with assistant output)
            chunk_keywords = _extract_answer_keywords(chunk.text_content)
            if not chunk_keywords:
                continue

            overlap = chunk_keywords & assistant_keywords
            overlap_count = len(overlap)
            overlap_ratio = overlap_count / len(chunk_keywords) if chunk_keywords else 0

            # Threshold: overlap >= 3 OR overlap ratio >= 15%
            if overlap_count >= VOTE_MIN_OVERLAP or overlap_ratio >= VOTE_MIN_RATIO:
                store.increment_vote(cid)
                voted += 1
                logger.info(f"Voted for chunk {cid}: {overlap_count} overlaps ({overlap_ratio:.0%})")
    finally:
        store.close()

    # Clean up per-session injected file
    try:
        injected_file.unlink(missing_ok=True)
    except OSError:
        pass

    return {"voted": voted, "total_injected": len(chunk_ids)}


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

    # Implicit voting: upvote chunks whose keywords were used by the assistant
    try:
        run_implicit_vote(input_data)
    except Exception as e:
        logger.warning(f"Implicit vote failed: {e}")


if __name__ == "__main__":
    main()
