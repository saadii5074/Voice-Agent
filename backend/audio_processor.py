"""
audio_processor.py — Sits between the browser WebSocket, Deepgram ASR, and Acoustic Speaker Tracker.

Pipeline
--------
Browser (PCM16 @ 16 kHz mono)  ──► AudioProcessor.process_audio_chunk()
                                         │
                                         ├──► Audio Buffer (for acoustic voice biometric tracking)
                                         ▼
                                 DeepgramStreamingClient.send_audio()
                                         │
                        Deepgram SDK callback fires
                                         ▼
                         AudioProcessor.handle_deepgram_result()
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
            SpeakerTracker                          WebSocketManager
     (Acoustic Voice Embeddings)                 (broadcast to browser)
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from deepgram_client import DeepgramStreamingClient
from session_manager import SessionState, TranscriptSegment, session_manager
from speaker_tracker import SpeakerTracker
from websocket_manager import ws_manager

logger = logging.getLogger(__name__)

BYTES_PER_SECOND = 16000 * 2  # 16kHz * 16-bit (2 bytes per sample) mono = 32000 B/s
MAX_BUFFER_SECONDS = 300       # Keep up to 5 minutes of rolling audio in memory


class AudioProcessor:
    """
    Manages the full audio pipeline and acoustic speaker tracking for a single session.
    """

    def __init__(self, session: SessionState) -> None:
        self.session = session
        self.session_id = session.session_id

        # Speaker tracking with acoustic voice embeddings
        self._speaker_tracker = SpeakerTracker(session)

        # Deepgram connection
        self._deepgram: Optional[DeepgramStreamingClient] = None
        self._deepgram_lock = asyncio.Lock()

        # Audio buffer for extracting exact utterance audio slices
        self._audio_buffer = bytearray()
        self._total_bytes_received = 0
        self._buffer_start_byte = 0
        self._deepgram_stream_start_byte: Optional[int] = None

        # Current live speaker
        self._current_speaker: Optional[str] = None

        # Stable segment IDs per (speaker, start_time)
        self._segment_ids: Dict[tuple, str] = {}

    # ── public API ────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Initialise and connect to Deepgram."""
        async with self._deepgram_lock:
            if self._deepgram is not None:
                return

            self._deepgram = DeepgramStreamingClient(
                session_id=self.session_id,
                on_transcript=self.handle_deepgram_result,
            )
            self._deepgram_stream_start_byte = self._total_bytes_received
            await self._deepgram.connect()

        await ws_manager.send_status(
            self.session_id, "Connected & listening", level="info"
        )

    async def stop(self) -> None:
        """Disconnect from Deepgram and clean up."""
        async with self._deepgram_lock:
            if self._deepgram is not None:
                await self._deepgram.disconnect()
                self._deepgram = None
        self._audio_buffer.clear()
        self._total_bytes_received = 0
        self._buffer_start_byte = 0
        self._deepgram_stream_start_byte = None

    async def process_audio_chunk(self, chunk: bytes) -> None:
        """
        Receive raw PCM16 @ 16 kHz audio chunk from browser:
        1. Append to local audio buffer for acoustic speaker identification.
        2. Forward to Deepgram for ASR.
        """
        if not chunk:
            return

        # Append to audio buffer
        self._audio_buffer.extend(chunk)
        self._total_bytes_received += len(chunk)

        if self._deepgram_stream_start_byte is None and self._deepgram is not None:
            self._deepgram_stream_start_byte = self._total_bytes_received

        # Prune buffer if it exceeds max duration to keep memory bounded
        max_bytes = int(MAX_BUFFER_SECONDS * BYTES_PER_SECOND)
        if len(self._audio_buffer) > max_bytes:
            excess = (len(self._audio_buffer) - max_bytes) // 2 * 2
            del self._audio_buffer[:excess]
            self._buffer_start_byte += excess

        if self._deepgram is None:
            return

        await self._deepgram.send_audio(chunk)

    def _get_audio_slice(self, start_t: float, end_t: float) -> bytes:
        """
        Extract the PCM16 audio bytes corresponding precisely to [start_t, end_t].
        Synchronizes Deepgram stream time with exact buffer byte positions.
        """
        if not self._audio_buffer:
            return b""

        stream_offset = getattr(self, "_deepgram_stream_start_byte", 0) or 0

        # If timestamps are valid and available
        if end_t > start_t and end_t > 0.0:
            # 50ms padding around phoneme boundaries
            padded_start = max(0.0, start_t - 0.05)
            padded_end = end_t + 0.05

            start_byte = (stream_offset + int(padded_start * BYTES_PER_SECOND)) - self._buffer_start_byte
            end_byte = (stream_offset + int(padded_end * BYTES_PER_SECOND)) - self._buffer_start_byte

            start_byte = max(0, min(len(self._audio_buffer), (start_byte // 2) * 2))
            end_byte = max(start_byte, min(len(self._audio_buffer), (end_byte // 2) * 2))

            slice_data = bytes(self._audio_buffer[start_byte:end_byte])
            if len(slice_data) >= 3200:  # At least 100ms
                return slice_data

        # Fallback: slice trailing audio matching the utterance duration (default 1.0s)
        dur = max(0.4, min(2.0, end_t - start_t if end_t > start_t else 1.0))
        num_bytes = (int(dur * BYTES_PER_SECOND) // 2) * 2
        return bytes(self._audio_buffer[-num_bytes:])

    # ── Deepgram result handler ───────────────────────────────────────────────

    async def handle_deepgram_result(self, result: Any, session_id: str) -> None:
        """
        Called for every transcript event from Deepgram.
        Extracts speech segment audio, runs acoustic voice speaker tracking,
        and broadcasts real-time speaker attribution to the frontend.
        """
        try:
            channel = result.channel
            if channel is None:
                return

            alternatives = channel.alternatives
            if not alternatives:
                return

            alternative = alternatives[0]
            transcript_text: str = alternative.transcript
            if not transcript_text.strip():
                return

            is_final: bool = result.is_final
            words = alternative.words or []

            # Determine utterance boundaries + majority-vote speaker ID from all words
            if words:
                start_t = float(getattr(words[0], "start", 0.0) or 0.0)
                end_t = float(getattr(words[-1], "end", start_t + 1.0) or start_t + 1.0)

                # Use majority-vote speaker ID across all words (more robust than words[0] only)
                speaker_ids = [
                    getattr(w, "speaker", None)
                    for w in words
                    if getattr(w, "speaker", None) is not None
                ]
                if speaker_ids:
                    # Pick the most frequent speaker ID in this utterance
                    deepgram_hint = max(set(speaker_ids), key=speaker_ids.count)
                else:
                    deepgram_hint = None
            else:
                start_t = float(getattr(result, "start", 0.0) or 0.0)
                duration = float(getattr(result, "duration", 1.0) or 1.0)
                end_t = start_t + duration
                deepgram_hint = None

            # Extract exact audio slice for this speech segment
            audio_slice = self._get_audio_slice(start_t, end_t)

            # ── Layer 1: Interim Lock vs Final Utterance Evaluation ──────────
            if not is_final:
                # Never switch or split speaker on interim speech drafts
                speaker_label = self._current_speaker or "Speaker 1"
            else:
                try:
                    speaker_label = self._speaker_tracker.track_speaker(
                        audio_chunk=audio_slice,
                        is_final=True,
                        deepgram_speaker_id=deepgram_hint,
                    )
                except Exception as e:
                    logger.warning("Session %s: speaker tracking fallback: %s", session_id, e)
                    speaker_label = self._current_speaker or "Speaker 1"

            # Detect speaker change
            if self._current_speaker != speaker_label:
                prev_speaker = self._current_speaker
                self._current_speaker = speaker_label
                self.session.current_speaker = speaker_label

                logger.info(
                    "Session %s: speaker active → %s (was: %s)",
                    session_id,
                    speaker_label,
                    prev_speaker,
                )

                # Broadcast speaker change event (updates "SPEAKER X — IS SPEAKING")
                await ws_manager.send_speaker_change(
                    session_id,
                    speaker=speaker_label,
                    previous_speaker=prev_speaker,
                )
                # Broadcast updated speaker list (updates Detected Speakers sidebar)
                await ws_manager.send_speaker_list(
                    session_id,
                    speakers=self._speaker_tracker.get_all_speakers(),
                )

            # Detect language
            language: Optional[str] = getattr(result, "detected_language", None) or "en"

            # Stable segment ID tracking for in-place interim updates
            if not is_final:
                if (
                    getattr(self, "_active_interim_id", None) is not None
                    and getattr(self, "_active_interim_speaker", None) == speaker_label
                ):
                    segment_id = self._active_interim_id
                else:
                    segment_id = str(uuid.uuid4())
                    self._active_interim_id = segment_id
                    self._active_interim_speaker = speaker_label
            else:
                if (
                    getattr(self, "_active_interim_id", None) is not None
                    and getattr(self, "_active_interim_speaker", None) == speaker_label
                ):
                    segment_id = self._active_interim_id
                    self._active_interim_id = None
                    self._active_interim_speaker = None
                else:
                    segment_id = str(uuid.uuid4())

            # Broadcast transcript event
            await ws_manager.send_transcript(
                session_id,
                speaker=speaker_label,
                text=transcript_text.strip(),
                start_time=start_t,
                end_time=end_t,
                language=language,
                is_final=is_final,
                segment_id=segment_id,
            )

            # Persist final segment in session history
            if is_final:
                segment = TranscriptSegment(
                    speaker_label=speaker_label,
                    text=transcript_text.strip(),
                    start_time=start_t,
                    end_time=end_t,
                    language=language,
                    is_final=True,
                )
                self.session.add_segment(segment)

        except Exception as exc:
            logger.exception(
                "Session %s: error handling Deepgram result: %s",
                session_id,
                exc,
            )

    # ── diagnostics ───────────────────────────────────────────────────────────

    @property
    def speaker_tracker(self) -> SpeakerTracker:
        return self._speaker_tracker

    @property
    def is_running(self) -> bool:
        return self._deepgram is not None and self._deepgram.is_connected
