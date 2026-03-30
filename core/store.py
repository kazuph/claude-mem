<<<<<<< HEAD
"""SQLite FTS5 store for memory chunks.

Provides full-text search over Q&A chunks extracted from Claude Code sessions.
Uses trigram tokenizer for Japanese/English mixed content.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from chunker import Chunk

DEFAULT_DB_PATH = Path.home() / ".claude-mem" / "memory.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    project_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_chunks (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    prompt_number INTEGER,
    chunk_type TEXT DEFAULT 'qa',
    text_content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_fts USING fts5(
    text_content,
    content=memory_chunks,
    content_rowid=id,
    tokenize='trigram'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS memory_chunks_ai AFTER INSERT ON memory_chunks BEGIN
    INSERT INTO memory_chunks_fts(rowid, text_content) VALUES (new.id, new.text_content);
END;

CREATE TRIGGER IF NOT EXISTS memory_chunks_ad AFTER DELETE ON memory_chunks BEGIN
    INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, text_content)
        VALUES('delete', old.id, old.text_content);
END;

CREATE TRIGGER IF NOT EXISTS memory_chunks_au AFTER UPDATE ON memory_chunks BEGIN
    INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, text_content)
        VALUES('delete', old.id, old.text_content);
    INSERT INTO memory_chunks_fts(rowid, text_content) VALUES (new.id, new.text_content);
END;

-- Track incremental indexing progress per session (for Stop hook)
CREATE TABLE IF NOT EXISTS indexed_lines (
    session_id TEXT PRIMARY KEY,
    last_line_number INTEGER NOT NULL DEFAULT 0
);
"""



@dataclass
class SearchResult:
    """A search result from FTS5."""

    chunk_id: int
    session_id: str
    project_path: str
    prompt_number: int
    chunk_type: str
    text_content: str
    rank: float
    created_at: str
    vote_count: int = 0
    last_recalled_at: str = ""


