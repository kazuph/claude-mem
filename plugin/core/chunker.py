"""Chunker: splits parsed events into Q&A chunks for indexing.

Groups user prompts with their corresponding assistant responses and tool
results into coherent chunks suitable for FTS5 indexing.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from parser import ParsedEvent

# Token estimation: ~4 chars per token (conservative for mixed EN/JP)
CHARS_PER_TOKEN = 4
MIN_CHUNK_TOKENS = 150
MAX_CHUNK_TOKENS = 800
TARGET_CHUNK_TOKENS = 400


@dataclass
class Chunk:
    """A Q&A chunk ready for storage."""

    prompt_number: int
    chunk_type: str  # "qa", "tool_context"
    text: str
    timestamp: str = ""

    @property
    def estimated_tokens(self) -> int:
        return len(self.text) // CHARS_PER_TOKEN


def _estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def _split_large_text(text: str, max_tokens: int = MAX_CHUNK_TOKENS) -> list[str]:
    """Split text that exceeds max_tokens into smaller pieces at line boundaries."""
    max_chars = max_tokens * CHARS_PER_TOKEN
    if len(text) <= max_chars:
        return [text]

    parts: list[str] = []
    lines = text.split("\n")
    current: list[str] = []
    current_len = 0

    for line in lines:
        line_len = len(line) + 1  # +1 for newline
        if current_len + line_len > max_chars and current:
            parts.append("\n".join(current))
            current = []
            current_len = 0
        current.append(line)
        current_len += line_len

    if current:
        parts.append("\n".join(current))

    return parts


def chunk_events(events: list[ParsedEvent]) -> list[Chunk]:
    """Group parsed events into Q&A chunks.

    Strategy:
    - Each user message starts a new prompt group
    - Assistant responses and tool results are merged into that group
    - Large tool outputs are split into separate chunks
    """
    chunks: list[Chunk] = []
    prompt_number = 0

    # State for current group
    current_user: str | None = None
    current_parts: list[str] = []
    current_timestamp: str = ""

    def flush_group() -> None:
        nonlocal current_user, current_parts, current_timestamp
        if current_user is None:
            return

        # Build the Q&A text
        qa_text = f"Q: {current_user}\n\nA: " + "\n".join(current_parts)
        qa_text = qa_text.strip()

        if not qa_text or _estimate_tokens(qa_text) < 10:
            current_user = None
            current_parts = []
            return

        # Split if too large
        if _estimate_tokens(qa_text) > MAX_CHUNK_TOKENS:
            # Keep the Q part with first portion of A
            q_part = f"Q: {current_user}\n\nA: "
            a_text = "\n".join(current_parts)
            sub_parts = _split_large_text(a_text)

            for i, part in enumerate(sub_parts):
                text = f"{q_part}{part}" if i == 0 else f"(cont.) {part}"
                chunks.append(Chunk(
                    prompt_number=prompt_number,
                    chunk_type="qa",
                    text=text,
                    timestamp=current_timestamp,
                ))
        else:
            chunks.append(Chunk(
                prompt_number=prompt_number,
                chunk_type="qa",
                text=qa_text,
                timestamp=current_timestamp,
            ))

        current_user = None
        current_parts = []

    for event in events:
        if event.type == "user":
            # sui-memory style: consecutive users overwrite previous (no flush)
            if current_user is not None and current_parts:
                flush_group()
            prompt_number += 1
            current_user = event.text
            current_timestamp = event.timestamp
            current_parts = []

        elif event.type == "assistant":
            if current_user is not None:
                current_parts.append(event.text)
            else:
                # Orphan assistant message — treat as standalone
                prompt_number += 1
                text = f"A: {event.text}"
                if _estimate_tokens(text) >= 10:
                    chunks.append(Chunk(
                        prompt_number=prompt_number,
                        chunk_type="qa",
                        text=text,
                        timestamp=event.timestamp,
                    ))

        # sui-memory style: tool_result events are not included in chunks

    # Flush last group
    flush_group()

    return chunks
