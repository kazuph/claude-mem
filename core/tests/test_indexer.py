"""Tests for indexer pipeline — real SQLite + real fixtures, no mocks."""

import tempfile
from pathlib import Path

from indexer import index_session, backfill_scan
from store import MemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample_session.jsonl"


def test_index_session_creates_chunks():
    db_path = Path(tempfile.mktemp(suffix=".db"))
    count = index_session(SAMPLE, db_path=db_path)
    assert count > 0

    store = MemoryStore(db_path=db_path)
    try:
        stats = store.get_stats()
        assert stats["sessions"] == 1
        assert stats["chunks"] == count
    finally:
        store.close()


def test_index_session_is_idempotent():
    db_path = Path(tempfile.mktemp(suffix=".db"))
    count1 = index_session(SAMPLE, db_path=db_path)
    assert count1 > 0

    count2 = index_session(SAMPLE, db_path=db_path)
    assert count2 == 0  # Already indexed


def test_index_session_chunks_are_searchable():
    db_path = Path(tempfile.mktemp(suffix=".db"))
    index_session(SAMPLE, db_path=db_path)

    store = MemoryStore(db_path=db_path)
    try:
        results = store.search_fts("フィボナッチ")
        assert len(results) >= 1
    finally:
        store.close()


def test_backfill_scan_with_fixture_dir():
    """Test backfill by creating a mock project structure with real files."""
    db_path = Path(tempfile.mktemp(suffix=".db"))
    # Create a temp project dir structure
    tmp_projects = Path(tempfile.mkdtemp())
    project_dir = tmp_projects / "test-project"
    project_dir.mkdir()

    # Copy fixture file into the temp project dir
    import shutil
    shutil.copy(SAMPLE, project_dir / "test-session.jsonl")

    stats = backfill_scan(projects_dir=tmp_projects, db_path=db_path)
    assert stats["total_files"] == 1
    assert stats["indexed"] == 1
    assert stats["chunks_total"] > 0

    # Run again - should skip
    stats2 = backfill_scan(projects_dir=tmp_projects, db_path=db_path)
    assert stats2["skipped"] == 1
    assert stats2["indexed"] == 0
