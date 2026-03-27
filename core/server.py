"""HTTP API server for memory search.

Provides REST endpoints for FTS5 search, recent chunks, health, and stats.
Port 37778 by default (coexists with existing 37777 worker).
"""

from __future__ import annotations

import os
from dataclasses import asdict

from litestar import Litestar, get
from litestar.params import Parameter

from store import MemoryStore, DEFAULT_DB_PATH, SearchResult

PORT = int(os.environ.get("CLAUDE_MEM_V2_PORT", "37778"))

# Lazy-init store (created on first request)
_store: MemoryStore | None = None


def _get_store() -> MemoryStore:
    global _store
    if _store is None:
        _store = MemoryStore(db_path=DEFAULT_DB_PATH)
    return _store


def _result_to_dict(r: SearchResult) -> dict:
    return {
        "chunk_id": r.chunk_id,
        "session_id": r.session_id,
        "project_path": r.project_path,
        "prompt_number": r.prompt_number,
        "chunk_type": r.chunk_type,
        "text_content": r.text_content,
        "rank": r.rank,
        "created_at": r.created_at,
    }


@get("/api/search")
async def search(
    q: str = Parameter(query="q", default=""),
    limit: int = Parameter(query="limit", default=20),
    project: str | None = Parameter(query="project", default=None),
) -> dict:
    """Full-text search over memory chunks."""
    if not q:
        return {"results": [], "query": q, "count": 0}

    store = _get_store()
    results = store.search_fts(q, limit=limit, project_path=project)
    return {
        "results": [_result_to_dict(r) for r in results],
        "query": q,
        "count": len(results),
    }


@get("/api/recent")
async def recent(
    limit: int = Parameter(query="limit", default=20),
    project: str | None = Parameter(query="project", default=None),
) -> dict:
    """Get most recent memory chunks."""
    store = _get_store()
    results = store.get_recent(limit=limit, project_path=project)
    return {
        "results": [_result_to_dict(r) for r in results],
        "count": len(results),
    }


@get("/api/health")
async def health() -> dict:
    """Health check endpoint."""
    try:
        store = _get_store()
        store.get_stats()
        return {"status": "ok", "version": "2.0.0"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@get("/api/stats")
async def stats() -> dict:
    """Database statistics."""
    store = _get_store()
    return store.get_stats()


app = Litestar(
    route_handlers=[search, recent, health, stats],
    debug=False,
)


def run_server(port: int = PORT, host: str = "127.0.0.1") -> None:
    """Run the server with uvicorn."""
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_server()
