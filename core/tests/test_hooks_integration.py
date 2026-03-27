"""Integration test: hook.py → injector.py end-to-end pipeline.

Creates a JSONL file → runs Stop hook to index → runs injector to search.
Real SQLite, real parsing, no mocks.
"""

import json
import tempfile
from pathlib import Path

from hook import run_hook
from injector import run_injector
from store import MemoryStore


def _create_test_jsonl(path: Path) -> None:
    """Write a realistic JSONL session file."""
    events = [
        {"type": "user", "message": {"role": "user", "content": "Cloudflare WorkersでD1データベースを使う方法を教えてください。Wranglerの設定方法とバインディングについて詳しく知りたいです。"}, "timestamp": "2026-03-27T10:00:00Z", "uuid": "u-1", "promptId": "p-1"},
        {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "Cloudflare WorkersでD1を使うには、まずwrangler.tomlにD1バインディングを設定します。[[d1_databases]]セクションにbinding, database_name, database_idを記載します。Workers内ではenv.DBでアクセスでき、D1はSQLite互換なのでSQLクエリがそのまま使えます。"}]}, "timestamp": "2026-03-27T10:00:10Z", "uuid": "a-1"},
        {"type": "user", "message": {"role": "user", "content": "TypeScriptの型定義はどうすれば良いですか？Env interfaceの書き方を教えて。"}, "timestamp": "2026-03-27T10:01:00Z", "uuid": "u-2", "promptId": "p-2"},
        {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "Env interfaceにD1Databaseを追加します。interface Env { DB: D1Database; } これでenv.DBの型が効きます。クエリはenv.DB.prepare('SELECT * FROM users').all()のように使います。"}]}, "timestamp": "2026-03-27T10:01:10Z", "uuid": "a-2"},
    ]
    with open(path, "w") as f:
        for event in events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")


def test_hook_then_injector_e2e():
    """Full pipeline: create JSONL → hook indexes it → injector finds it."""
    tmp = Path(tempfile.mkdtemp())
    db_path = tmp / "memory.db"
    project_dir = tmp / "projects" / "test-project"
    project_dir.mkdir(parents=True)
    session_id = "e2e-test-session"
    jsonl_path = project_dir / f"{session_id}.jsonl"

    # Create test JSONL
    _create_test_jsonl(jsonl_path)

    # Run Stop hook to index
    hook_result = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert hook_result["indexed"] > 0

    # Run injector to search
    context = run_injector(
        {"prompt": "Cloudflare Workers D1データベース"},
        db_path=db_path,
    )
    assert "<claude-mem-context>" in context
    assert "D1" in context or "Cloudflare" in context

    # Verify the context doesn't contain noise
    assert "<system-reminder>" not in context
    assert "<task-notification>" not in context


def test_hook_incremental_then_injector():
    """Hook indexes incrementally, injector finds both old and new content."""
    tmp = Path(tempfile.mkdtemp())
    db_path = tmp / "memory.db"
    project_dir = tmp / "projects" / "test-project"
    project_dir.mkdir(parents=True)
    session_id = "incremental-test"
    jsonl_path = project_dir / f"{session_id}.jsonl"

    # Create initial JSONL
    _create_test_jsonl(jsonl_path)

    # First hook run
    run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )

    # Append new content
    new_events = [
        {"type": "user", "message": {"role": "user", "content": "Playwrightでブラウザテストを書く時のベストプラクティスを教えて。ページオブジェクトパターンについて知りたい。"}, "timestamp": "2026-03-27T10:05:00Z", "uuid": "u-3", "promptId": "p-3"},
        {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "Playwrightのベストプラクティスとして、Page Object Patternを推奨します。各ページをクラスとして定義し、ロケーターとアクションをカプセル化します。test.describe()でテストをグループ化し、beforeEach()でページ遷移を共通化できます。"}]}, "timestamp": "2026-03-27T10:05:10Z", "uuid": "a-3"},
    ]
    with open(jsonl_path, "a") as f:
        for event in new_events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")

    # Second hook run (incremental)
    result2 = run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )
    assert result2["indexed"] > 0
    assert result2["new_lines"] == 2

    # Injector can find both old and new content
    d1_context = run_injector({"prompt": "D1 database Cloudflare"}, db_path=db_path)
    assert "D1" in d1_context or "Cloudflare" in d1_context

    pw_context = run_injector({"prompt": "Playwright Page Object"}, db_path=db_path)
    assert "Playwright" in pw_context or "Page Object" in pw_context


def test_injector_output_format():
    """Injector output follows the expected format."""
    tmp = Path(tempfile.mkdtemp())
    db_path = tmp / "memory.db"
    project_dir = tmp / "projects" / "test-project"
    project_dir.mkdir(parents=True)
    session_id = "format-test"
    jsonl_path = project_dir / f"{session_id}.jsonl"
    _create_test_jsonl(jsonl_path)

    run_hook(
        {"session_id": session_id, "transcript_path": str(jsonl_path)},
        db_path=db_path,
    )

    context = run_injector({"prompt": "D1 wrangler"}, db_path=db_path)

    # Must be wrapped in claude-mem-context
    assert context.startswith("<claude-mem-context>")
    assert context.endswith("</claude-mem-context>")
    # Must contain memory headers
    assert "### Memory" in context
    assert "Relevant memories" in context
