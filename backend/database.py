"""
database.py — SQLite Database Persistence for VoiceTrack SaaS.

Provides persistent storage across server restarts for:
- Sessions metadata
- Registered speaker profiles per session
- Transcript segments with exact timestamps and speaker labels
"""

from __future__ import annotations

import os
import sqlite3
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "voicetrack.db"


def get_db_connection() -> sqlite3.Connection:
    """Create and return a thread-safe SQLite connection."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database tables if they do not exist."""
    conn = get_db_connection()
    try:
        with conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL DEFAULT 'idle',
                    speaker_count INTEGER NOT NULL DEFAULT 0,
                    duration INTEGER NOT NULL DEFAULT 0,
                    language TEXT NOT NULL DEFAULT 'en',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS speaker_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    speaker_label TEXT NOT NULL,
                    deepgram_id INTEGER NOT NULL DEFAULT 0,
                    segment_count INTEGER NOT NULL DEFAULT 0,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    UNIQUE(session_id, speaker_label),
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS transcript_segments (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    speaker_label TEXT NOT NULL,
                    text TEXT NOT NULL,
                    start_time REAL NOT NULL,
                    end_time REAL NOT NULL,
                    language TEXT NOT NULL DEFAULT 'en',
                    timestamp TEXT NOT NULL,
                    is_final INTEGER NOT NULL DEFAULT 1,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_segments_session ON transcript_segments(session_id);
                CREATE INDEX IF NOT EXISTS idx_speakers_session ON speaker_profiles(session_id);
            """)
        logger.info("Database initialized successfully at %s", DB_PATH)
    finally:
        conn.close()


class DatabaseRepository:
    """Data Access Object (DAO) for VoiceTrack database operations."""

    @staticmethod
    def save_session(session_id: str, status: str, language: str = "en") -> None:
        conn = get_db_connection()
        now = datetime.now(timezone.utc).isoformat()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO sessions (session_id, status, language, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(session_id) DO UPDATE SET
                        status = excluded.status,
                        updated_at = excluded.updated_at
                    """,
                    (session_id, status, language, now, now),
                )
        finally:
            conn.close()

    @staticmethod
    def update_session_stats(session_id: str, speaker_count: int, duration: int) -> None:
        conn = get_db_connection()
        now = datetime.now(timezone.utc).isoformat()
        try:
            with conn:
                conn.execute(
                    """
                    UPDATE sessions
                    SET speaker_count = ?, duration = ?, updated_at = ?
                    WHERE session_id = ?
                    """,
                    (speaker_count, duration, now, session_id),
                )
        finally:
            conn.close()

    @staticmethod
    def save_speaker_profile(
        session_id: str, speaker_label: str, deepgram_id: int = 0
    ) -> None:
        conn = get_db_connection()
        now = datetime.now(timezone.utc).isoformat()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO speaker_profiles (session_id, speaker_label, deepgram_id, segment_count, first_seen, last_seen)
                    VALUES (?, ?, ?, 1, ?, ?)
                    ON CONFLICT(session_id, speaker_label) DO UPDATE SET
                        segment_count = segment_count + 1,
                        last_seen = excluded.last_seen
                    """,
                    (session_id, speaker_label, deepgram_id, now, now),
                )
        finally:
            conn.close()

    @staticmethod
    def save_segment(
        segment_id: str,
        session_id: str,
        speaker_label: str,
        text: str,
        start_time: float,
        end_time: float,
        language: str = "en",
        is_final: bool = True,
    ) -> None:
        conn = get_db_connection()
        now = datetime.now(timezone.utc).isoformat()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO transcript_segments (id, session_id, speaker_label, text, start_time, end_time, language, timestamp, is_final)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        text = excluded.text,
                        end_time = excluded.end_time,
                        is_final = excluded.is_final
                    """,
                    (
                        segment_id,
                        session_id,
                        speaker_label,
                        text,
                        start_time,
                        end_time,
                        language,
                        now,
                        1 if is_final else 0,
                    ),
                )
        finally:
            conn.close()

    @staticmethod
    def get_session_transcript(session_id: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                """
                SELECT id, speaker_label, text, start_time, end_time, language, timestamp, is_final
                FROM transcript_segments
                WHERE session_id = ? AND is_final = 1
                ORDER BY start_time ASC
                """,
                (session_id,),
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()


# Initialize DB on import
init_db()
