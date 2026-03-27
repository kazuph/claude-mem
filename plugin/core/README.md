# claude-mem v2 core

Python + SQLite FTS5 による Claude Code セッション記憶検索エンジン。
sui-memory の設計思想に基づき、LLM不使用のルールベースchunking + 全文検索で実装。

## セットアップ

```bash
cd core
uv sync
```

## Claude Code Hooks 設定

`~/.claude/settings.json` に以下を追加:

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "uv run --project /path/to/claude-mem/core python -m hook",
        "timeout": 10000
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "uv run --project /path/to/claude-mem/core python -m injector",
        "timeout": 5000
      }
    ]
  }
}
```

**Stop hook** (`hook.py`): 毎ターン終了時にJSONLセッションログを差分indexing。
**UserPromptSubmit hook** (`injector.py`): 毎プロンプト送信時に関連メモリを検索してコンテキストに注入。

### Hook stdin/stdout プロトコル

| Hook | stdin | stdout |
|------|-------|--------|
| Stop | `{session_id, transcript_path, cwd, ...}` | なし（stderrのみ） |
| UserPromptSubmit | `{session_id, transcript_path, cwd, prompt, ...}` | `<claude-mem-context>...</claude-mem-context>` |

## CLI

```bash
# 過去セッションの一括index
uv run python cli.py backfill

# 検索
uv run python cli.py search "JWT auth"

# DB統計
uv run python cli.py stats

# 手動index
uv run python cli.py index path/to/session.jsonl

# HTTP API 起動 (port 37778)
uv run python cli.py serve
```

## テスト

```bash
uv run pytest tests/ -v
```

## アーキテクチャ

```
JSONL (~/.claude/projects/<cwd>/<session>.jsonl)
  → parser.py   (type=text only, noise filter, privacy filter)
  → chunker.py  (Q&A chunks, 150-800 tokens)
  → store.py    (SQLite FTS5 trigram + LIKE fallback)
  → ranking.py  (RRF k=60 + time decay 30-day half-life)
  → hook.py     (Stop hook: incremental diff indexing)
  → injector.py (UserPromptSubmit hook: search → context injection)
```
