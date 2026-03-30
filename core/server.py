<<<<<<< HEAD
"""HTTP API server + Viewer UI for memory search.

Provides REST endpoints for FTS5 search, recent chunks, health, stats, projects.
Serves a single-page viewer UI at /.
Port 37778 by default.
"""

from __future__ import annotations

import json as json_mod
import os

from litestar import Litestar, get
from litestar.response import Response
from litestar.params import Parameter

from store import MemoryStore, DEFAULT_DB_PATH, SearchResult

PORT = int(os.environ.get("CLAUDE_MEM_V2_PORT", "37778"))

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
        "vote_count": r.vote_count,
    }


@get("/api/search")
async def search(
    q: str = Parameter(query="q", default=""),
    limit: int = Parameter(query="limit", default=20),
    project: str | None = Parameter(query="project", default=None),
) -> dict:
    if not q:
        return {"results": [], "query": q, "count": 0}
    limit = min(limit, 100)
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
    limit = min(limit, 100)
    store = _get_store()
    results = store.get_recent(limit=limit, project_path=project)
    return {
        "results": [_result_to_dict(r) for r in results],
        "count": len(results),
    }


@get("/api/health")
async def health() -> Response:
    try:
        store = _get_store()
        store.get_stats()
        return Response(
            content=json_mod.dumps({"status": "ok", "version": "2.0.0"}),
            media_type="application/json",
            status_code=200,
        )
    except Exception:
        return Response(
            content=json_mod.dumps({"status": "error"}),
            media_type="application/json",
            status_code=500,
        )


@get("/api/stats")
async def stats() -> dict:
    store = _get_store()
    return store.get_stats()


@get("/api/projects")
async def projects() -> dict:
    store = _get_store()
    return {"projects": store.get_projects()}


@get("/")
async def viewer() -> Response:
    return Response(content=VIEWER_HTML, media_type="text/html", status_code=200)


