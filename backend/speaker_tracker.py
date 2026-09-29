"""
speaker_tracker.py — Real-Time Speaker Diarization + Session-Level Speaker Tracking.

Performs immediate acoustic voice fingerprinting & similarity matching:
- Person A speaks → Speaker 1
- Person B speaks (even 1 word) → Speaker 2 (instant switch)
- Person A speaks again → Speaker 1 (matched via voice similarity)
- Person C speaks → Speaker 3
- Person B speaks again → Speaker 2
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from session_manager import SessionState
from speaker_embedding import AcousticSpeakerTracker, BIOMETRIC_SIMILARITY_THRESHOLD
from config import settings

logger = logging.getLogger(__name__)


class SpeakerTracker:
    """
    Combines acoustic voice embedding matching and session state management.
    """

    def __init__(self, session: SessionState) -> None:
        self.session: SessionState = session
        self.session_id: str = session.session_id
        self._acoustic_tracker = AcousticSpeakerTracker(
            session_id=self.session_id,
            similarity_threshold=BIOMETRIC_SIMILARITY_THRESHOLD,
            max_speakers=settings.max_speakers,
        )
        self._deepgram_to_label: Dict[int, str] = {}

    def track_speaker(
        self,
        audio_chunk: bytes,
        is_final: bool = False,
        deepgram_speaker_id: Optional[int] = None,
    ) -> str:
        """
        Identify the active speaker immediately using acoustic voice biometric matching.
        """
        label = self._acoustic_tracker.identify_speaker_from_audio(
            audio_chunk=audio_chunk,
            is_final=is_final,
            deepgram_speaker_hint=deepgram_speaker_id,
        )

        dgram_id = deepgram_speaker_id if deepgram_speaker_id is not None else -1
        if dgram_id >= 0:
            self._deepgram_to_label[dgram_id] = label

        self.session.get_or_create_speaker_profile(label, dgram_id if dgram_id >= 0 else 0)
        return label

    def get_or_create_speaker(self, deepgram_speaker_id: int) -> str:
        """Convenience lookup used by legacy paths."""
        if deepgram_speaker_id in self._deepgram_to_label:
            return self._deepgram_to_label[deepgram_speaker_id]
        all_spks = self._acoustic_tracker.get_all_speakers()
        return all_spks[-1] if all_spks else "Speaker 1"

    def get_all_speakers(self) -> List[str]:
        """Return all speaker labels in order of appearance."""
        return self._acoustic_tracker.get_all_speakers()

    def get_speaker_count(self) -> int:
        return self._acoustic_tracker.get_speaker_count()

    def reset(self) -> None:
        self._acoustic_tracker.reset()
        self._deepgram_to_label.clear()
