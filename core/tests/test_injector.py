"""Tests for UserPromptSubmit injector — real SQLite + real data, no mocks."""

import tempfile
from pathlib import Path

from injector import run_injector
from chunker import Chunk
from store import MemoryStore


def _make_db_with_data() -> Path:
    """Create a temp DB with real test data."""
    db_path = Path(tempfile.mktemp(suffix=".db"))
    store = MemoryStore(db_path=db_path)
    sid = store.insert_session("sess-1", "-Users-test-project-a")
    store.insert_chunks(sid, [
        Chunk(prompt_number=1, chunk_type="qa",
              text="Q: Pythonでasyncioの使い方を教えて\n\nA: asyncio.run()でイベントループを起動し、async/awaitで非同期関数を定義します。"),
        Chunk(prompt_number=2, chunk_type="qa",
              text="Q: SQLiteのFTS5について詳しく教えて\n\nA: FTS5はSQLiteの全文検索拡張で、trigramトークナイザーを使えば日本語にも対応できます。"),
        Chunk(prompt_number=3, chunk_type="qa",
              text="Q: Rustのライフタイムについて教えて\n\nA: ライフタイムは借用チェッカーが参照の有効期間を追跡するための仕組みです。"),
    ])
    store.close()
    return db_path


def test_injector_returns_relevant_context():
    db_path = _make_db_with_data()
    result = run_injector({"prompt": "asyncio イベントループ"}, db_path=db_path)
    assert "claude-mem-context" in result
    assert "asyncio" in result


def test_injector_uses_prompt_field():
    """Official hooks protocol uses 'prompt' not 'query'."""
    db_path = _make_db_with_data()
    # 'prompt' should work
    result = run_injector({"prompt": "FTS5 全文検索"}, db_path=db_path)
    assert "FTS5" in result

    # 'query' should NOT work (old field name)
    result2 = run_injector({"query": "FTS5 全文検索"}, db_path=db_path)
    assert result2 == ""


def test_injector_wraps_in_context_tag():
    """Output must be wrapped in <claude-mem-context> to prevent recursive storage."""
    db_path = _make_db_with_data()
    result = run_injector({"prompt": "asyncio"}, db_path=db_path)
    assert result.startswith("<claude-mem-context>")
    assert result.endswith("</claude-mem-context>")


def test_injector_empty_prompt_returns_nothing():
    db_path = _make_db_with_data()
    assert run_injector({"prompt": ""}, db_path=db_path) == ""
    assert run_injector({}, db_path=db_path) == ""


def test_injector_no_results_returns_empty():
    db_path = _make_db_with_data()
    result = run_injector({"prompt": "量子コンピュータの最新研究"}, db_path=db_path)
    assert result == ""


def test_injector_respects_max_results():
    db_path = _make_db_with_data()
    result = run_injector({"prompt": "プログラミング"}, db_path=db_path, max_results=1)
    # Should have at most 1 "### Memory" header
    assert result.count("### Memory") <= 1
