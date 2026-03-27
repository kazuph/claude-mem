"""Ranking: RRF (Reciprocal Rank Fusion) + time decay + project boost.

sui-memory style: FTS results and vector results are each scored by
position-based RRF (1/(k+rank), k=60), then fused by summing scores
per chunk_id. Time decay (half-life 30 days) is applied after fusion.

Currently only FTS is implemented; vector search will be added later.
The fusion interface is ready for multi-source scoring.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone

from store import SearchResult

# RRF constant (sui-memory uses k=60)
RRF_K = 60

# Half-life in days: score halves every 30 days
HALF_LIFE_DAYS = 30.0
LN2 = math.log(2)


def rrf_score(rank: int, k: int = RRF_K) -> float:
    """Reciprocal Rank Fusion score: 1/(k + rank).

    rank is 0-based position in the result list.
    """
    return 1.0 / (k + rank)


def time_decay(created_at: str, now: datetime | None = None) -> float:
    """Calculate time decay factor: exp(-ln2 * age_days / half_life).

    Returns a value between 0 and 1, where 1 = just created, 0.5 = 30 days ago.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return 0.5  # Default for unparseable dates

    age_days = max(0, (now - created).total_seconds() / 86400)
    return math.exp(-LN2 * age_days / HALF_LIFE_DAYS)


def project_boost(result_project: str, current_project: str | None) -> float:
    """Boost results from the current project.

    Same project: 1.0, different project: 0.75
    """
    if current_project is None:
        return 1.0
    return 1.0 if result_project == current_project else 0.75


def fuse_rrf(
    *result_lists: list[SearchResult],
) -> dict[int, float]:
    """Fuse multiple ranked result lists using RRF.

    sui-memory style: each list contributes 1/(k+rank) per chunk_id,
    scores are summed across lists. Raw FTS/vector scores are NOT used.

    Args:
        *result_lists: One or more ranked result lists (e.g., FTS results, vector results)

    Returns:
        Dict mapping chunk_id to fused RRF score
    """
    scores: dict[int, float] = defaultdict(float)
    for results in result_lists:
        for position, r in enumerate(results):
            scores[r.chunk_id] += rrf_score(position)
    return dict(scores)


def rank_results(
    results: list[SearchResult],
    current_project: str | None = None,
    now: datetime | None = None,
    additional_results: list[list[SearchResult]] | None = None,
) -> list[SearchResult]:
    """Re-rank search results using RRF fusion + time decay + project boost.

    sui-memory style:
    1. Compute RRF scores per chunk_id (fusing FTS + optional vector results)
    2. Apply time_decay to each result
    3. Apply project_boost
    4. Sort by final score descending

    Args:
        results: Primary FTS search results
        current_project: Current project path for locality boost
        now: Reference time for decay calculation
        additional_results: Optional extra result lists (e.g., vector search)
                           to fuse with the primary results
    """
    # Build lookup by chunk_id
    result_map: dict[int, SearchResult] = {r.chunk_id: r for r in results}

    # Include additional results in the map
    all_lists: list[list[SearchResult]] = [results]
    if additional_results:
        for extra in additional_results:
            for r in extra:
                if r.chunk_id not in result_map:
                    result_map[r.chunk_id] = r
            all_lists.append(extra)

    # Fuse RRF scores across all result lists
    fused_scores = fuse_rrf(*all_lists)

    # Apply time decay and project boost
    scored: list[tuple[float, SearchResult]] = []
    for chunk_id, rrf in fused_scores.items():
        r = result_map[chunk_id]
        decay = time_decay(r.created_at, now=now)
        boost = project_boost(r.project_path, current_project)
        final_score = rrf * decay * boost
        scored.append((final_score, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored]
