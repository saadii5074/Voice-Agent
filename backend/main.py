"""
main.py — FastAPI application entry point for the Voice Recognition backend.

Endpoints
---------
GET  /health                              — liveness probe
GET  /api/session/start                   — alias kept for convenience (see router)
POST /api/session/start                   — create a new session
POST /api/session/stop                    — end a session
GET  /api/session/{id}                    — session details
GET  /api/session/{id}/transcript         — full transcript (json or text)
GET  /api/session/{id}/speakers           — speaker list
WS   /ws/audio?session_id=xxx             — receive audio from browser → Deepgram
WS   /ws/events?session_id=xxx            — push events to browser
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict

import uvicorn
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from audio_processor import AudioProcessor
from config import settings
from routers.session import router as session_router
from session_manager import session_manager
from websocket_manager import ws_manager

# ── logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── per-session audio processors (session_id → AudioProcessor) ────────────────
_audio_processors: Dict[str, AudioProcessor] = {}


# ── lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "🎙️  Voice Agent backend starting — host=%s port=%d",
        settings.host,
        settings.port,
    )
    yield
    # Gracefully stop all active audio processors on shutdown
    logger.info("Shutting down — closing %d active processor(s)…", len(_audio_processors))
    await asyncio.gather(
        *[proc.stop() for proc in _audio_processors.values()],
        return_exceptions=True,
    )
    _audio_processors.clear()
    logger.info("Shutdown complete.")


# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Real-Time Voice Recognition & Speaker Tracking API",
    description=(
        "Streams microphone audio to Deepgram, performs multi-speaker diarisation, "
        "and pushes labelled transcript events over WebSocket."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST router ───────────────────────────────────────────────────────────────

app.include_router(session_router, prefix="/api")




# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/health", tags=["meta"])
async def health() -> JSONResponse:
    """Liveness probe used by load balancers / CI."""
    return JSONResponse(
        {
            "status": "ok",
            "active_sessions": session_manager.active_count(),
            "connected_audio_processors": len(_audio_processors),
        }
    )


# ── WebSocket: audio ingress (/ws/audio) ──────────────────────────────────────


@app.websocket("/ws/audio")
async def ws_audio(
    websocket: WebSocket,
    session_id: str = Query(..., description="Session ID from POST /api/session/start"),
):
    """
    Browser → Backend audio stream.

    The browser should:
    1. Obtain a session_id from POST /api/session/start.
    2. Open a WebSocket to ws://<host>/ws/audio?session_id=<id>.
    3. Send raw PCM-16 mono 16 kHz binary frames continuously.
    4. Close the WebSocket when the user stops recording.

    Audio frames are forwarded to Deepgram in real time.
    Transcript events are pushed back via /ws/events.
    """
    # Validate session
    session = session_manager.get_session(session_id)
    if session is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unknown session_id")
        return

    if not session.active:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION, reason="Session is no longer active"
        )
        return

    await websocket.accept()
    logger.info("WS /ws/audio accepted — session=%s", session_id)

    # Create or reuse the AudioProcessor for this session
    if session_id not in _audio_processors:
        processor = AudioProcessor(session)
        _audio_processors[session_id] = processor
    else:
        processor = _audio_processors[session_id]

    # Connect to Deepgram (idempotent)
    try:
        await processor.start()
    except Exception as exc:
        logger.exception("Failed to start AudioProcessor for session %s: %s", session_id, exc)
        await ws_manager.send_error(session_id, f"Failed to connect to Deepgram: {exc}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Deepgram connection failed")
        return

    # ── receive loop ──────────────────────────────────────────────────────────
    try:
        while True:
            data = await websocket.receive()

            if data.get("type") == "websocket.disconnect":
                break

            # Support both binary and text frames (text frames are control messages)
            if "bytes" in data and data["bytes"]:
                await processor.process_audio_chunk(data["bytes"])
            elif "text" in data and data["text"]:
                _handle_control_message(data["text"], session_id)

    except WebSocketDisconnect as exc:
        logger.info(
            "WS /ws/audio disconnected — session=%s  code=%s",
            session_id,
            exc.code,
        )
    except Exception as exc:
        logger.exception(
            "WS /ws/audio unexpected error — session=%s: %s",
            session_id,
            exc,
        )
        await ws_manager.send_error(session_id, f"Audio stream error: {exc}")
    finally:
        # Stop Deepgram connection; keep AudioProcessor registered so the
        # session remains queryable (transcript is still in session state).
        await processor.stop()
        _audio_processors.pop(session_id, None)
        logger.info("WS /ws/audio cleaned up — session=%s", session_id)


def _handle_control_message(text: str, session_id: str) -> None:
    """Handle optional text-frame control messages from the browser."""
    import json as _json

    try:
        msg = _json.loads(text)
        mtype = msg.get("type", "")
        if mtype == "ping":
            pass  # keep-alive; no action needed
        else:
            logger.debug(
                "WS /ws/audio unknown control message type '%s' — session=%s",
                mtype,
                session_id,
            )
    except Exception:
        logger.debug(
            "WS /ws/audio received non-JSON text frame — session=%s", session_id
        )


# ── WebSocket: event push (/ws/events) ────────────────────────────────────────


@app.websocket("/ws/events")
async def ws_events(
    websocket: WebSocket,
    session_id: str = Query(..., description="Session ID to subscribe to"),
):
    """
    Backend → Browser event stream.

    The browser opens this WebSocket to receive pushed events:
    - speaker_change   (new speaker detected)
    - transcript       (interim and final segments)
    - speaker_list     (updated list of all speakers)
    - session_start / session_stop
    - status           (info/warning/error status messages)
    - error            (processing errors)

    This WebSocket is read-only from the browser perspective.
    """
    session = session_manager.get_session(session_id)
    if session is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unknown session_id")
        return

    # Register and accept the connection
    await ws_manager.add_event_client(session_id, websocket)
    logger.info("WS /ws/events connected — session=%s", session_id)

    # Immediately send a session_start event so the browser can initialise its UI
    await ws_manager.send_session_start(session_id)

    # Send current speaker list if speakers are already registered
    if session.speakers:
        await ws_manager.send_speaker_list(session_id, list(session.speakers.keys()))

    # ── hold connection open until client disconnects ─────────────────────────
    try:
        while True:
            # We don't expect data from the client on this channel; just keep alive.
            data = await websocket.receive()
            if data.get("type") == "websocket.disconnect":
                break
            # Echo ping frames if the browser sends them
            if data.get("text") == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect as exc:
        logger.info(
            "WS /ws/events disconnected — session=%s  code=%s",
            session_id,
            exc.code,
        )
    except Exception as exc:
        logger.exception(
            "WS /ws/events unexpected error — session=%s: %s",
            session_id,
            exc,
        )
    finally:
        await ws_manager.remove_event_client(session_id, websocket)
        logger.info("WS /ws/events cleaned up — session=%s", session_id)


# ── Static files (fallback for built frontend) ──────────────────────────────
_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
    logger.info("Serving frontend from %s", _frontend_dist)


# ── entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info",
    )
