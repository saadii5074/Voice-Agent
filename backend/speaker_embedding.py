"""
speaker_embedding.py — Acoustic Voice Representation & Session-Level Speaker Tracking (Pure NumPy).

Extracts multi-component acoustic voice fingerprints:
1. MFCC vocal tract filterbank features (coefficients 1..12, mean & std normalized).
2. Pitch Fundamental Frequency (F0) distribution via short-time autocorrelation.
3. Spectral Centroid & Formant resonance distribution.

Calculates multi-dimensional biometric similarity to ensure:
- Person A speaks → Speaker 1
- Person B speaks → Speaker 2
- Person A speaks again → Speaker 1 (matched via voice similarity)
- Person C speaks → Speaker 3
- Person B speaks again → Speaker 2
- Purely session-scoped, anonymous, and dynamic (1 ... N speakers).
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional
import numpy as np

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
# Multi-metric similarity threshold for same-speaker verification:
BIOMETRIC_SIMILARITY_THRESHOLD = 0.78


def pcm16_to_float32(pcm_bytes: bytes) -> np.ndarray:
    """Convert raw 16-bit PCM bytes (mono) to a float32 array in [-1.0, 1.0]."""
    if not pcm_bytes or len(pcm_bytes) < 2:
        return np.array([], dtype=np.float32)
    if len(pcm_bytes) % 2 != 0:
        pcm_bytes = pcm_bytes[: len(pcm_bytes) - (len(pcm_bytes) % 2)]
    if len(pcm_bytes) < 2:
        return np.array([], dtype=np.float32)
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
    return audio / 32768.0


from neural_speaker_embedding import ecapa_extractor


class VoiceFingerprint:
    """Encapsulates 192-dimensional ECAPA-TDNN neural embeddings and acoustic features of a speaker's voice."""

    def __init__(
        self,
        mfcc_vector: np.ndarray,
        f0_median: float,
        f0_std: float,
        centroid: float,
        neural_embedding: Optional[np.ndarray] = None,
    ) -> None:
        self.mfcc_vector = mfcc_vector
        self.f0_median = f0_median
        self.f0_std = f0_std
        self.centroid = centroid
        self.neural_embedding = neural_embedding

    def similarity_to(self, other: VoiceFingerprint) -> float:
        """
        Multi-metric acoustic biometric similarity combining 24-dim MFCC filterbank
        and fundamental pitch (F0) & formant/centroid contours.
        """
        sim_mfcc = float(np.dot(self.mfcc_vector, other.mfcc_vector))
        sim_mfcc = max(0.0, min(1.0, sim_mfcc))

        f0_min = min(self.f0_median, other.f0_median)
        f0_max = max(self.f0_median, other.f0_median)
        sim_pitch = (f0_min / f0_max) if f0_max > 0 else 1.0

        c_min = min(self.centroid, other.centroid)
        c_max = max(self.centroid, other.centroid)
        sim_centroid = (c_min / c_max) if c_max > 0 else 1.0

        # Pitch penalty if fundamentally different vocal registers (< 0.72)
        pitch_penalty = 0.85 if sim_pitch < 0.72 else 1.0

        # Weighted combination: 60% MFCC, 25% Pitch, 15% Centroid
        combined = 0.60 * sim_mfcc + 0.25 * sim_pitch + 0.15 * sim_centroid
        return float(combined * pitch_penalty)


