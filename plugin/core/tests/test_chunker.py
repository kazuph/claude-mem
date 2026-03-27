"""Tests for chunker — uses real fixture data parsed by real parser, no mocks."""

from pathlib import Path

from parser import parse_jsonl
from chunker import chunk_events, Chunk, _estimate_tokens, MAX_CHUNK_TOKENS

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample_session.jsonl"


def test_chunk_events_produces_chunks():
    events = parse_jsonl(SAMPLE)
    chunks = chunk_events(events)
    assert len(chunks) > 0


def test_chunks_have_qa_format():
    events = parse_jsonl(SAMPLE)
    chunks = chunk_events(events)
    qa_chunks = [c for c in chunks if c.chunk_type == "qa"]
    assert len(qa_chunks) >= 2
    # First chunk should start with Q:
    assert qa_chunks[0].text.startswith("Q:")


def test_chunks_are_text_only_sui_memory_style():
    """sui-memory style: chunks contain only user text + assistant text blocks."""
    events = parse_jsonl(SAMPLE)
    chunks = chunk_events(events)
    first_chunk = chunks[0]
    # Should contain the assistant text response, no tool results
    assert "フィボナッチ" in first_chunk.text
    assert first_chunk.text.startswith("Q:")


def test_prompt_numbers_increment():
    events = parse_jsonl(SAMPLE)
    chunks = chunk_events(events)
    numbers = [c.prompt_number for c in chunks]
    # Prompt numbers should be monotonically non-decreasing
    for i in range(1, len(numbers)):
        assert numbers[i] >= numbers[i - 1]


def test_private_content_not_in_chunks():
    events = parse_jsonl(SAMPLE)
    chunks = chunk_events(events)
    all_text = " ".join(c.text for c in chunks)
    assert "sk-abc123" not in all_text


def test_chunks_respect_max_tokens():
    events = parse_jsonl(SAMPLE)
    chunks = chunk_events(events)
    for chunk in chunks:
        assert chunk.estimated_tokens <= MAX_CHUNK_TOKENS * 1.5, (
            f"Chunk too large: {chunk.estimated_tokens} tokens"
        )


def test_estimate_tokens():
    assert _estimate_tokens("a" * 400) == 100
    assert _estimate_tokens("") == 0
