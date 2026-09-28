"""
websocket_manager.py — Manages event-push WebSocket connections per session.

Clients connect to /ws/events?session_id=xxx and receive JSON events pushed
by the backend whenever speaker changes or transcript segments arrive.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Registry of event-push WebSocket connections, grouped by session_id."""

    def __init__(self) -> None:
        # session_id -> set of connected WebSocket clients
        self._clients: Dict[str, Set[WebSocket]] = defaultdict(set)

    # ── connection lifecycle ──────────────────────────────────────────────────

    async def add_event_client(self, session_id: str, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection and register it for *session_id*."""
        await websocket.accept()
        self._clients[session_id].add(websocket)
        logger.info(
            "WebSocket client connected — session=%s  total=%d",
            session_id,
            len(self._clients[session_id]),
        )

    async def remove_event_client(
        self, session_id: str, websocket: WebSocket
    ) -> None:
        """Unregister a WebSocket client (call on disconnect)."""
        self._clients[session_id].discard(websocket)
        if not self._clients[session_id]:
            del self._clients[session_id]
        logger.info(
            "WebSocket client disconnected — session=%s", session_id
        )

    # ── broadcast helpers ─────────────────────────────────────────────────────

    async def broadcast_event(self, session_id: str, event: Dict[str, Any]) -> None:
        """
        Send *event* (serialised to JSON) to every client listening on
        *session_id*.  Dead connections are silently removed.
        """
        clients = list(self._clients.get(session_id, set()))
        if not clients:
            return

        payload = json.dumps(event)
        dead: List[WebSocket] = []

        results = await asyncio.gather(
            *[ws.send_text(payload) for ws in clients],
            return_exceptions=True,
        )

        for ws, result in zip(clients, results):
            if isinstance(result, Exception):
                logger.warning(
                    "Failed to send to a client on session %s: %s — removing",
                    session_id,
                    result,
                )
                dead.append(ws)

        for ws in dead:
            self._clients[session_id].discard(ws)

    # ── typed event builders ──────────────────────────────────────────────────

    async def send_speaker_change(
        self, session_id: str, speaker: str, previous_speaker: str | None = None
    ) -> None:
        # Extract numeric part for speaker_id (e.g. "Speaker 1" -> "speaker_1")
        num = ''.join(c for c in speaker if c.isdigit()) or '0'
        await self.broadcast_event(
            session_id,
            {
                "type": "speaker_change",
                "session_id": session_id,
                "speaker": speaker,
                "speaker_id": f"speaker_{num}",
                "speaker_label": speaker,
                "previous_speaker": previous_speaker,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def send_transcript(
        self,
        session_id: str,
        *,
        speaker: str,
        text: str,
        start_time: float,
        end_time: float,
        language: str | None,
        is_final: bool,
        segment_id: str | None = None,
    ) -> None:
        num = ''.join(c for c in speaker if c.isdigit()) or '0'
        await self.broadcast_event(
            session_id,
            {
                "type": "transcript",
                "session_id": session_id,
                "speaker": speaker,
                "speaker_id": f"speaker_{num}",
                "speaker_label": speaker,
                "segment_id": segment_id,
                "text": text,
                "start_time": start_time,
                "end_time": end_time,
                "language": language,
                "is_final": is_final,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def send_session_start(self, session_id: str) -> None:
        await self.broadcast_event(
            session_id,
            {
                "type": "session_start",
                "session_id": session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def send_session_stop(self, session_id: str) -> None:
        await self.broadcast_event(
            session_id,
            {
                "type": "session_stop",
                "session_id": session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def send_speaker_list(
        self, session_id: str, speakers: List[Any]
    ) -> None:
        formatted_speakers = []
        for s in speakers:
            if isinstance(s, dict):
                formatted_speakers.append(s)
            else:
                label = str(s)
                num = ''.join(c for c in label if c.isdigit()) or '0'
                formatted_speakers.append({
                    "id": f"speaker_{num}",
                    "label": label,
                    "segmentCount": 0,
                    "firstSeen": datetime.now(timezone.utc).isoformat(),
                    "lastSeen": datetime.now(timezone.utc).isoformat()
                })
        await self.broadcast_event(
            session_id,
            {
                "type": "speaker_list",
                "session_id": session_id,
                "speakers": formatted_speakers,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def send_error(self, session_id: str, message: str) -> None:
        await self.broadcast_event(
            session_id,
            {
                "type": "error",
                "session_id": session_id,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def send_status(
        self,
        session_id: str,
        message: str,
        level: str = "info",
    ) -> None:
        await self.broadcast_event(
            session_id,
            {
                "type": "status",
                "session_id": session_id,
                "message": message,
                "level": level,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    # ── diagnostics ───────────────────────────────────────────────────────────

    def client_count(self, session_id: str) -> int:
        return len(self._clients.get(session_id, set()))

    def all_sessions(self) -> List[str]:
        return list(self._clients.keys())


# Module-level singleton
ws_manager = WebSocketManager()
