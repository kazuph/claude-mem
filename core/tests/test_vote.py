"""Tests for implicit voting — real SQLite, no mocks."""

import json
import math
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

from chunker import Chunk
from hook import run_implicit_vote, _extract_keywords, INJECTED_DIR
from store import MemoryStore
from ranking import recall_boost, time_decay_with_recall, HALF_LIFE_DAYS


# --- Keyword extraction tests ---

def test_extract_keywords_file_paths():
    kw = _extract_keywords("Modified core/store.py and tests/test_hook.py")
    assert "core/store.py" in kw
    assert "tests/test_hook.py" in kw


def test_extract_keywords_camel_case():
    kw = _extract_keywords("Using MemoryStore and SearchResult classes")
    assert "memorystore" in kw or "MemoryStore".casefold() in kw


def test_extract_keywords_snake_case():
    kw = _extract_keywords("Called search_fts and insert_chunks")
    assert "search_fts" in kw
    assert "insert_chunks" in kw


def test_extract_keywords_japanese():
    kw = _extract_keywords("フィボナッチ数列のテストを書いた")
    assert any("フィボナッチ" in k for k in kw)


def test_extract_keywords_stopwords_excluded():
    kw = _extract_keywords("the function is used for this purpose")
    assert "the" not in kw
    assert "for" not in kw
    assert "used" not in kw  # in stopwords
    # 'function' is NOT a stopword (important tech term)
    assert "function" in kw
    assert "purpose" in kw


# --- Store vote methods ---

def _make_voted_store():
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    store = MemoryStore(db_path=f.name)
    sid = store.insert_session("vote-test", "/project/vote")
    store.insert_chunks(sid, [
        Chunk(prompt_number=1, chunk_type="qa",
              text="Q: SQLite FTS5の使い方を教えて\n\nA: trigramトークナイザーがおすすめです。"),
        Chunk(prompt_number=2, chunk_type="qa",
              text="Q: Cloudflare WorkersでD1を使う方法\n\nA: wrangler.tomlにバインディングを設定します。"),
    ])
    return store, f.name


def test_increment_vote():
    store, _ = _make_voted_store()
    try:
        chunk = store.get_chunk(1)
        assert chunk is not None
        assert chunk.vote_count == 0

        store.increment_vote(1)
        chunk = store.get_chunk(1)
        assert chunk.vote_count == 1

        store.increment_vote(1)
        store.increment_vote(1)
        chunk = store.get_chunk(1)
        assert chunk.vote_count == 3
        assert chunk.last_recalled_at != ""
    finally:
        store.close()


def test_get_chunk():
    store, _ = _make_voted_store()
    try:
        chunk = store.get_chunk(1)
        assert chunk is not None
        assert "FTS5" in chunk.text_content

        assert store.get_chunk(9999) is None
    finally:
        store.close()


def test_vote_count_in_search_results():
    store, _ = _make_voted_store()
    try:
        store.increment_vote(1)
        store.increment_vote(1)

        results = store.search_fts("FTS5")
        assert len(results) >= 1
        assert results[0].vote_count == 2
    finally:
        store.close()


# --- Implicit vote integration ---

def test_run_implicit_vote():
    store, db_path = _make_voted_store()
    store.close()

    session_id = "vote-test"

    # Create per-session injected file
    tmp_dir = Path(tempfile.mkdtemp())
    injected_path = tmp_dir / f"last_injected_{session_id}.json"
    injected_data = {"session_id": session_id, "chunk_ids": [1, 2], "timestamp": "2026-03-30T00:00:00Z"}
    injected_path.write_text(json.dumps(injected_data), encoding="utf-8")

    # Create JSONL with assistant response that has enough keyword overlap with chunk A-parts
    # Chunk 1 A: "trigramトークナイザーがおすすめです。" — keywords: trigram, トークナイザー
    # Chunk 2 A: "wrangler.tomlにバインディングを設定します。" — keywords: wrangler.toml, バインディング
    jsonl_path = Path(tempfile.mktemp(suffix=".jsonl"))
    jsonl_path.write_text(json.dumps({
        "type": "assistant",
        "message": {"role": "assistant", "content": [{"type": "text", "text":
            "FTS5のtrigramトークナイザーは全文検索に最適です。"
            "SQLiteのtrigram tokenize設定でunicode対応も可能。"
            "wrangler.tomlのバインディング設定でD1 databaseを接続します。"
        }]},
        "timestamp": "2026-03-30T00:00:05Z",
    }) + "\n", encoding="utf-8")

    import hook as hook_module
    original_dir = hook_module.INJECTED_DIR
    hook_module.INJECTED_DIR = tmp_dir

    try:
        result = run_implicit_vote(
            {"session_id": session_id, "transcript_path": str(jsonl_path)},
            db_path=Path(db_path),
        )
        assert result["voted"] >= 1

        store = MemoryStore(db_path=db_path)
        try:
            # At least one chunk should have been voted
            chunk1 = store.get_chunk(1)
            chunk2 = store.get_chunk(2)
            assert chunk1.vote_count + chunk2.vote_count >= 1
        finally:
            store.close()
    finally:
        hook_module.INJECTED_DIR = original_dir


# --- Recall boost ranking ---

def test_recall_boost_zero_votes():
    assert recall_boost(0) == 1.0  # log(1) * 0.3 = 0


def test_recall_boost_increases_with_votes():
    assert recall_boost(5) > recall_boost(1) > recall_boost(0)


def test_time_decay_with_recall_extends_half_life():
    now = datetime(2026, 3, 30, tzinfo=timezone.utc)
    past = now - timedelta(days=HALF_LIFE_DAYS)

    # No votes: decay = 0.5 at half-life
    decay_no_votes = time_decay_with_recall(past.isoformat(), vote_count=0, now=now)
    assert abs(decay_no_votes - 0.5) < 0.01

    # With votes: decay > 0.5 at same age (extended half-life)
    decay_with_votes = time_decay_with_recall(past.isoformat(), vote_count=10, now=now)
    assert decay_with_votes > 0.5  # Extended half-life = slower decay


def test_time_decay_rejuvenation_via_last_recalled():
    """Recently recalled memories should appear younger via last_recalled_at."""
    now = datetime(2026, 3, 30, tzinfo=timezone.utc)
    old_date = "2026-02-01T00:00:00+00:00"  # ~57 days ago
    recent_recall = "2026-03-29T00:00:00+00:00"  # 1 day ago

    # Without recall: very decayed
    decay_old = time_decay_with_recall(old_date, vote_count=0, now=now)
    # With recent recall: rejuvenated (uses last_recalled_at as reference)
    decay_recalled = time_decay_with_recall(old_date, vote_count=1, now=now, last_recalled_at=recent_recall)

    assert decay_recalled > decay_old * 2  # Should be significantly fresher


def test_time_decay_with_recall_preserves_fresh():
    now = datetime(2026, 3, 30, tzinfo=timezone.utc)
    # Fresh content: votes shouldn't matter much
    decay_0 = time_decay_with_recall(now.isoformat(), vote_count=0, now=now)
    decay_10 = time_decay_with_recall(now.isoformat(), vote_count=10, now=now)
    assert abs(decay_0 - 1.0) < 0.01
    assert abs(decay_10 - 1.0) < 0.01
