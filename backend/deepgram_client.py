"""
deepgram_client.py — Async streaming client wrapping the Deepgram Python SDK v3.

Manages one live-transcription WebSocket connection per session.
Calls back into AudioProcessor when transcripts arrive.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, Awaitable, Any, Optional

from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

from config import settings

logger = logging.getLogger(__name__)

# Type alias for the transcript-event callback
TranscriptCallback = Callable[[Any, str], Awaitable[None]]


class DeepgramStreamingClient:
    """
    Wraps a single Deepgram async-live connection.

    Usage
    -----
    client = DeepgramStreamingClient(session_id, on_transcript_cb)
    await client.connect()
    await client.send_audio(chunk_bytes)
    ...
    await client.disconnect()
    """

    def __init__(
        self,
        session_id: str,
        on_transcript: TranscriptCallback,
    ) -> None:
        self.session_id = session_id
        self._on_transcript = on_transcript
        self._connection: Optional[Any] = None
        self._connected: bool = False
        self._lock = asyncio.Lock()

    # ── connection lifecycle ──────────────────────────────────────────────────

    async def connect(self) -> None:
        """Open a Deepgram streaming connection with diarisation enabled."""
        async with self._lock:
            if self._connected:
                logger.warning(
                    "Session %s: DeepgramStreamingClient.connect() called while "
                    "already connected — ignoring",
                    self.session_id,
                )
                return

            client = DeepgramClient(
                api_key=settings.deepgram_api_key,
                config=DeepgramClientOptions(verbose=False),
            )

            # Create an asynclive connection object
            connection = client.listen.asynclive.v("1")

            # ── event handlers ────────────────────────────────────────────────

            async def _on_transcript(self_inner: Any, result: Any, **kwargs: Any) -> None:
                """Called by Deepgram SDK for every transcript event."""
                try:
                    await self._on_transcript(result, self.session_id)
                except Exception as exc:
                    logger.exception(
                        "Session %s: error in transcript callback: %s",
                        self.session_id,
                        exc,
                    )

            async def _on_error(self_inner: Any, error: Any, **kwargs: Any) -> None:
                logger.error(
                    "Session %s: Deepgram error: %s",
                    self.session_id,
                    error,
                )

            async def _on_close(self_inner: Any, close: Any, **kwargs: Any) -> None:
                logger.info(
                    "Session %s: Deepgram connection closed: %s",
                    self.session_id,
                    close,
                )
                self._connected = False

            async def _on_open(self_inner: Any, open_event: Any, **kwargs: Any) -> None:
                logger.info(
                    "Session %s: Deepgram connection opened",
                    self.session_id,
                )

            async def _on_utterance_end(
                self_inner: Any, utterance_end: Any, **kwargs: Any
            ) -> None:
                logger.debug(
                    "Session %s: utterance end received",
                    self.session_id,
                )

            async def _on_speech_started(
                self_inner: Any, speech_started: Any, **kwargs: Any
            ) -> None:
                logger.debug(
                    "Session %s: speech started",
                    self.session_id,
                )

            # Register handlers
            connection.on(LiveTranscriptionEvents.Transcript, _on_transcript)
            connection.on(LiveTranscriptionEvents.Error, _on_error)
            connection.on(LiveTranscriptionEvents.Close, _on_close)
            connection.on(LiveTranscriptionEvents.Open, _on_open)
            connection.on(LiveTranscriptionEvents.UtteranceEnd, _on_utterance_end)
            connection.on(LiveTranscriptionEvents.SpeechStarted, _on_speech_started)

            # ── stream options ────────────────────────────────────────────────
            options = LiveOptions(
                model=settings.deepgram_model,
                language=settings.deepgram_language,
                # ── diarisation ───────────────────────────────────────────────
                diarize=True,
                # ── transcription quality ─────────────────────────────────────
                punctuate=True,
                smart_format=False,       # smart_format can drop word-level speaker data
                filler_words=False,       # reduces noise in speaker boundary detection
                # ── audio format ──────────────────────────────────────────────
                encoding=settings.deepgram_encoding,
                sample_rate=settings.deepgram_sample_rate,
                channels=settings.deepgram_channels,
                # ── streaming behaviour ───────────────────────────────────────
                interim_results=True,
                utterance_end_ms="1000",  # 1 s of silence = utterance end
                endpointing=300,          # 300 ms silence marks end of speech segment
                vad_events=True,
            )

            started = False
            last_err = None
            for attempt in range(1, 4):
                try:
                    logger.info("Session %s: connecting to Deepgram (attempt %d/3)...", self.session_id, attempt)
                    started = await connection.start(options)
                    if started:
                        break
                except Exception as exc:
                    last_err = exc
                    logger.warning("Session %s: Deepgram connect attempt %d failed: %s", self.session_id, attempt, exc)
                    await asyncio.sleep(0.5)

            if not started:
                raise RuntimeError(
                    f"Session {self.session_id}: failed to connect to Deepgram live transcription: {last_err}"
                )

            self._connection = connection
            self._connected = True
            logger.info(
                "Session %s: Deepgram streaming connection established",
                self.session_id,
            )

    async def send_audio(self, chunk: bytes) -> None:
        """Forward a raw audio chunk to Deepgram."""
        if not self._connected or self._connection is None:
            logger.warning(
                "Session %s: send_audio() called but not connected — dropping chunk "
                "(%d bytes)",
                self.session_id,
                len(chunk),
            )
            return
        try:
            await self._connection.send(chunk)
        except Exception as exc:
            logger.exception(
                "Session %s: error sending audio chunk: %s",
                self.session_id,
                exc,
            )

    async def disconnect(self) -> None:
        """Gracefully close the Deepgram connection."""
        async with self._lock:
            if not self._connected or self._connection is None:
                return
            try:
                await self._connection.finish()
                logger.info(
                    "Session %s: Deepgram connection closed gracefully",
                    self.session_id,
                )
            except Exception as exc:
                logger.warning(
                    "Session %s: error closing Deepgram connection: %s",
                    self.session_id,
                    exc,
                )
            finally:
                self._connected = False
                self._connection = None

    # ── properties ────────────────────────────────────────────────────────────

    @property
    def is_connected(self) -> bool:
        return self._connected
