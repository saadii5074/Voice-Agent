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
        Unified Multi-Speaker Tracking (Up to max_speakers, default 3):
        - If Deepgram explicitly identified a new cluster (e.g. cluster 2 for Speaker 3),
          registers it immediately.
        - Performs acoustic biometric voice verification on audio_chunk:
          - If the voice matches a known speaker (Speaker 1, 2, or 3), attributes to that speaker.
          - If the voice is a NEW speaker (< similarity_threshold) and fewer than max_speakers
            are registered, REGISTERS THE NEW SPEAKER (Speaker 3)!
          - If all max_speakers (3) are registered, dynamically attributes to the best biometric match.
        - If audio_chunk is silent or too short (< 150ms), maintains active speaker continuity.
        """
        all_spks = self._acoustic_tracker.get_all_speakers()

        # If Deepgram explicitly detected a new speaker cluster ID (e.g. cluster 2)
        if (
            deepgram_speaker_id is not None
            and deepgram_speaker_id >= len(all_spks)
            and len(all_spks) < settings.max_speakers
        ):
            label = self._acoustic_tracker.register_speaker_for_deepgram_id(
                audio_chunk, deepgram_speaker_id
            )
            self._deepgram_to_label[deepgram_speaker_id] = label
            self.session.get_or_create_speaker_profile(label, deepgram_speaker_id)
            return label

        # Run acoustic biometric identification
        label = self._acoustic_tracker.identify_speaker_from_audio(
            audio_chunk=audio_chunk,
            is_final=is_final,
            deepgram_speaker_hint=deepgram_speaker_id,
        )

        # Update deepgram mapping if new cluster
        if deepgram_speaker_id is not None and deepgram_speaker_id not in self._deepgram_to_label:
            self._deepgram_to_label[deepgram_speaker_id] = label

        self.session.get_or_create_speaker_profile(label, deepgram_speaker_id or 0)
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
