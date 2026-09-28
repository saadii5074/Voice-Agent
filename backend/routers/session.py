"""
routers/session.py — REST API routes for session lifecycle management.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

from session_manager import session_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/session", tags=["session"])


# ── POST /session/start ───────────────────────────────────────────────────────


@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_session() -> Dict[str, Any]:
    """
    Create a new transcription session.

    Returns
    -------
    session_id : str
        UUID for the new session.  Pass this as a query param to the
        WebSocket endpoints.
    status : str
        'created'
    started_at : str
        ISO-8601 timestamp.
    """
    session = session_manager.create_session()
    logger.info("API: started session %s", session.session_id)
    return {
        "session_id": session.session_id,
        "status": "created",
        "started_at": session.start_time.isoformat(),
    }


# ── POST /session/stop ────────────────────────────────────────────────────────


@router.post("/stop")
async def stop_session(body: Dict[str, str]) -> Dict[str, Any]:
    """
    End a session and return its final transcript.

    Body
    ----
    session_id : str  (required)
    """
    session_id = body.get("session_id", "").strip()
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'session_id' is required in the request body",
        )

    session = session_manager.end_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )

    logger.info("API: stopped session %s", session_id)
    return {
        "session_id": session_id,
        "status": "stopped",
        "stopped_at": datetime.now(timezone.utc).isoformat(),
        "speaker_count": len(session.speakers),
        "segment_count": len(session.transcript),
        "transcript": [seg.to_dict() for seg in session.transcript],
    }


# ── GET /session/{session_id} ─────────────────────────────────────────────────


@router.get("/{session_id}")
async def get_session(session_id: str) -> Dict[str, Any]:
    """Return current state for a session (speakers, segment count, active flag)."""
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )
    return session.to_dict()


# ── GET /session/{session_id}/transcript ─────────────────────────────────────


@router.get("/{session_id}/transcript")
async def get_transcript(session_id: str, fmt: str = "json") -> Any:
    """
    Return the full transcript for a session.

    Query params
    ------------
    fmt : 'json' (default) | 'text'
        'json'  → list of TranscriptSegment dicts
        'text'  → plain text with speaker labels, one segment per line
    """
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )

    if fmt == "text":
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(session.get_plain_transcript())

    if fmt == "srt":
        from fastapi.responses import PlainTextResponse

        def format_srt_time(sec: float) -> str:
            hrs = int(sec // 3600)
            mins = int((sec % 3600) // 60)
            secs = int(sec % 60)
            ms = int((sec - int(sec)) * 1000)
            return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"

        srt_lines = []
        for idx, seg in enumerate(session.transcript, 1):
            t_start = format_srt_time(seg.start_time)
            t_end = format_srt_time(seg.end_time if seg.end_time > seg.start_time else seg.start_time + 1.5)
            srt_lines.append(f"{idx}\n{t_start} --> {t_end}\n[{seg.speaker_label}]: {seg.text}\n")

        return PlainTextResponse("\n".join(srt_lines), media_type="text/plain")

    return {
        "session_id": session_id,
        "segment_count": len(session.transcript),
        "speakers": list(session.speakers.keys()),
        "transcript": [seg.to_dict() for seg in session.transcript],
    }


# ── GET /session/{session_id}/speakers ───────────────────────────────────────


@router.get("/{session_id}/speakers")
async def get_speakers(session_id: str) -> Dict[str, Any]:
    """Return the list of speakers identified so far in a session."""
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )
    return {
        "session_id": session_id,
        "speaker_count": len(session.speakers),
        "speakers": {k: v.to_dict() for k, v in session.speakers.items()},
    }