class MemoryStore:
    """SQLite FTS5-backed memory store."""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(SCHEMA_SQL)
        # Migrate: add vote columns to existing DBs
        self._migrate_vote_columns()
        self.conn.commit()

    def _migrate_vote_columns(self) -> None:
        """Add vote_count and last_recalled_at columns if missing."""
        cols = {r[1] for r in self.conn.execute("PRAGMA table_info(memory_chunks)").fetchall()}
        if "vote_count" not in cols:
            self.conn.execute("ALTER TABLE memory_chunks ADD COLUMN vote_count INTEGER DEFAULT 0")
        if "last_recalled_at" not in cols:
            self.conn.execute("ALTER TABLE memory_chunks ADD COLUMN last_recalled_at DATETIME")

    def close(self) -> None:
        self.conn.close()

    def insert_session(self, session_id: str, project_path: str) -> int:
        """Insert a session record and return its internal ID."""
        cur = self.conn.execute(
            "INSERT INTO sessions (session_id, project_path) VALUES (?, ?)",
            (session_id, project_path),
        )
        self.conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def insert_chunks(self, internal_session_id: int, chunks: list[Chunk]) -> int:
        """Insert chunks for a session. Returns count inserted."""
        rows = [
            (internal_session_id, c.prompt_number, c.chunk_type, c.text)
            for c in chunks
        ]
        self.conn.executemany(
            "INSERT INTO memory_chunks (session_id, prompt_number, chunk_type, text_content) "
            "VALUES (?, ?, ?, ?)",
            rows,
        )
        self.conn.commit()
        return len(rows)

    def search_fts(
        self,
        query: str,
        limit: int = 20,
        project_path: str | None = None,
    ) -> list[SearchResult]:
        """Full-text search using FTS5 trigram matching.

        Trigram tokenizer requires 3+ character queries. For shorter queries
        (common in Japanese: バグ, 修正, 認証 etc.), falls back to LIKE search.
        """
        if not query or not query.strip():
            return []

        # Split query into terms; trigram needs 3+ chars per term
        terms = query.split()
        # Check if ALL terms are long enough for FTS5 trigram
        fts_terms = [t for t in terms if len(t) >= 3]
        like_terms = [t for t in terms if len(t) < 3]

        if fts_terms and not like_terms:
            fts_query = " OR ".join(f'"{t.replace(chr(34), chr(34)+chr(34))}"' for t in fts_terms)
            sql = """
                SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                       mc.chunk_type, mc.text_content, mc.created_at,
                       memory_chunks_fts.rank,
                       mc.vote_count, mc.last_recalled_at
                FROM memory_chunks_fts
                JOIN memory_chunks mc ON mc.id = memory_chunks_fts.rowid
                JOIN sessions s ON s.id = mc.session_id
                WHERE memory_chunks_fts MATCH ?
            """
            params: list[str | int] = [fts_query]
            use_fts = True
        else:
            # Has short terms (< 3 chars) or mixed: LIKE fallback
            # Build AND condition: all terms must appear
            conditions = " AND ".join("mc.text_content LIKE ?" for _ in terms)
            sql = f"""
                SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                       mc.chunk_type, mc.text_content, mc.created_at,
                       0.0 as rank,
                       mc.vote_count, mc.last_recalled_at
                FROM memory_chunks mc
                JOIN sessions s ON s.id = mc.session_id
                WHERE {conditions}
            """
            params = [f"%{t}%" for t in terms]
            use_fts = False

        if project_path:
            sql += " AND s.project_path = ?"
            params.append(project_path)

        if use_fts:
            sql += " ORDER BY memory_chunks_fts.rank LIMIT ?"
        else:
            sql += " ORDER BY mc.created_at DESC LIMIT ?"
        params.append(limit)

        rows = self.conn.execute(sql, params).fetchall()
        return [self._row_to_result(r) for r in rows]

    @staticmethod
    def _row_to_result(r: sqlite3.Row) -> SearchResult:
        return SearchResult(
            chunk_id=r["id"],
            session_id=r["session_id"],
            project_path=r["project_path"],
            prompt_number=r["prompt_number"],
            chunk_type=r["chunk_type"],
            text_content=r["text_content"],
            rank=r["rank"],
            created_at=r["created_at"],
            vote_count=r["vote_count"] or 0,
            last_recalled_at=r["last_recalled_at"] or "",
        )

    def get_recent(
        self,
        limit: int = 20,
        project_path: str | None = None,
    ) -> list[SearchResult]:
        """Get most recent chunks."""
        sql = """
            SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                   mc.chunk_type, mc.text_content, mc.created_at, 0.0 as rank,
                   mc.vote_count, mc.last_recalled_at
            FROM memory_chunks mc
            JOIN sessions s ON s.id = mc.session_id
        """
        params: list[str | int] = []

        if project_path:
            sql += " WHERE s.project_path = ?"
            params.append(project_path)

        sql += " ORDER BY mc.created_at DESC LIMIT ?"
        params.append(limit)

        rows = self.conn.execute(sql, params).fetchall()
        return [self._row_to_result(r) for r in rows]

    def is_session_indexed(self, session_id: str) -> bool:
        """Check if a session has already been indexed."""
        row = self.conn.execute(
            "SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row is not None

    def get_indexed_lines(self, session_id: str) -> int:
        """Get the last indexed line number for a session."""
        row = self.conn.execute(
            "SELECT last_line_number FROM indexed_lines WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        return row[0] if row else 0

    def set_indexed_lines(self, session_id: str, line_number: int) -> None:
        """Update the last indexed line number for a session."""
        self.conn.execute(
            "INSERT INTO indexed_lines (session_id, last_line_number) VALUES (?, ?) "
            "ON CONFLICT(session_id) DO UPDATE SET last_line_number = ?",
            (session_id, line_number, line_number),
        )
        self.conn.commit()

    def get_projects(self) -> list[dict]:
        """Get distinct project paths with chunk counts."""
        rows = self.conn.execute("""
            SELECT s.project_path, COUNT(mc.id) as chunk_count
            FROM sessions s
            LEFT JOIN memory_chunks mc ON mc.session_id = s.id
            GROUP BY s.project_path
            ORDER BY chunk_count DESC
        """).fetchall()
        return [{"project_path": r[0], "chunk_count": r[1]} for r in rows]

    def get_chunk(self, chunk_id: int) -> SearchResult | None:
        """Get a single chunk by ID."""
        row = self.conn.execute("""
            SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                   mc.chunk_type, mc.text_content, mc.created_at, 0.0 as rank,
                   mc.vote_count, mc.last_recalled_at
            FROM memory_chunks mc
            JOIN sessions s ON s.id = mc.session_id
            WHERE mc.id = ?
        """, (chunk_id,)).fetchone()
        return self._row_to_result(row) if row else None

    def increment_vote(self, chunk_id: int) -> None:
        """Increment vote count and update last_recalled_at for a chunk."""
        self.conn.execute(
            "UPDATE memory_chunks SET vote_count = COALESCE(vote_count, 0) + 1, "
            "last_recalled_at = CURRENT_TIMESTAMP WHERE id = ?",
            (chunk_id,),
        )
        self.conn.commit()

    def get_stats(self) -> dict:
        """Get database statistics."""
        sessions = self.conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        chunks = self.conn.execute("SELECT COUNT(*) FROM memory_chunks").fetchone()[0]
        return {"sessions": sessions, "chunks": chunks}
||||||| 1721d42
=======
"""SQLite FTS5 store for memory chunks.

Provides full-text search over Q&A chunks extracted from Claude Code sessions.
Uses trigram tokenizer for Japanese/English mixed content.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from chunker import Chunk

DEFAULT_DB_PATH = Path.home() / ".claude-mem" / "memory.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    project_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_chunks (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    prompt_number INTEGER,
    chunk_type TEXT DEFAULT 'qa',
    text_content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_fts USING fts5(
    text_content,
    content=memory_chunks,
    content_rowid=id,
    tokenize='trigram'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS memory_chunks_ai AFTER INSERT ON memory_chunks BEGIN
    INSERT INTO memory_chunks_fts(rowid, text_content) VALUES (new.id, new.text_content);
END;

CREATE TRIGGER IF NOT EXISTS memory_chunks_ad AFTER DELETE ON memory_chunks BEGIN
    INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, text_content)
        VALUES('delete', old.id, old.text_content);
END;

CREATE TRIGGER IF NOT EXISTS memory_chunks_au AFTER UPDATE ON memory_chunks BEGIN
    INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, text_content)
        VALUES('delete', old.id, old.text_content);
    INSERT INTO memory_chunks_fts(rowid, text_content) VALUES (new.id, new.text_content);
END;

-- Track incremental indexing progress per session (for Stop hook)
CREATE TABLE IF NOT EXISTS indexed_lines (
    session_id TEXT PRIMARY KEY,
    last_line_number INTEGER NOT NULL DEFAULT 0
);
"""


@dataclass
class SearchResult:
    """A search result from FTS5."""

    chunk_id: int
    session_id: str
    project_path: str
    prompt_number: int
    chunk_type: str
    text_content: str
    rank: float
    created_at: str


class MemoryStore:
    """SQLite FTS5-backed memory store."""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(SCHEMA_SQL)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def insert_session(self, session_id: str, project_path: str) -> int:
        """Insert a session record and return its internal ID."""
        cur = self.conn.execute(
            "INSERT INTO sessions (session_id, project_path) VALUES (?, ?)",
            (session_id, project_path),
        )
        self.conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def insert_chunks(self, internal_session_id: int, chunks: list[Chunk]) -> int:
        """Insert chunks for a session. Returns count inserted."""
        rows = [
            (internal_session_id, c.prompt_number, c.chunk_type, c.text)
            for c in chunks
        ]
        self.conn.executemany(
            "INSERT INTO memory_chunks (session_id, prompt_number, chunk_type, text_content) "
            "VALUES (?, ?, ?, ?)",
            rows,
        )
        self.conn.commit()
        return len(rows)

    def search_fts(
        self,
        query: str,
        limit: int = 20,
        project_path: str | None = None,
    ) -> list[SearchResult]:
        """Full-text search using FTS5 trigram matching.

        Trigram tokenizer requires 3+ character queries. For shorter queries
        (common in Japanese: バグ, 修正, 認証 etc.), falls back to LIKE search.
        """
        if not query or not query.strip():
            return []

        # Split query into terms; trigram needs 3+ chars per term
        terms = query.split()
        # Check if ALL terms are long enough for FTS5 trigram
        fts_terms = [t for t in terms if len(t) >= 3]
        like_terms = [t for t in terms if len(t) < 3]

        if fts_terms and not like_terms:
            # All terms are 3+ chars: pure FTS5 search
            # For trigram tokenizer, each term is quoted individually and OR'd
            fts_query = " OR ".join(f'"{t.replace(chr(34), chr(34)+chr(34))}"' for t in fts_terms)
            sql = """
                SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                       mc.chunk_type, mc.text_content, mc.created_at,
                       memory_chunks_fts.rank
                FROM memory_chunks_fts
                JOIN memory_chunks mc ON mc.id = memory_chunks_fts.rowid
                JOIN sessions s ON s.id = mc.session_id
                WHERE memory_chunks_fts MATCH ?
            """
            params: list[str | int] = [fts_query]
            use_fts = True
        else:
            # Has short terms (< 3 chars) or mixed: LIKE fallback
            # Build AND condition: all terms must appear
            conditions = " AND ".join("mc.text_content LIKE ?" for _ in terms)
            sql = f"""
                SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                       mc.chunk_type, mc.text_content, mc.created_at,
                       0.0 as rank
                FROM memory_chunks mc
                JOIN sessions s ON s.id = mc.session_id
                WHERE {conditions}
            """
            params = [f"%{t}%" for t in terms]
            use_fts = False

        if project_path:
            sql += " AND s.project_path = ?"
            params.append(project_path)

        if use_fts:
            sql += " ORDER BY memory_chunks_fts.rank LIMIT ?"
        else:
            sql += " ORDER BY mc.created_at DESC LIMIT ?"
        params.append(limit)

        rows = self.conn.execute(sql, params).fetchall()
        return [
            SearchResult(
                chunk_id=r["id"],
                session_id=r["session_id"],
                project_path=r["project_path"],
                prompt_number=r["prompt_number"],
                chunk_type=r["chunk_type"],
                text_content=r["text_content"],
                rank=r["rank"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def get_recent(
        self,
        limit: int = 20,
        project_path: str | None = None,
    ) -> list[SearchResult]:
        """Get most recent chunks."""
        sql = """
            SELECT mc.id, s.session_id, s.project_path, mc.prompt_number,
                   mc.chunk_type, mc.text_content, mc.created_at, 0.0 as rank
            FROM memory_chunks mc
            JOIN sessions s ON s.id = mc.session_id
        """
        params: list[str | int] = []

        if project_path:
            sql += " WHERE s.project_path = ?"
            params.append(project_path)

        sql += " ORDER BY mc.created_at DESC LIMIT ?"
        params.append(limit)

        rows = self.conn.execute(sql, params).fetchall()
        return [
            SearchResult(
                chunk_id=r["id"],
                session_id=r["session_id"],
                project_path=r["project_path"],
                prompt_number=r["prompt_number"],
                chunk_type=r["chunk_type"],
                text_content=r["text_content"],
                rank=r["rank"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def is_session_indexed(self, session_id: str) -> bool:
        """Check if a session has already been indexed."""
        row = self.conn.execute(
            "SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row is not None

    def get_indexed_lines(self, session_id: str) -> int:
        """Get the last indexed line number for a session."""
        row = self.conn.execute(
            "SELECT last_line_number FROM indexed_lines WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        return row[0] if row else 0

    def set_indexed_lines(self, session_id: str, line_number: int) -> None:
        """Update the last indexed line number for a session."""
        self.conn.execute(
            "INSERT INTO indexed_lines (session_id, last_line_number) VALUES (?, ?) "
            "ON CONFLICT(session_id) DO UPDATE SET last_line_number = ?",
            (session_id, line_number, line_number),
        )
        self.conn.commit()

    def get_stats(self) -> dict:
        """Get database statistics."""
        sessions = self.conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        chunks = self.conn.execute("SELECT COUNT(*) FROM memory_chunks").fetchone()[0]
        return {"sessions": sessions, "chunks": chunks}
>>>>>>> origin/main
