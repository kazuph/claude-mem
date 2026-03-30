<<<<<<< HEAD
"""Tests for HTTP API server — real server + real SQLite, no mocks.

Uses Litestar's TestClient which starts a real ASGI server in-process.
"""

import tempfile
from pathlib import Path

import pytest
from litestar.testing import TestClient

from chunker import Chunk
from store import MemoryStore

import server as server_module


@pytest.fixture
def client():
    """Create a test client with real data in a temp DB. Cleans up on exit."""
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    store = MemoryStore(db_path=f.name)
    sid = store.insert_session("test-sess-1", "/project/test")
    store.insert_chunks(sid, [
        Chunk(prompt_number=1, chunk_type="qa",
              text="Q: Pythonでフィボナッチ数列を書いて\n\nA: 再帰版とイテレーティブ版があります。"),
        Chunk(prompt_number=2, chunk_type="qa",
              text="Q: SQLiteのFTS5を使いたい\n\nA: trigramトークナイザーがおすすめです。"),
        Chunk(prompt_number=3, chunk_type="qa",
              text="Q: Rustのライフタイムについて\n\nA: 所有権システムの一部です。"),
    ])
    server_module._store = store
    with TestClient(app=server_module.app) as tc:
        yield tc
    store.close()


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_stats_endpoint(client):
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessions"] == 1
    assert data["chunks"] == 3


def test_search_endpoint(client):
    resp = client.get("/api/search", params={"q": "フィボナッチ"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert "フィボナッチ" in data["results"][0]["text_content"]


def test_search_empty_query(client):
    resp = client.get("/api/search", params={"q": ""})
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


def test_search_with_project_filter(client):
    resp = client.get("/api/search", params={"q": "フィボナッチ", "project": "/project/test"})
    assert resp.status_code == 200
    assert resp.json()["count"] >= 1

    resp2 = client.get("/api/search", params={"q": "フィボナッチ", "project": "/project/other"})
    assert resp2.json()["count"] == 0


def test_recent_endpoint(client):
    resp = client.get("/api/recent", params={"limit": "2"})
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


def test_recent_with_project_filter(client):
    resp = client.get("/api/recent", params={"project": "/project/test"})
    assert resp.status_code == 200
    assert resp.json()["count"] == 3

    resp2 = client.get("/api/recent", params={"project": "/project/nope"})
    assert resp2.json()["count"] == 0
||||||| 1721d42
=======
"""Tests for HTTP API server — real server + real SQLite, no mocks.

Uses Litestar's TestClient which starts a real ASGI server in-process.
"""

import tempfile
from pathlib import Path

from litestar.testing import TestClient

from chunker import Chunk
from store import MemoryStore

# We need to set up the store before importing app
import store as store_module
import server as server_module


def _setup_server_with_data() -> TestClient:
    """Create a test client with real data in a temp DB."""
    db_path = Path(tempfile.mktemp(suffix=".db"))
    s = MemoryStore(db_path=db_path)
    sid = s.insert_session("test-sess-1", "/project/test")
    s.insert_chunks(sid, [
        Chunk(prompt_number=1, chunk_type="qa",
              text="Q: Pythonでフィボナッチ数列を書いて\n\nA: 再帰版とイテレーティブ版があります。"),
        Chunk(prompt_number=2, chunk_type="qa",
              text="Q: SQLiteのFTS5を使いたい\n\nA: trigramトークナイザーがおすすめです。"),
        Chunk(prompt_number=3, chunk_type="qa",
              text="Q: Rustのライフタイムについて\n\nA: 所有権システムの一部です。"),
    ])

    # Point the server's store to our temp DB
    server_module._store = s

    return TestClient(app=server_module.app)


def test_health_endpoint():
    client = _setup_server_with_data()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_stats_endpoint():
    client = _setup_server_with_data()
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessions"] == 1
    assert data["chunks"] == 3


def test_search_endpoint():
    client = _setup_server_with_data()
    resp = client.get("/api/search", params={"q": "フィボナッチ"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert "フィボナッチ" in data["results"][0]["text_content"]


def test_search_empty_query():
    client = _setup_server_with_data()
    resp = client.get("/api/search", params={"q": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0


def test_search_with_project_filter():
    client = _setup_server_with_data()
    resp = client.get("/api/search", params={"q": "フィボナッチ", "project": "/project/test"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1

    resp2 = client.get("/api/search", params={"q": "フィボナッチ", "project": "/project/other"})
    data2 = resp2.json()
    assert data2["count"] == 0


def test_recent_endpoint():
    client = _setup_server_with_data()
    resp = client.get("/api/recent", params={"limit": "2"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2


def test_recent_with_project_filter():
    client = _setup_server_with_data()
    resp = client.get("/api/recent", params={"project": "/project/test"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3

    resp2 = client.get("/api/recent", params={"project": "/project/nope"})
    data2 = resp2.json()
    assert data2["count"] == 0
>>>>>>> origin/main