VIEWER_HTML = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>claude-mem v2 viewer</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--surface:#161b22;--surface2:#21262d;--border:#30363d;--text:#e6edf3;--text2:#8b949e;--accent:#58a6ff;--accent2:#3fb950;--q-bg:#1c2128;--a-bg:#161b22;--q-border:#2d333b;--a-border:#238636}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;display:flex;height:100vh;overflow:hidden}
#sidebar{width:260px;min-width:260px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
#sidebar h2{padding:16px;font-size:14px;color:var(--text2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
#sidebar h2 .count{background:var(--accent);color:#fff;border-radius:10px;padding:0 8px;font-size:11px}
#project-list{flex:1;overflow-y:auto;padding:4px 0}
.project-item{padding:8px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-left:3px solid transparent;transition:all .15s}
.project-item:hover{background:var(--surface2)}
.project-item.active{background:var(--surface2);border-left-color:var(--accent)}
.project-item .name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.project-item .badge{background:var(--surface2);color:var(--text2);border-radius:10px;padding:0 6px;font-size:11px;min-width:24px;text-align:center}
.project-item.active .badge{background:var(--accent);color:#fff}
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#topbar{padding:12px 20px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;background:var(--surface)}
#search-box{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:14px;outline:none;transition:border .15s}
#search-box:focus{border-color:var(--accent)}
#search-box::placeholder{color:var(--text2)}
#stats-bar{font-size:12px;color:var(--text2);white-space:nowrap}
#content{flex:1;overflow-y:auto;padding:20px}
.chunk-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;overflow:hidden;transition:border-color .15s}
.chunk-card:hover{border-color:var(--accent)}
.chunk-header{padding:8px 16px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text2)}
.chunk-header .project{color:var(--accent)}
.chunk-header .time{color:var(--text2)}
.chunk-header .vote{background:var(--accent2);color:#fff;border-radius:10px;padding:0 6px;font-size:11px;margin-left:8px}
.chunk-body{padding:16px}
.chunk-q{background:var(--q-bg);border-left:3px solid var(--accent);padding:12px 16px;margin-bottom:8px;border-radius:0 6px 6px 0}
.chunk-q::before{content:"Q";display:inline-block;background:var(--accent);color:#fff;border-radius:4px;padding:0 6px;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle}
.chunk-a{background:var(--a-bg);border-left:3px solid var(--accent2);padding:12px 16px;border-radius:0 6px 6px 0}
.chunk-a::before{content:"A";display:inline-block;background:var(--accent2);color:#fff;border-radius:4px;padding:0 6px;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle}
.chunk-text{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.6}
.empty-state{text-align:center;padding:60px 20px;color:var(--text2)}
.empty-state h3{font-size:18px;margin-bottom:8px;color:var(--text)}
mark{background:#58a6ff33;color:var(--accent);border-radius:2px;padding:0 2px}
</style>
</head>
<body>
<div id="sidebar">
  <h2>Projects <span class="count" id="project-count">0</span></h2>
  <div id="project-list"></div>
</div>
<div id="main">
  <div id="topbar">
    <input type="text" id="search-box" placeholder="Search memories... (FTS5)" autocomplete="off">
    <div id="stats-bar">Loading...</div>
  </div>
  <div id="content">
    <div class="empty-state"><h3>claude-mem v2</h3><p>Search your past sessions or browse by project</p></div>
  </div>
</div>
<script>
const $ = s => document.querySelector(s);
let currentProject = null;
let debounceTimer = null;

function relTime(iso) {
  if (!iso) return '';
  // Handle SQLite's "YYYY-MM-DD HH:MM:SS" format (no T, no Z)
  let s = iso.replace(' ', 'T');
  if (!s.includes('T')) s += 'T00:00:00';
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
  const d = new Date(s);
  if (isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
  return d.toLocaleDateString('ja-JP');
}

function esc(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

function shortProject(p) {
  if (!p) return '?';
  const parts = p.replace(/^-/, '').split('-');
  // Try to find meaningful name: last 1-2 segments
  if (parts.length <= 2) return parts.join('/');
  // Skip Users-username prefix
  const idx = parts.findIndex((p,i) => i > 1 && p !== 'src' && p !== 'github' && p !== 'com');
  return parts.slice(Math.max(idx, parts.length - 3)).join('/');
}

function renderChunk(c, query) {
  const text = c.text_content || '';
  // Split Q/A
  const qaMatch = text.match(/^Q:\s*([\s\S]*?)\n\nA:\s*([\s\S]*)$/);
  let body;
  if (qaMatch) {
    let q = esc(qaMatch[1].trim());
    let a = esc(qaMatch[2].trim());
    if (query) {
      const re = new RegExp('(' + query.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')', 'gi');
      q = q.replace(re, '<mark>$1</mark>');
      a = a.replace(re, '<mark>$1</mark>');
    }
    body = `<div class="chunk-q"><span class="chunk-text">${q}</span></div><div class="chunk-a"><span class="chunk-text">${a}</span></div>`;
  } else {
    let t = esc(text);
    if (query) {
      const re = new RegExp('(' + query.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')', 'gi');
      t = t.replace(re, '<mark>$1</mark>');
    }
    body = `<div class="chunk-text">${t}</div>`;
  }
  return `<div class="chunk-card">
    <div class="chunk-header">
      <span class="project">${esc(shortProject(c.project_path))}</span>${c.vote_count ? `<span class="vote">${c.vote_count} votes</span>` : ''}
      <span class="time">${relTime(c.created_at)}</span>
    </div>
    <div class="chunk-body">${body}</div>
  </div>`;
}

async function loadProjects() {
  const r = await fetch('/api/projects');
  const d = await r.json();
  const list = d.projects || [];
  $('#project-count').textContent = list.length;
  let html = `<div class="project-item ${!currentProject ? 'active' : ''}" data-project="">
    <span class="name">All Projects</span>
    <span class="badge">${list.reduce((s,p) => s+p.chunk_count, 0)}</span>
  </div>`;
  for (const p of list) {
    html += `<div class="project-item ${currentProject === p.project_path ? 'active' : ''}" data-project="${esc(p.project_path)}">
      <span class="name" title="${esc(p.project_path)}">${esc(shortProject(p.project_path))}</span>
      <span class="badge">${p.chunk_count}</span>
    </div>`;
  }
  $('#project-list').innerHTML = html;
  document.querySelectorAll('.project-item').forEach(el => {
    el.onclick = () => { currentProject = el.dataset.project || null; loadProjects(); loadContent(); };
  });
}

async function loadContent() {
  const q = $('#search-box').value.trim();
  let url, query = null;
  if (q) {
    url = `/api/search?q=${encodeURIComponent(q)}&limit=50${currentProject ? '&project=' + encodeURIComponent(currentProject) : ''}`;
    query = q;
  } else {
    url = `/api/recent?limit=50${currentProject ? '&project=' + encodeURIComponent(currentProject) : ''}`;
  }
  const r = await fetch(url);
  const d = await r.json();
  const results = d.results || [];
  if (!results.length) {
    $('#content').innerHTML = `<div class="empty-state"><h3>${q ? 'No results' : 'No memories yet'}</h3><p>${q ? 'Try a different query' : 'Memories will appear after indexing sessions'}</p></div>`;
    return;
  }
  $('#content').innerHTML = results.map(c => renderChunk(c, query)).join('');
}

async function loadStats() {
  const r = await fetch('/api/stats');
  const d = await r.json();
  $('#stats-bar').textContent = `${d.sessions || 0} sessions / ${d.chunks || 0} chunks`;
}

$('#search-box').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadContent, 300);
});
$('#search-box').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(debounceTimer); loadContent(); }});

loadProjects(); loadContent(); loadStats();
</script>
</body>
</html>"""

app = Litestar(
    route_handlers=[search, recent, health, stats, projects, viewer],
    debug=False,
)


def run_server(port: int = PORT, host: str = "0.0.0.0") -> None:
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_server()
||||||| 1721d42
=======
"""HTTP API server for memory search.

Provides REST endpoints for FTS5 search, recent chunks, health, and stats.
Port 37778 by default (coexists with existing 37777 worker).
"""

from __future__ import annotations

import json as json_mod
import os

from litestar import Litestar, get
from litestar.response import Response
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
async def health() -> Response:
    """Health check endpoint."""
    try:
        store = _get_store()
        store.get_stats()
        return Response(
            content=json_mod.dumps({"status": "ok", "version": "2.0.0"}),
            media_type="application/json",
            status_code=200,
        )
    except Exception:
        return Response(
            content=json_mod.dumps({"status": "error"}),
            media_type="application/json",
            status_code=500,
        )


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
>>>>>>> origin/main
