"""Tests for SQLite FTS5 store — real SQLite, no mocks."""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from chunker import Chunk
from store import MemoryStore


def _make_store() -> MemoryStore:
    """Create a store with a temporary database."""
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    return MemoryStore(db_path=f.name)


def _sample_chunks() -> list[Chunk]:
    return [
        Chunk(prompt_number=1, chunk_type="qa",
              text="Q: Pythonでフィボナッチ数列を書いて\n\nA: 再帰とイテレーティブの方法があります。"),
        Chunk(prompt_number=2, chunk_type="qa",
              text="Q: テストも書いて\n\nA: pytestでテストを書きますね。"),
        Chunk(prompt_number=3, chunk_type="qa",
              text="Q: SQLiteのFTS5について教えて\n\nA: FTS5は全文検索用の仮想テーブルです。"),
    ]


def test_insert_session_and_chunks():
    store = _make_store()
    try:
        sid = store.insert_session("sess-001", "/project/a")
        assert sid > 0
        count = store.insert_chunks(sid, _sample_chunks())
        assert count == 3
    finally:
        store.close()


def test_search_fts_finds_matching_text():
    store = _make_store()
    try:
        sid = store.insert_session("sess-001", "/project/a")
        store.insert_chunks(sid, _sample_chunks())

        results = store.search_fts("フィボナッチ")
        assert len(results) >= 1
        assert "フィボナッチ" in results[0].text_content
    finally:
        store.close()


def test_search_fts_empty_query_returns_empty():
    store = _make_store()
    try:
        sid = store.insert_session("sess-001", "/project/a")
        store.insert_chunks(sid, _sample_chunks())

        assert store.search_fts("") == []
        assert store.search_fts("   ") == []
    finally:
        store.close()


def test_search_fts_with_project_filter():
    store = _make_store()
    try:
        sid_a = store.insert_session("sess-a", "/project/a")
        sid_b = store.insert_session("sess-b", "/project/b")
        store.insert_chunks(sid_a, _sample_chunks())
        store.insert_chunks(sid_b, [
            Chunk(prompt_number=1, chunk_type="qa",
                  text="Q: フィボナッチを別プロジェクトで\n\nA: OK"),
        ])

        results_a = store.search_fts("フィボナッチ", project_path="/project/a")
        results_b = store.search_fts("フィボナッチ", project_path="/project/b")

        assert all(r.project_path == "/project/a" for r in results_a)
        assert all(r.project_path == "/project/b" for r in results_b)
    finally:
        store.close()


def test_get_recent():
    store = _make_store()
    try:
        sid = store.insert_session("sess-001", "/project/a")
        store.insert_chunks(sid, _sample_chunks())

        results = store.get_recent(limit=2)
        assert len(results) == 2
    finally:
        store.close()


def test_get_recent_with_project_filter():
    store = _make_store()
    try:
        sid_a = store.insert_session("sess-a", "/project/a")
        sid_b = store.insert_session("sess-b", "/project/b")
        store.insert_chunks(sid_a, _sample_chunks())
        store.insert_chunks(sid_b, [
            Chunk(prompt_number=1, chunk_type="qa", text="Q: hello\n\nA: world"),
        ])

        results = store.get_recent(limit=10, project_path="/project/b")
        assert len(results) == 1
        assert results[0].project_path == "/project/b"
    finally:
        store.close()


def test_is_session_indexed():
    store = _make_store()
    try:
        assert not store.is_session_indexed("sess-001")
        store.insert_session("sess-001", "/project/a")
        assert store.is_session_indexed("sess-001")
    finally:
        store.close()


def test_get_stats():
    store = _make_store()
    try:
        stats = store.get_stats()
        assert stats["sessions"] == 0
        assert stats["chunks"] == 0

        sid = store.insert_session("sess-001", "/project/a")
        store.insert_chunks(sid, _sample_chunks())

        stats = store.get_stats()
        assert stats["sessions"] == 1
        assert stats["chunks"] == 3
    finally:
        store.close()


def test_duplicate_session_raises():
    store = _make_store()
    try:
        store.insert_session("sess-001", "/project/a")
        with pytest.raises(sqlite3.IntegrityError):
            store.insert_session("sess-001", "/project/a")
    finally:
        store.close()