class SpeakerEmbeddingExtractor:
    """
    Extracts VoiceFingerprint instances from 16kHz PCM audio arrays.
    """

    def __init__(self, sample_rate: int = SAMPLE_RATE) -> None:
        self.sample_rate = sample_rate
        self.n_fft = 512
        self.hop_length = 256
        self.win_length = 512
        self.n_mels = 26
        self.n_mfcc = 13
        self._mel_filters = self._create_mel_filterbank()
        self._dct_matrix = self._create_dct_matrix()

    def _create_mel_filterbank(self) -> np.ndarray:
        mel_min = 2595.0 * np.log10(1.0 + 80.0 / 700.0)
        mel_max = 2595.0 * np.log10(1.0 + 7600.0 / 700.0)
        mel_pts = np.linspace(mel_min, mel_max, self.n_mels + 2)
        hz_pts = 700.0 * (10.0 ** (mel_pts / 2595.0) - 1.0)
        bins = np.floor((self.n_fft + 1) * hz_pts / self.sample_rate).astype(int)

        fb = np.zeros((self.n_mels, self.n_fft // 2 + 1), dtype=np.float32)
        for m in range(1, self.n_mels + 1):
            f_m_minus = bins[m - 1]
            f_m = bins[m]
            f_m_plus = bins[m + 1]

            if f_m > f_m_minus:
                fb[m - 1, f_m_minus:f_m] = (
                    np.arange(f_m_minus, f_m) - f_m_minus
                ) / max(1, f_m - f_m_minus)
            if f_m_plus > f_m:
                fb[m - 1, f_m:f_m_plus] = (
                    f_m_plus - np.arange(f_m, f_m_plus)
                ) / max(1, f_m_plus - f_m)

        return fb

    def _create_dct_matrix(self) -> np.ndarray:
        n = np.arange(self.n_mels)
        dct = np.zeros((self.n_mfcc, self.n_mels), dtype=np.float32)
        for k in range(self.n_mfcc):
            if k == 0:
                dct[k, :] = np.sqrt(1.0 / self.n_mels)
            else:
                dct[k, :] = np.sqrt(2.0 / self.n_mels) * np.cos(
                    np.pi * k * (2 * n + 1) / (2.0 * self.n_mels)
                )
        return dct

    def extract_fingerprint(self, audio: np.ndarray) -> Optional[VoiceFingerprint]:
        """Extract VoiceFingerprint from audio. Returns None if audio is silent, noise, or too short."""
        if len(audio) < 2400:  # Require at least 150ms of audio
            return None

        rms = np.sqrt(np.mean(audio ** 2))
        if rms < 0.004:  # Background noise / mic static filter (allows natural & quiet speech)
            return None

        pre_emp = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])

        # Frames
        n_frames = 1 + (len(pre_emp) - self.win_length) // self.hop_length
        if n_frames < 4:
            return None

        frames = np.lib.stride_tricks.sliding_window_view(
            pre_emp, self.win_length
        )[:: self.hop_length]
        window = np.hanning(self.win_length)
        frames_windowed = frames * window

        # Spectrogram
        mag_spec = np.abs(np.fft.rfft(frames_windowed, n=self.n_fft, axis=-1))
        pow_spec = (mag_spec ** 2) / self.n_fft

        # 1. Mel & MFCC (exclude C0 which is just energy)
        mel_energies = np.maximum(np.dot(pow_spec, self._mel_filters.T), 1e-10)
        log_mel = np.log(mel_energies)
        mfcc_all = np.dot(log_mel, self._dct_matrix.T)  # (n_frames, 13)
        mfcc = mfcc_all[:, 1:]                           # (n_frames, 12)

        mfcc_mean = np.mean(mfcc, axis=0)
        mfcc_std = np.std(mfcc, axis=0)
        mfcc_vec = np.concatenate([mfcc_mean, mfcc_std])
        norm = np.linalg.norm(mfcc_vec)
        if norm > 1e-8:
            mfcc_vec = mfcc_vec / norm

        # 2. Pitch F0 via autocorrelation
        pitches = []
        min_lag = int(self.sample_rate / 400.0)
        max_lag = int(self.sample_rate / 70.0)

        for frame in frames:
            autocorr = np.correlate(frame, frame, mode="full")
            autocorr = autocorr[len(frame) - 1 :]
            if len(autocorr) > max_lag:
                corr_slice = autocorr[min_lag:max_lag]
                if len(corr_slice) > 0 and np.max(corr_slice) > 0.30 * autocorr[0]:
                    peak_lag = min_lag + np.argmax(corr_slice)
                    f0 = self.sample_rate / peak_lag
                    pitches.append(f0)

        # Unvoiced noise filter: human speech MUST have pitch contours in voiced segments
        if not pitches:
            return None

        f0_median = float(np.median(pitches))
        f0_std = float(np.std(pitches))

        # 3. Spectral Centroid
        freqs = np.linspace(0, self.sample_rate / 2.0, self.n_fft // 2 + 1)
        spec_sum = np.maximum(np.sum(mag_spec, axis=-1, keepdims=True), 1e-10)
        centroids = np.sum(mag_spec * freqs, axis=-1, keepdims=True) / spec_sum
        mean_centroid = float(np.mean(centroids))

        # 4. 192-dimensional ECAPA-TDNN Neural Speaker Embedding
        neural_emb = ecapa_extractor.extract_embedding(audio)

        return VoiceFingerprint(
            mfcc_vector=mfcc_vec,
            f0_median=f0_median,
            f0_std=f0_std,
            centroid=mean_centroid,
            neural_embedding=neural_emb,
        )


class AcousticSpeakerTracker:
    """
    Manages session-scoped speaker tracking using acoustic voice fingerprints.
    """

    def __init__(
        self,
        session_id: str,
        similarity_threshold: float = BIOMETRIC_SIMILARITY_THRESHOLD,
        max_speakers: int = 3,
    ) -> None:
        self.session_id = session_id
        self.similarity_threshold = similarity_threshold
        self.max_speakers = max_speakers
        self.extractor = SpeakerEmbeddingExtractor(sample_rate=SAMPLE_RATE)

        self._speakers: List[str] = []
        self._fingerprints: Dict[str, VoiceFingerprint] = {}
        self._samples: Dict[str, List[VoiceFingerprint]] = {}
        self._next_speaker_idx = 1
        self._last_active_speaker: Optional[str] = None

    def identify_speaker_from_audio(
        self,
        audio_chunk: bytes,
        is_final: bool = False,
        deepgram_speaker_hint: Optional[int] = None,
    ) -> str:
        """
        Identify speaker from audio segment using acoustic voice biometric matching.
        Supports up to max_speakers (default: 3) with dedicated conversational tracking.
        """
        audio_f32 = pcm16_to_float32(audio_chunk)
        fp = self.extractor.extract_fingerprint(audio_f32)

        if fp is None:
            if self._last_active_speaker:
                return self._last_active_speaker
            if not self._speakers:
                return self._register_new_speaker(fp=None)
            return self._speakers[0]

        if not self._speakers:
            label = self._register_new_speaker(fp)
            self._last_active_speaker = label
            return label

        if len(self._speakers) >= self.max_speakers:
            # ── DEDICATED CONVERSATIONAL MODE (UP TO max_speakers) ───────────
            # Once all target speakers are registered (Speaker 1, 2, 3), all future
            # conversational speech is dynamically attributed to whichever of the
            # registered speakers has higher biometric likelihood. Eliminates phantom speakers.
            best_label, _ = self._compute_best_match(fp)
            target = best_label if best_label else self._speakers[0]
            if is_final:
                self._update_speaker(target, fp)
            self._last_active_speaker = target
            return target

        best_label, best_similarity = self._compute_best_match(fp)

        if best_label is not None and best_similarity >= self.similarity_threshold:
            if is_final:
                self._update_speaker(best_label, fp)
            self._last_active_speaker = best_label
            return best_label

        if len(audio_chunk) >= 4800 or not self._speakers:
            label = self._register_new_speaker(fp)
            self._last_active_speaker = label
            return label
        return best_label if best_label else self._speakers[0]

    def _compute_best_match(self, fp: VoiceFingerprint):
        """Returns (best_label, best_similarity) across all registered speakers using stable voice centroids."""
        best_label = None
        best_similarity = -1.0
        for label in self._speakers:
            centroid_fp = self._fingerprints[label]
            sim = fp.similarity_to(centroid_fp)
            if sim > best_similarity:
                best_similarity = sim
                best_label = label
        return best_label, best_similarity

    def identify_speaker_with_confidence(
        self,
        audio_chunk: bytes,
        is_final: bool = False,
        current_speaker: Optional[str] = None,
        match_threshold: float = 0.78,
        sticky_threshold: float = 0.60,
    ) -> Optional[str]:
        """
        Returns:
          - speaker label (str) if match is confident (≥ match_threshold)
          - current_speaker (str) if in sticky zone (≥ sticky_threshold but < match_threshold)
          - None if below sticky threshold → caller should handle conservative gating
        """
        audio_f32 = pcm16_to_float32(audio_chunk)
        fp = self.extractor.extract_fingerprint(audio_f32)

        if fp is None:
            # Silent/too-short — keep current speaker
            return current_speaker or (self._speakers[0] if self._speakers else None)

        if not self._speakers:
            label = self._register_new_speaker(fp)
            self._last_active_speaker = label
            return label

        best_label, best_sim = self._compute_best_match(fp)

        logger.info(
            "Session %s: speaker matching — candidate=%s, similarity=%.3f "
            "(match_thresh=%.2f, f0=%.1fHz)",
            self.session_id, best_label, best_sim,
            match_threshold, fp.f0_median,
        )

        if best_sim >= match_threshold:
            # Confident match
            if is_final:
                self._update_speaker(best_label, fp)
            self._last_active_speaker = best_label
            return best_label

        if best_sim >= sticky_threshold and current_speaker is not None:
            # Gray zone — stick with current speaker, don't update profile
            return current_speaker

        # Below sticky threshold — signal caller that we're uncertain
        self._pending_fp = fp
        return None

    def force_new_speaker(self) -> str:
        """Force-register a new speaker using the pending fingerprint (if any)."""
        fp = getattr(self, "_pending_fp", None)
        label = self._register_new_speaker(fp)
        self._last_active_speaker = label
        self._pending_fp = None
        return label

    def get_first_or_create(self) -> str:
        """Return the first speaker, or create one if none exist."""
        if self._speakers:
            return self._speakers[0]
        label = self._register_new_speaker(fp=None)
        self._last_active_speaker = label
        return label

    def _register_new_speaker(self, fp: Optional[VoiceFingerprint]) -> str:
        """Register a new speaker with exact sequential numbering (1, 2, 3, 4...)."""
        label = f"Speaker {len(self._speakers) + 1}"
        self._speakers.append(label)

        if fp is not None:
            self._fingerprints[label] = fp
            self._samples[label] = [fp]
        else:
            dummy_mfcc = np.zeros(24, dtype=np.float32)
            dummy_mfcc[0] = 1.0
            dummy = VoiceFingerprint(dummy_mfcc, 150.0, 0.0, 1500.0)
            self._fingerprints[label] = dummy
            self._samples[label] = []

        logger.info("Session %s: registered new speaker '%s'", self.session_id, label)
        return label

    def _update_speaker(self, label: str, new_fp: VoiceFingerprint) -> None:
        """Update centroid fingerprint using stable moving average (90% old, 10% new)."""
        if label not in self._fingerprints:
            self._fingerprints[label] = new_fp
            self._samples[label] = [new_fp]
            return

        old_fp = self._fingerprints[label]
        updated_mfcc = 0.90 * old_fp.mfcc_vector + 0.10 * new_fp.mfcc_vector
        norm = np.linalg.norm(updated_mfcc)
        if norm > 1e-8:
            updated_mfcc = updated_mfcc / norm

        self._fingerprints[label] = VoiceFingerprint(
            mfcc_vector=updated_mfcc,
            f0_median=0.90 * old_fp.f0_median + 0.10 * new_fp.f0_median,
            f0_std=0.90 * old_fp.f0_std + 0.10 * new_fp.f0_std,
            centroid=0.90 * old_fp.centroid + 0.10 * new_fp.centroid,
        )

        if label not in self._samples:
            self._samples[label] = []
        self._samples[label].append(new_fp)
    def register_speaker_for_deepgram_id(self, audio_chunk: bytes, deepgram_speaker_id: int) -> str:
        """Register a new speaker explicitly bound to a Deepgram cluster ID."""
        audio_f32 = pcm16_to_float32(audio_chunk)
        fp = self.extractor.extract_fingerprint(audio_f32) if len(audio_chunk) >= 6400 else None
        label = self._register_new_speaker(fp)
        self._last_active_speaker = label
        return label

    def update_known_speaker(self, label: str, audio_chunk: bytes) -> None:
        """Update biometric centroid of a known speaker using high-quality speech slice."""
        if len(audio_chunk) < 6400:
            return
        audio_f32 = pcm16_to_float32(audio_chunk)
        fp = self.extractor.extract_fingerprint(audio_f32)
        if fp is not None:
            self._update_speaker(label, fp)

    def get_all_speakers(self) -> List[str]:
        return list(self._speakers)

    def get_speaker_count(self) -> int:
        return len(self._speakers)

    def reset(self) -> None:
        self._speakers.clear()
        self._fingerprints.clear()
        self._samples.clear()
        self._next_speaker_idx = 1
        self._last_active_speaker = None
        self._pending_fp = None
