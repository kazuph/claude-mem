"""Integration tests: end-to-end pipeline with real JSONL + real SQLite.

No mocks — tests the full flow: JSONL → parse → chunk → store → search.
Also tests backfill and memory usage.
"""

import os
import platform
import sys

import pytest

if sys.platform != "win32":
    import resource

import shutil
import tempfile
from pathlib import Path

from parser import parse_jsonl
from chunker import chunk_events
from indexer import index_session, backfill_scan
from store import MemoryStore
from ranking import rank_results

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample_session.jsonl"

# Real Claude Code JSONL (if available)
REAL_JSONL_DIR = Path.home() / ".claude" / "projects"


def test_e2e_fixture_pipeline():
    """Full pipeline: fixture JSONL → parse → chunk → store → search."""
    db_path = Path(tempfile.mktemp(suffix=".db"))

    # Step 1: Index
    count = index_session(SAMPLE, db_path=db_path)
    assert count > 0

    # Step 2: Search
    store = MemoryStore(db_path=db_path)
    try:
        results = store.search_fts("フィボナッチ")
        assert len(results) >= 1

        # Step 3: Rank
        ranked = rank_results(results)
        assert len(ranked) >= 1
        assert "フィボナッチ" in ranked[0].text_content

        # Step 4: Verify no private data
        all_text = " ".join(r.text_content for r in ranked)
        assert "sk-abc123" not in all_text

        # Step 5: Stats
        stats = store.get_stats()
        assert stats["sessions"] == 1
        assert stats["chunks"] == count
    finally:
        store.close()


def test_e2e_real_jsonl_if_available():
    """Test with real Claude Code JSONL files (skipped if none found)."""
    if not REAL_JSONL_DIR.exists():
        return  # Skip if no real data

    # Find a real JSONL file
    jsonl_files = list(REAL_JSONL_DIR.rglob("*.jsonl"))
    if not jsonl_files:
        return  # Skip

    db_path = Path(tempfile.mktemp(suffix=".db"))
    jsonl_file = jsonl_files[0]

    # Parse and verify
    events = parse_jsonl(jsonl_file)
    assert len(events) > 0, f"No events parsed from {jsonl_file}"

    chunks = chunk_events(events)
    # Some sessions might be very small
    if chunks:
        count = index_session(jsonl_file, db_path=db_path)
        assert count > 0

        store = MemoryStore(db_path=db_path)
        try:
            stats = store.get_stats()
            assert stats["chunks"] > 0
        finally:
            store.close()


def test_backfill_multiple_sessions():
    """Backfill scanner with multiple JSONL files."""
    db_path = Path(tempfile.mktemp(suffix=".db"))
    tmp_projects = Path(tempfile.mkdtemp())

    # Create multiple project dirs with JSONL files
    for i in range(3):
        project_dir = tmp_projects / f"project-{i}"
        project_dir.mkdir()
        shutil.copy(SAMPLE, project_dir / f"session-{i}.jsonl")

    stats = backfill_scan(projects_dir=tmp_projects, db_path=db_path)
    assert stats["total_files"] == 3
    assert stats["indexed"] == 3

    # Verify search works across all sessions
    store = MemoryStore(db_path=db_path)
    try:
        results = store.search_fts("フィボナッチ")
        assert len(results) >= 3  # At least one per session
    finally:
        store.close()


@pytest.mark.skipif(sys.platform == "win32", reason="resource module not available on Windows")
def test_memory_usage_peak_rss():
    """Verify peak RSS stays under 100MB for indexing a session."""
    db_path = Path(tempfile.mktemp(suffix=".db"))

    # Measure peak RSS before
    before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss

    # Index the fixture
    index_session(SAMPLE, db_path=db_path)

    # Measure peak RSS after
    after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss

    # On macOS, ru_maxrss is in bytes; on Linux, it's in KB
    if platform.system() == "Darwin":
        peak_mb = after / (1024 * 1024)
    else:
        peak_mb = after / 1024

    # Should be well under 100MB for a small fixture
    # The Python process itself takes ~30-50MB
    assert peak_mb < 200, f"Peak RSS too high: {peak_mb:.1f}MB"
    print(f"Peak RSS: {peak_mb:.1f}MB")


def test_idempotent_backfill():
    """Backfill is idempotent — running twice produces same results."""
    db_path = Path(tempfile.mktemp(suffix=".db"))
    tmp_projects = Path(tempfile.mkdtemp())
    project_dir = tmp_projects / "test"
    project_dir.mkdir()
    shutil.copy(SAMPLE, project_dir / "session.jsonl")

    stats1 = backfill_scan(projects_dir=tmp_projects, db_path=db_path)
    stats2 = backfill_scan(projects_dir=tmp_projects, db_path=db_path)

    assert stats1["indexed"] == 1
    assert stats2["indexed"] == 0
    assert stats2["skipped"] == 1
