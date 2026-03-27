"""JSONL parser for Claude Code session logs.

Reads ~/.claude/projects/<cwd-dashed>/<sessionId>.jsonl and extracts
structured events (user prompts, assistant responses, tool usage).

Noise filtering: removes system-reminder, task-notification, skill templates,
observed_from_primary_session wrappers, and privacy tags.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Known noise XML tag names. Uses backreference to match opening/closing pairs.
_NOISE_TAG_NAMES = (
    "system-reminder|private|claude-mem-context|task-notification|"
    "observed_from_primary_session|observation|user_request|assistant_response|"
    "tool-use-id|task-id|output-file|status|summary|persisted-output|"
    "observed_tool_use|tool_name|tool_input|tool_output|"
    r"functions|function|antml:[\w-]+"
)
# Match <tag>...</tag> pairs using backreference (\1) for correct pairing
NOISE_XML_TAGS = re.compile(
    rf"<({_NOISE_TAG_NAMES})>.*?</\1>",
    re.DOTALL,
)

# Lines containing bucho/tmux noise patterns
BUCHO_TMUX_LINE_RE = re.compile(r"^.*(?:tmux send-keys|あなたは\*\*部長\*\*です|メモリ処理継続中).*$", re.MULTILINE)

# claude-mem observation agent boilerplate prompts
# These are the full system prompts injected into memory agent sessions
OBSERVATION_BOILERPLATE_MARKERS = [
    "メモリエージェント",  # Japanese memory agent prompt
    "memory agent",  # English memory agent prompt
    "プライマリのClaudeセッションの観察",  # "observing primary Claude session"
    "observed_from_primary_session",  # XML tag mention in text
]

# Skill template blocks: from "Base directory for this skill:" line
# through the skill body (markdown content) to the last line before
# the user's actual message. The user's message typically follows after
# two consecutive newlines at the end of the skill block.
# Strategy: match from "Base directory" to the last markdown-like line
# before a short user question (heuristic: lines starting with # or
# containing skill-like patterns)
def _strip_skill_template(text: str) -> str:
    """Remove skill template blocks injected at the start of user messages.

    Strategy: find the skill block boundary by scanning forward from
    'Base directory for this skill:'. Skill blocks contain markdown
    headers, bullets, code blocks, etc. The first blank line followed by
    non-markdown content marks the transition to user message.
    We keep ALL lines after the transition (preserving multi-line user messages).
    """
    marker = "Base directory for this skill:"
    if marker not in text:
        return text
    idx = text.index(marker)
    before = text[:idx]
    after_marker = text[idx:]
    lines = after_marker.split("\n")

    # Scan forward: skip the skill template content
    # Skill content = markdown-formatted lines (headers, bullets, code, tables, directives)
    # User content starts after a blank line where the following lines are NOT markdown
    in_code_block = False
    skill_end = len(lines)  # default: everything is skill

    for i, raw_line in enumerate(lines):
        line = raw_line.strip()

        # Track code blocks
        if line.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        # Blank line = potential boundary
        if not line and i > 2:
            # Look at the next non-blank line
            for j in range(i + 1, len(lines)):
                next_line = lines[j].strip()
                if not next_line:
                    continue
                # If next line is NOT markdown formatting, it's user content
                is_markdown = (
                    next_line.startswith("#") or
                    next_line.startswith("-") or
                    next_line.startswith("*") or
                    next_line.startswith(">") or
                    next_line.startswith("`") or
                    next_line.startswith("|") or
                    next_line.startswith("---")
                )
                if not is_markdown:
                    skill_end = j
                    break
                break  # next non-blank line is still markdown, continue scanning

        if skill_end < len(lines):
            break

    # Keep ALL lines from skill_end onwards (preserving multi-line user messages)
    user_lines = lines[skill_end:]
    return (before + "\n".join(user_lines)).strip()

# Event types we care about
SKIP_TYPES = frozenset({"system", "queue-operation", "file-history-snapshot"})


@dataclass
class ParsedEvent:
    """A single parsed event from the JSONL log."""

    type: str  # "user", "assistant" (sui-memory style: text blocks only)
    text: str
    timestamp: str = ""
    tool_name: str = ""
    prompt_id: str = ""


def strip_noise(text: str) -> str:
    """Remove all noise from text: XML meta tags, skill templates, bucho/tmux patterns."""
    # Remove all known XML noise tags in one pass
    text = NOISE_XML_TAGS.sub("", text)
    # Remove bucho/tmux noise lines
    text = BUCHO_TMUX_LINE_RE.sub("", text)
    # Skill template blocks
    text = _strip_skill_template(text)
    # Clean up excessive whitespace from removals
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# Keep backward compat alias
strip_privacy_tags = strip_noise


def _extract_text_from_content(content: Any) -> str:
    """Extract text from message content (string or content blocks).

    sui-memory style: only type=text blocks are extracted.
    thinking, tool_use, tool_result blocks are excluded from assistant content.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return str(content)[:500] if content else ""


def _parse_line(raw_line: str) -> ParsedEvent | None:
    """Parse a single JSONL line into a ParsedEvent, or None if filtered."""
    raw_line = raw_line.strip()
    if not raw_line:
        return None
    try:
        raw = json.loads(raw_line)
    except json.JSONDecodeError:
        return None

    event_type = raw.get("type", "")

    if event_type in SKIP_TYPES or event_type == "progress":
        return None

    if event_type not in ("user", "assistant"):
        return None

    msg = raw.get("message", {})
    content = msg.get("content", "")
    text = _extract_text_from_content(content)
    text = strip_noise(text)

    if not text.strip():
        return None

    if any(marker in text for marker in OBSERVATION_BOILERPLATE_MARKERS):
        return None

    return ParsedEvent(
        type=event_type,
        text=text,
        timestamp=raw.get("timestamp", ""),
        prompt_id=raw.get("promptId", ""),
    )


def parse_jsonl(path: Path) -> list[ParsedEvent]:
    """Parse a Claude Code JSONL session log into structured events."""
    with open(path, "r", encoding="utf-8") as f:
        return parse_jsonl_lines(f.readlines())


def parse_jsonl_lines(lines: list[str]) -> list[ParsedEvent]:
    """Parse a list of JSONL lines into structured events.

    Used by hook.py for incremental (diff-only) parsing.
    """
    events: list[ParsedEvent] = []
    for line in lines:
        event = _parse_line(line)
        if event is not None:
            events.append(event)
    return events
