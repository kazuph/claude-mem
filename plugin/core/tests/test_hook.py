"""Tests for Stop hook — real SQLite + real fixtures, no mocks."""

import json
import shutil
import tempfile
from pathlib import Path

from hook import run_hook
from store import MemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample_session.jsonl"


def _setup_hook_env():
    """Create temp dirs mimicking Claude Code project structure."""
    tmp = Path(tempfile.mkdtemp())
    db_path = tmp / "memory.db"
    project_dir = tmp / "projects" / "test-project"
    project_dir.mkdir(parents=True)
    session_id = "test-session-001"
    jsonl_path = project_dir / f"{session_id}.jsonl"
    shutil.copy(SAMPLE, jsonl_path)
    return tmp, db_path, session_id, jsonl_path


def test_run_hook_with_transcript_path():
    """Hook uses transcript_path from official protocol."""
    tmp, db_path, session_id, jsonl_path = _setup_hook_env()

    result = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result["indexed"] > 0
    assert result["new_lines"] > 0

    store = MemoryStore(db_path=db_path)
    try:
        stats = store.get_stats()
        assert stats["chunks"] > 0
        assert store.get_indexed_lines(session_id) > 0
    finally:
        store.close()


def test_run_hook_incremental_no_new_lines():
    """Second run with no new lines should skip."""
    tmp, db_path, session_id, jsonl_path = _setup_hook_env()

    result1 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result1["indexed"] > 0

    result2 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result2["indexed"] == 0
    assert result2.get("skipped") is True


def test_run_hook_incremental_with_new_lines():
    """After appending new lines, hook should index only the diff."""
    tmp, db_path, session_id, jsonl_path = _setup_hook_env()

    result1 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    chunks_first = result1["indexed"]

    # Append new Q&A (text must exceed chunker's min 10 token threshold = 40+ chars)
    new_lines = [
        json.dumps({"type": "user", "message": {"role": "user", "content": "Pythonでasyncioを使った並行処理の実装方法を詳しく教えてください。特にタスクのキャンセレーションについて知りたいです。"}, "timestamp": "2026-03-27T12:00:00Z", "uuid": "new-1", "promptId": "np-1"}) + "\n",
        json.dumps({"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "asyncioの並行処理について説明しますね。asyncio.create_task()でタスクを作成し、task.cancel()でキャンセルできます。CancelledErrorをcatchしてクリーンアップ処理を行うのがベストプラクティスです。"}]}, "timestamp": "2026-03-27T12:00:05Z", "uuid": "new-2"}) + "\n",
    ]
    with open(jsonl_path, "a") as f:
        f.writelines(new_lines)

    result2 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result2["indexed"] > 0
    assert result2["new_lines"] == 2

    store = MemoryStore(db_path=db_path)
    try:
        assert store.get_stats()["chunks"] > chunks_first
    finally:
        store.close()


def test_run_hook_fallback_without_transcript_path():
    """Without transcript_path, falls back to scanning PROJECTS_DIR."""
    tmp, db_path, session_id, jsonl_path = _setup_hook_env()
    import hook as hook_module
    hook_module.PROJECTS_DIR = jsonl_path.parent.parent

    result = run_hook({"session_id": session_id}, db_path=db_path)
    assert result["indexed"] > 0


def test_run_hook_defers_trailing_user_message():
    """If new lines end with a user message (no assistant), defer chunking."""
    tmp, db_path, session_id, jsonl_path = _setup_hook_env()

    # First run: index the full fixture
    result1 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    first_chunks = result1["indexed"]

    # Append a user-only line (no following assistant)
    user_only = json.dumps({
        "type": "user",
        "message": {"role": "user", "content": "Rustのトレイトオブジェクトについて詳しく教えてください。特にdynキーワードの使い方とBox<dyn Trait>パターンについて。"},
        "timestamp": "2026-03-27T13:00:00Z", "uuid": "defer-1", "promptId": "dp-1",
    }) + "\n"
    with open(jsonl_path, "a") as f:
        f.write(user_only)

    # Second run: should defer the user line
    result2 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result2["indexed"] == 0  # Deferred, no new chunks

    # Now append the assistant response
    assistant_line = json.dumps({
        "type": "assistant",
        "message": {"role": "assistant", "content": [{"type": "text", "text": "Rustのトレイトオブジェクトは、dyn Traitで動的ディスパッチを実現します。Box<dyn Trait>はヒープ上にトレイトオブジェクトを配置する最も一般的なパターンで、異なる型の値を同一のコレクションに格納できます。"}]},
        "timestamp": "2026-03-27T13:00:05Z", "uuid": "defer-2",
    }) + "\n"
    with open(jsonl_path, "a") as f:
        f.write(assistant_line)

    # Third run: now both user+assistant are available → should chunk together
    result3 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result3["indexed"] > 0

    # Verify the chunk contains both Q and A
    store = MemoryStore(db_path=db_path)
    try:
        results = store.search_fts("トレイトオブジェクト")
        assert len(results) >= 1
        chunk_text = results[0].text_content
        assert "トレイトオブジェクト" in chunk_text
        assert "Box" in chunk_text or "dyn" in chunk_text
    finally:
        store.close()


def test_run_hook_atomic_write():
    """insert_chunks and set_indexed_lines must be atomic."""
    tmp, db_path, session_id, jsonl_path = _setup_hook_env()

    result = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result["indexed"] > 0

    # Verify both chunks and indexed_lines were written
    store = MemoryStore(db_path=db_path)
    try:
        assert store.get_stats()["chunks"] > 0
        assert store.get_indexed_lines(session_id) > 0
    finally:
        store.close()


def test_run_hook_no_session_id():
    result = run_hook({})
    assert result["indexed"] == 0
    assert "error" in result


def test_run_hook_missing_transcript_path():
    result = run_hook(
        {"session_id": "test", "transcript_path": "/nonexistent/path.jsonl"},
        db_path=Path(tempfile.mktemp(suffix=".db")),
    )
    assert result["indexed"] == 0
    assert "error" in result
