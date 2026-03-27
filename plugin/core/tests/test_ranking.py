"""Tests for ranking — real calculations, no mocks."""

import math
from datetime import datetime, timezone, timedelta

from ranking import time_decay, project_boost, rank_results, rrf_score, fuse_rrf, HALF_LIFE_DAYS, RRF_K
from store import SearchResult


def test_rrf_score_rank_0():
    assert rrf_score(0) == 1.0 / RRF_K


def test_rrf_score_decreases_with_rank():
    assert rrf_score(0) > rrf_score(1) > rrf_score(10)


def test_time_decay_just_created():
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    score = time_decay("2026-03-27T00:00:00+00:00", now=now)
    assert score > 0.99


def test_time_decay_half_life():
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    past = now - timedelta(days=HALF_LIFE_DAYS)
    score = time_decay(past.isoformat(), now=now)
    assert abs(score - 0.5) < 0.01


def test_time_decay_very_old():
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    past = now - timedelta(days=365)
    score = time_decay(past.isoformat(), now=now)
    assert score < 0.001


def test_project_boost_same_project():
    assert project_boost("/project/a", "/project/a") == 1.0


def test_project_boost_different_project():
    assert project_boost("/project/a", "/project/b") == 0.75


def test_project_boost_no_current():
    assert project_boost("/project/a", None) == 1.0


def _make_result(
    chunk_id: int = 1,
    session_id: str = "s1",
    project_path: str = "/project/a",
    text: str = "test",
    rank: float = 0.0,
    created_at: str = "2026-03-27T00:00:00+00:00",
) -> SearchResult:
    return SearchResult(
        chunk_id=chunk_id,
        session_id=session_id,
        project_path=project_path,
        prompt_number=1,
        chunk_type="qa",
        text_content=text,
        rank=rank,
        created_at=created_at,
    )


def test_rank_results_prefers_recent_at_same_position():
    """When results have same RRF position, newer wins via time decay."""
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    # Two results at same position — reranking should prefer newer
    old = _make_result(chunk_id=1, created_at="2026-01-01T00:00:00+00:00")
    new = _make_result(chunk_id=2, created_at="2026-03-26T00:00:00+00:00")

    # Position 0 = old, position 1 = new, but new has much higher time_decay
    # RRF(0)=1/60, RRF(1)=1/61. decay_new >> decay_old should flip order
    ranked = rank_results([old, new], now=now)
    assert ranked[0].chunk_id == 2  # Newer should rank first


def test_rank_results_prefers_current_project():
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    # diff at position 0, same at position 1
    diff = _make_result(chunk_id=2, project_path="/project/b")
    same = _make_result(chunk_id=1, project_path="/project/a")

    ranked = rank_results([diff, same], current_project="/project/a", now=now)
    # Position 0 has 0.75 boost, position 1 has 1.0 boost
    # RRF(0)*0.75 vs RRF(1)*1.0 → 0.0125 vs 0.01639 → same project wins
    assert ranked[0].chunk_id == 1


def test_rank_results_position_matters():
    """Results at earlier positions get higher RRF scores."""
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    first = _make_result(chunk_id=1)
    last = _make_result(chunk_id=2)

    # Same time, same project — position determines order
    ranked = rank_results([first, last], now=now)
    assert ranked[0].chunk_id == 1  # First position wins


def test_fuse_rrf_single_list():
    """Single list fusion = same as individual RRF scores."""
    r1 = _make_result(chunk_id=1)
    r2 = _make_result(chunk_id=2)
    scores = fuse_rrf([r1, r2])
    assert scores[1] == rrf_score(0)
    assert scores[2] == rrf_score(1)


def test_fuse_rrf_two_lists_additive():
    """sui-memory style: scores from two lists are summed per chunk_id."""
    r1 = _make_result(chunk_id=1)
    r2 = _make_result(chunk_id=2)
    r3 = _make_result(chunk_id=3)

    fts_results = [r1, r2, r3]  # r1 at rank 0, r2 at rank 1, r3 at rank 2
    vec_results = [r3, r1]      # r3 at rank 0, r1 at rank 1

    scores = fuse_rrf(fts_results, vec_results)

    # r1: fts rank 0 + vec rank 1 = 1/60 + 1/61
    assert abs(scores[1] - (rrf_score(0) + rrf_score(1))) < 1e-10
    # r3: fts rank 2 + vec rank 0 = 1/62 + 1/60
    assert abs(scores[3] - (rrf_score(2) + rrf_score(0))) < 1e-10
    # r2: only in fts at rank 1 = 1/61
    assert abs(scores[2] - rrf_score(1)) < 1e-10


def test_rank_results_with_additional_results():
    """Fusion of FTS + additional results boosts items appearing in both."""
    now = datetime(2026, 3, 27, tzinfo=timezone.utc)
    r1 = _make_result(chunk_id=1, text="only in fts")
    r2 = _make_result(chunk_id=2, text="in both")
    r3 = _make_result(chunk_id=3, text="only in vec")

    fts = [r1, r2]  # r1 at rank 0, r2 at rank 1
    vec = [r2, r3]  # r2 at rank 0, r3 at rank 1

    ranked = rank_results(fts, now=now, additional_results=[vec])
    # r2 appears in both lists, so it should get highest fused score
    assert ranked[0].chunk_id == 2
