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
        Multi-layer speaker identification & tracking:
        Layer 1: If Deepgram speaker cluster ID (0, 1, 2) is already bound, stick with it.
                 Eliminates cross-speaker confusion and flipping.
        Layer 2: If Deepgram speaker cluster ID is new, register up to max_speakers (3)
                 and bind permanently.
        Layer 3: If no Deepgram speaker ID is provided, fallback to 192-dim ECAPA-TDNN
                 biometric voice matching.
        """
        # ── Layer 1: Locked Deepgram Cluster ──────────────────────────────────
        if deepgram_speaker_id is not None and deepgram_speaker_id in self._deepgram_to_label:
            label = self._deepgram_to_label[deepgram_speaker_id]
            if is_final and len(audio_chunk) >= 9600:  # >= 300ms
                self._acoustic_tracker.update_known_speaker(label, audio_chunk)
            self.session.get_or_create_speaker_profile(label, deepgram_speaker_id)
            return label

        # ── Layer 2: New Deepgram Cluster ID ──────────────────────────────────
        if deepgram_speaker_id is not None and deepgram_speaker_id >= 0:
            all_spks = self._acoustic_tracker.get_all_speakers()
            if len(all_spks) < settings.max_speakers:
                # Still have room to register a new speaker (e.g. Speaker 2 or Speaker 3)
                label = self._acoustic_tracker.register_speaker_for_deepgram_id(
                    audio_chunk, deepgram_speaker_id
                )
                self._deepgram_to_label[deepgram_speaker_id] = label
                self.session.get_or_create_speaker_profile(label, deepgram_speaker_id)
                return label
            else:
                # All max_speakers (3) are registered:
                # Attribute this cluster to the best biometric match among the 3
                label = self._acoustic_tracker.identify_speaker_from_audio(
                    audio_chunk=audio_chunk,
                    is_final=is_final,
                    deepgram_speaker_hint=deepgram_speaker_id,
                )
                self._deepgram_to_label[deepgram_speaker_id] = label
                self.session.get_or_create_speaker_profile(label, deepgram_speaker_id)
                return label

        # ── Layer 3: Acoustic Biometric Fallback ──────────────────────────────
        label = self._acoustic_tracker.identify_speaker_from_audio(
            audio_chunk=audio_chunk,
            is_final=is_final,
            deepgram_speaker_hint=None,
        )
        self.session.get_or_create_speaker_profile(label, 0)
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
