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
        Production 3-Layer Speaker Separation Engine:
        Layer 1: Interim Draft Protection — never switch or split speaker on interim speech.
        Layer 2: Deepgram AI Cluster Layer — deterministic mapping (0 -> Spk 1, 1 -> Spk 2, 2 -> Spk 3).
        Layer 3: Acoustic Biometric Layer — accurately separates 3 distinct voices
                 on substantial speech (>= 0.8s) even when Deepgram's streaming
                 engine assigns binary 0 or 1 cluster IDs.
        """
        # Layer 1: Interim lock — always stay on active speaker
        if not is_final:
            return self.session.current_speaker or "Speaker 1"

        all_spks = self._acoustic_tracker.get_all_speakers()

        # Initial speaker registration
        if not all_spks:
            label = "Speaker 1"
            self._acoustic_tracker.register_speaker_for_deepgram_id(audio_chunk, 0)
            if deepgram_speaker_id is not None:
                self._deepgram_to_label[deepgram_speaker_id] = label
            self.session.get_or_create_speaker_profile(label, deepgram_speaker_id or 0)
            return label

        # Layer 2: Deepgram detected an explicit new cluster (e.g. cluster 1 for Speaker 2, or cluster 2 for Speaker 3)
        if (
            deepgram_speaker_id is not None
            and deepgram_speaker_id not in self._deepgram_to_label
            and len(all_spks) < settings.max_speakers
        ):
            label = self._acoustic_tracker.register_speaker_for_deepgram_id(
                audio_chunk, deepgram_speaker_id
            )
            self._deepgram_to_label[deepgram_speaker_id] = label
            self.session.get_or_create_speaker_profile(label, deepgram_speaker_id)
            return label

        # Layer 3: Acoustic voice verification on substantial utterances (>= 0.8s)
        if len(audio_chunk) >= 12800:
            acoustic_label = self._acoustic_tracker.identify_speaker_from_audio(
                audio_chunk=audio_chunk,
                is_final=True,
                deepgram_speaker_hint=deepgram_speaker_id,
            )
            self.session.get_or_create_speaker_profile(acoustic_label, deepgram_speaker_id or 0)
            return acoustic_label

        # On short utterances (< 0.8s), trust locked Deepgram cluster or current speaker
        if deepgram_speaker_id is not None and deepgram_speaker_id in self._deepgram_to_label:
            mapped_label = self._deepgram_to_label[deepgram_speaker_id]
            self.session.get_or_create_speaker_profile(mapped_label, deepgram_speaker_id)
            return mapped_label

        label = self.session.current_speaker or "Speaker 1"
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
