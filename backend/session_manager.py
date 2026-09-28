"""
session_manager.py — In-memory session state management.

Manages multiple concurrent transcription sessions, each with its own
speaker profiles and running transcript.
"""

from __future__ import annotations

import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)


from database import DatabaseRepository


@dataclass
class TranscriptSegment:
    """A single, speaker-attributed transcription segment."""

    speaker_label: str
    text: str
    start_time: float          # seconds from session start
    end_time: float            # seconds from session start
    language: Optional[str]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_final: bool = True
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "speaker_label": self.speaker_label,
            "text": self.text,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "language": self.language,
            "timestamp": self.timestamp.isoformat(),
            "is_final": self.is_final,
        }


@dataclass
class SpeakerProfile:
    """Aggregated profile for a single labelled speaker within a session."""

    speaker_label: str                            # e.g. 'Speaker 1'
    deepgram_speaker_ids: Set[int] = field(default_factory=set)
    first_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    segment_count: int = 0

    def touch(self) -> None:
        """Update last_seen and increment segment count."""
        self.last_seen = datetime.now(timezone.utc)
        self.segment_count += 1

    def to_dict(self) -> dict:
        return {
            "speaker_label": self.speaker_label,
            "deepgram_speaker_ids": list(self.deepgram_speaker_ids),
            "first_seen": self.first_seen.isoformat(),
            "last_seen": self.last_seen.isoformat(),
            "segment_count": self.segment_count,
        }


@dataclass
class SessionState:
    """Full state for one transcription session."""

    session_id: str
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    speakers: Dict[str, SpeakerProfile] = field(default_factory=dict)
    transcript: List[TranscriptSegment] = field(default_factory=list)
    active: bool = True
    current_speaker: Optional[str] = None

    # ── helpers ───────────────────────────────────────────────────────────────

    def add_segment(self, segment: TranscriptSegment) -> None:
        """Append a final segment and touch the speaker profile."""
        self.transcript.append(segment)
        if segment.speaker_label in self.speakers:
            self.speakers[segment.speaker_label].touch()
        self.current_speaker = segment.speaker_label

        # Persist to database
        DatabaseRepository.save_segment(
            segment_id=segment.id,
            session_id=self.session_id,
            speaker_label=segment.speaker_label,
            text=segment.text,
            start_time=segment.start_time,
            end_time=segment.end_time,
            language=segment.language or "en",
            is_final=segment.is_final,
        )

    def get_or_create_speaker_profile(
        self, speaker_label: str, deepgram_id: int
    ) -> SpeakerProfile:
        if speaker_label not in self.speakers:
            self.speakers[speaker_label] = SpeakerProfile(
                speaker_label=speaker_label,
                deepgram_speaker_ids={deepgram_id},
            )
            logger.info(
                "Session %s: new speaker profile '%s' (deepgram_id=%d)",
                self.session_id,
                speaker_label,
                deepgram_id,
            )
        else:
            self.speakers[speaker_label].deepgram_speaker_ids.add(deepgram_id)

        # Persist to database
        DatabaseRepository.save_speaker_profile(
            session_id=self.session_id,
            speaker_label=speaker_label,
            deepgram_id=deepgram_id,
        )
        return self.speakers[speaker_label]

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "start_time": self.start_time.isoformat(),
            "active": self.active,
            "current_speaker": self.current_speaker,
            "speaker_count": len(self.speakers),
            "speakers": {k: v.to_dict() for k, v in self.speakers.items()},
            "transcript": [seg.to_dict() for seg in self.transcript],
        }

    def get_plain_transcript(self) -> str:
        """Return transcript as a plain-text string with speaker labels."""
        lines: List[str] = []
        for seg in self.transcript:
            lines.append(f"[{seg.speaker_label}] {seg.text}")
        return "\n".join(lines)


# ── Manager ───────────────────────────────────────────────────────────────────


class SessionManager:
    """Thread-safe (asyncio-safe) in-memory store of active sessions."""

    def __init__(self) -> None:
        self._sessions: Dict[str, SessionState] = {}

    # ── public API ────────────────────────────────────────────────────────────

    def create_session(self) -> SessionState:
        """Create and register a new session, returning the SessionState."""
        session_id = str(uuid.uuid4())
        state = SessionState(session_id=session_id)
        self._sessions[session_id] = state
        DatabaseRepository.save_session(session_id=session_id, status="live")
        logger.info("Created session %s", session_id)
        return state

    def get_session(self, session_id: str) -> Optional[SessionState]:
        """Return the SessionState or None if not found."""
        return self._sessions.get(session_id)

    def require_session(self, session_id: str) -> SessionState:
        """Return the SessionState or raise KeyError if not found."""
        session = self.get_session(session_id)
        if session is None:
            raise KeyError(f"Session '{session_id}' not found")
        return session

    def end_session(self, session_id: str) -> Optional[SessionState]:
        """Mark session as inactive and return its final state."""
        session = self._sessions.get(session_id)
        if session:
            session.active = False
            DatabaseRepository.save_session(session_id=session_id, status="stopped")
            logger.info("Ended session %s", session_id)
        return session

    def delete_session(self, session_id: str) -> None:
        """Permanently remove a session from memory."""
        self._sessions.pop(session_id, None)
        logger.info("Deleted session %s", session_id)

    def list_sessions(self) -> List[str]:
        return list(self._sessions.keys())

    def active_count(self) -> int:
        return sum(1 for s in self._sessions.values() if s.active)


# Module-level singleton
session_manager = SessionManager()
