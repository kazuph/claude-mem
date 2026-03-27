"""Tests for JSONL parser — uses real fixture data, no mocks."""

from pathlib import Path

from parser import ParsedEvent, parse_jsonl, strip_noise

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample_session.jsonl"


def test_parse_returns_events():
    events = parse_jsonl(SAMPLE)
    assert len(events) > 0


def test_skips_system_and_queue_events():
    events = parse_jsonl(SAMPLE)
    types = {e.type for e in events}
    assert "system" not in types
    assert "queue-operation" not in types
    assert "file-history-snapshot" not in types


def test_extracts_user_events():
    events = parse_jsonl(SAMPLE)
    user_events = [e for e in events if e.type == "user"]
    # 7 user messages in fixture, all should be extracted
    assert len(user_events) == 7
    assert "フィボナッチ" in user_events[0].text


def test_extracts_assistant_events():
    events = parse_jsonl(SAMPLE)
    assistant_events = [e for e in events if e.type == "assistant"]
    assert len(assistant_events) >= 4


def test_skips_tool_results_sui_memory_style():
    """sui-memory style: tool_result/progress events are excluded entirely."""
    events = parse_jsonl(SAMPLE)
    tool_events = [e for e in events if e.type == "tool_result"]
    assert len(tool_events) == 0
    types = {e.type for e in events}
    assert types == {"user", "assistant"}


def test_strips_private_tags():
    events = parse_jsonl(SAMPLE)
    user_events = [e for e in events if e.type == "user"]
    api_user = user_events[2]  # Third user msg has <private> tag
    assert "sk-abc123" not in api_user.text
    assert "APIを呼んで" in api_user.text


def test_strips_system_reminder_noise():
    """system-reminder tags injected by hooks should be removed."""
    events = parse_jsonl(SAMPLE)
    user_events = [e for e in events if e.type == "user"]
    # u-4: has <system-reminder> wrapping hook context
    dotenvx_user = [e for e in user_events if "dotenvx" in e.text]
    assert len(dotenvx_user) == 1
    assert "system-reminder" not in dotenvx_user[0].text
    assert "reviw-plugin" not in dotenvx_user[0].text
    assert "dotenvx" in dotenvx_user[0].text


def test_strips_task_notification_noise():
    """task-notification tags should be removed."""
    events = parse_jsonl(SAMPLE)
    user_events = [e for e in events if e.type == "user"]
    linear_user = [e for e in user_events if "Linear" in e.text]
    assert len(linear_user) == 1
    assert "task-notification" not in linear_user[0].text
    assert "task-id" not in linear_user[0].text
    assert "Linear" in linear_user[0].text


def test_strips_skill_template_noise():
    """Skill template blocks ('Base directory for this skill:') should be removed."""
    events = parse_jsonl(SAMPLE)
    user_events = [e for e in events if e.type == "user"]
    worktree_user = [e for e in user_events if "worktree" in e.text.lower()]
    assert len(worktree_user) == 1
    assert "Base directory" not in worktree_user[0].text
    assert "部長モード" not in worktree_user[0].text
    assert "worktree" in worktree_user[0].text.lower()


def test_strips_observed_session_noise():
    """observed_from_primary_session wrappers should be removed."""
    events = parse_jsonl(SAMPLE)
    user_events = [e for e in events if e.type == "user"]
    review_user = [e for e in user_events if "レビュー" in e.text]
    assert len(review_user) == 1
    assert "observed_from_primary_session" not in review_user[0].text
    assert "レビュー" in review_user[0].text


def test_strip_noise_function():
    """Direct test of strip_noise with various noise patterns."""
    # system-reminder
    text = "hello <system-reminder>noise here</system-reminder> world"
    assert strip_noise(text) == "hello  world"

    # task-notification
    text2 = "before <task-notification>task stuff</task-notification> after"
    assert strip_noise(text2) == "before  after"

    # observed_from_primary_session
    text3 = "x <observed_from_primary_session>obs</observed_from_primary_session> y"
    assert strip_noise(text3) == "x  y"

    # skill template
    text4 = "Base directory for this skill: /path\n\n# Skill Title\n\nDo stuff here.\n- bullet\n\nActual question"
    result = strip_noise(text4)
    assert "Base directory" not in result
    assert "Skill Title" not in result
    assert "Actual question" in result

    # private + claude-mem-context (still works)
    text5 = "<private>secret</private> ok <claude-mem-context>meta</claude-mem-context>"
    assert strip_noise(text5) == "ok"


def test_timestamps_present():
    events = parse_jsonl(SAMPLE)
    for event in events:
        assert event.timestamp, f"Missing timestamp on {event.type} event"


def test_all_noise_excluded_from_chunks():
    """No noise artifacts should appear in any parsed event text."""
    events = parse_jsonl(SAMPLE)
    noise_markers = [
        "<system-reminder>", "</system-reminder>",
        "<task-notification>", "</task-notification>",
        "<observed_from_primary_session>",
        "Base directory for this skill:",
        "<private>", "<claude-mem-context>",
    ]
    for event in events:
        for marker in noise_markers:
            assert marker not in event.text, (
                f"Noise marker '{marker}' found in {event.type} event: {event.text[:100]}"
            )
