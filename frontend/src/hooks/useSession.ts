// ─────────────────────────────────────────────────────────────────────────────
//  useSession.ts — Main session state management with useReducer
// ─────────────────────────────────────────────────────────────────────────────

import { useReducer, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { voiceAgentWS } from '../services/websocket';
import { audioCapture } from '../services/audioCapture';
import { SPEAKER_COLORS, DURATION_TICK_MS } from '../utils/constants';
import { genId, formatTimestamp, formatDuration } from '../utils/formatters';
import type { SessionState, Speaker, TranscriptSegment, WSEvent } from '../types';

// ── State shape ───────────────────────────────────────────────────────────────

const initialState: SessionState = {
  sessionId: null,
  status: 'idle',
  currentSpeaker: null,
  speakers: [],
  transcript: [],
  duration: 0,
  language: 'Auto',
  error: null,
};

// ── Action types ──────────────────────────────────────────────────────────────

type Action =
  | { type: 'SESSION_CONNECTING' }
  | { type: 'SESSION_STARTED'; sessionId: string }
  | { type: 'SESSION_STOPPING' }
  | { type: 'SESSION_STOPPED' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'TICK_DURATION' }
  | { type: 'SPEAKER_CHANGE'; speaker: Speaker }
  | { type: 'TRANSCRIPT_ADD'; segment: TranscriptSegment }
  | { type: 'TRANSCRIPT_UPDATE'; segmentId: string; text: string; isFinal: boolean }
  | { type: 'SPEAKER_LIST'; speakers: Speaker[] }
  | { type: 'SET_LANGUAGE'; language: string }
  | { type: 'RESET' };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'SESSION_CONNECTING':
      return { ...initialState, status: 'connecting' };

    case 'SESSION_STARTED':
      return { ...state, status: 'live', sessionId: action.sessionId, error: null };

    case 'SESSION_STOPPING':
      return { ...state, status: 'stopping' };

    case 'SESSION_STOPPED':
      return { ...state, status: 'stopped', currentSpeaker: null };

    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error };

    case 'TICK_DURATION':
      return { ...state, duration: state.duration + 1 };

    case 'SPEAKER_CHANGE': {
      const speaker = action.speaker;
      // Upsert into speakers list
      const existing = state.speakers.find((s) => s.id === speaker.id);
      const speakers = existing
        ? state.speakers.map((s) => (s.id === speaker.id ? { ...s, lastSeen: speaker.lastSeen } : s))
        : [...state.speakers, speaker];
      return { ...state, currentSpeaker: speaker, speakers };
    }

    case 'TRANSCRIPT_ADD': {
      const segment = action.segment;
      // Update speaker's lastSeen and segmentCount
      const speakers = state.speakers.map((s) =>
        s.id === segment.speakerId
          ? { ...s, lastSeen: segment.timestamp, segmentCount: s.segmentCount + 1 }
          : s,
      );
      return {
        ...state,
        transcript: [...state.transcript, segment],
        speakers,
        language: segment.language ?? state.language,
      };
    }

    case 'TRANSCRIPT_UPDATE': {
      const transcript = state.transcript.map((seg) =>
        seg.id === action.segmentId
          ? { ...seg, text: action.text, isFinal: action.isFinal }
          : seg,
      );
      return { ...state, transcript };
    }

    case 'SPEAKER_LIST': {
      // Merge incoming list (backend may send full list at once)
      const mergedMap = new Map<string, Speaker>();
      state.speakers.forEach((s) => mergedMap.set(s.id, s));
      action.speakers.forEach((s) => mergedMap.set(s.id, s));
      return { ...state, speakers: Array.from(mergedMap.values()) };
    }

    case 'SET_LANGUAGE':
      return { ...state, language: action.language };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ── Speaker helpers ───────────────────────────────────────────────────────────

/**
 * Derive a Speaker object from an event, assigning a deterministic color
 * based on the numeric suffix of the speaker ID.
 */
function buildSpeaker(
  id: string,
  label: string,
  color?: string,
  existingIndex?: number,
): Speaker {
  const colorIndex =
    existingIndex !== undefined
      ? existingIndex
      : parseInt(id.replace(/\D/g, '') || '0', 10) % SPEAKER_COLORS.length;

  return {
    id,
    label,
    color: color ?? SPEAKER_COLORS[colorIndex],
    segmentCount: 0,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const durationTimerRef  = useRef<number | null>(null);
  const stateRef          = useRef(state);
  stateRef.current = state;

  // ── Duration timer ────────────────────────────────────────────────────────

  const startDurationTimer = useCallback(() => {
    durationTimerRef.current = window.setInterval(() => {
      dispatch({ type: 'TICK_DURATION' });
    }, DURATION_TICK_MS);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current !== null) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDurationTimer();
      voiceAgentWS.disconnect();
      audioCapture.stop();
    };
  }, [stopDurationTimer]);

  // ── Event handler ─────────────────────────────────────────────────────────

  const handleWSEvent = useCallback((event: WSEvent) => {
    const now = new Date().toISOString();

    switch (event.type) {
      case 'session_start':
        // Backend confirmed session start — already handled in startSession
        break;

      case 'speaker_change': {
        const id    = event.speaker_id    ?? 'speaker_0';
        const label = event.speaker_label ?? `Speaker ${id.replace(/\D/g, '') || '0'}`;
        const color = event.speaker_color;
        const idx   = parseInt(id.replace(/\D/g, '') || '0', 10) % SPEAKER_COLORS.length;
        const speaker = buildSpeaker(id, label, color, idx);
        dispatch({ type: 'SPEAKER_CHANGE', speaker });
        break;
      }

      case 'transcript': {
        const speakerId    = event.speaker_id    ?? 'speaker_0';
        const speakerLabel = event.speaker_label ?? `Speaker ${speakerId.replace(/\D/g, '') || '0'}`;
        const idx          = parseInt(speakerId.replace(/\D/g, '') || '0', 10) % SPEAKER_COLORS.length;
        const segmentColor = event.speaker_color ?? SPEAKER_COLORS[idx];

        const segment: TranscriptSegment = {
          id:           event.segment_id  ?? genId(),
          speakerId,
          speakerLabel,
          text:         event.text        ?? '',
          startTime:    event.start_time  ?? 0,
          endTime:      event.end_time    ?? 0,
          language:     event.language,
          isFinal:      event.is_final    ?? true,
          timestamp:    event.timestamp   ?? now,
          color:        segmentColor,
        };

        // If it already exists (non-final update), replace it; else add
        const existing = stateRef.current.transcript.find((s) => s.id === segment.id);
        if (existing) {
          dispatch({
            type: 'TRANSCRIPT_UPDATE',
            segmentId: segment.id,
            text: segment.text,
            isFinal: segment.isFinal,
          });
        } else {
          // Also ensure speaker is in the list
          const knownSpeaker = stateRef.current.speakers.find((s) => s.id === speakerId);
          if (!knownSpeaker) {
            const speaker = buildSpeaker(speakerId, speakerLabel, segmentColor, idx);
            dispatch({ type: 'SPEAKER_CHANGE', speaker });
          }
          dispatch({ type: 'TRANSCRIPT_ADD', segment });
        }
        break;
      }

      case 'speaker_list':
        if (Array.isArray(event.speakers)) {
          const validSpeakers: Speaker[] = event.speakers.map((s: any, idx: number) => {
            if (typeof s === 'string') {
              const num = s.replace(/\D/g, '') || String(idx + 1);
              return buildSpeaker(`speaker_${num}`, s, undefined, idx);
            }
            const sId = s.id || `speaker_${idx + 1}`;
            const sLabel = s.label || `Speaker ${idx + 1}`;
            return buildSpeaker(sId, sLabel, s.color, idx);
          });
          dispatch({ type: 'SPEAKER_LIST', speakers: validSpeakers });
        }
        break;

      case 'error':
        dispatch({ type: 'SET_ERROR', error: event.message ?? 'Unknown error' });
        break;

      case 'status':
        // Generic status message — can be surfaced via error field momentarily
        if (event.message) {
          console.info('[Session status]', event.message);
        }
        break;

      case 'session_stop':
        dispatch({ type: 'SESSION_STOPPED' });
        stopDurationTimer();
        break;

      default:
        console.warn('[useSession] unknown event type', event);
    }
  }, [stopDurationTimer]);

  // ── startSession ──────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    dispatch({ type: 'SESSION_CONNECTING' });

    try {
      // 1. Create session on backend
      const { session_id } = await api.startSession();

      // 2. Open WebSockets
      voiceAgentWS.connect(session_id, handleWSEvent);

      // 3. Start microphone capture and pipe audio to the audio WebSocket
      await audioCapture.start((chunk: ArrayBuffer) => {
        voiceAgentWS.sendAudio(chunk);
      });

      // 4. Mark live and start the duration counter
      dispatch({ type: 'SESSION_STARTED', sessionId: session_id });
      startDurationTimer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  }, [handleWSEvent, startDurationTimer]);

  // ── stopSession ───────────────────────────────────────────────────────────

  const stopSession = useCallback(async () => {
    dispatch({ type: 'SESSION_STOPPING' });
    stopDurationTimer();

    try {
      // 1. Stop mic capture
      audioCapture.stop();

      // 2. Notify backend
      if (stateRef.current.sessionId) {
        await api.stopSession(stateRef.current.sessionId);
      }
    } catch (err) {
      console.error('[useSession] stopSession error', err);
    } finally {
      // 3. Close WebSockets regardless
      voiceAgentWS.disconnect();
      dispatch({ type: 'SESSION_STOPPED' });
    }
  }, [stopDurationTimer]);

  // ── downloadTranscript ────────────────────────────────────────────────────

  const downloadTranscript = useCallback(() => {
    const { transcript, sessionId, duration } = stateRef.current;

    if (transcript.length === 0) return;

    const lines: string[] = [
      `VoiceTrack Transcript`,
      `Session: ${sessionId ?? 'N/A'}`,
      `Duration: ${formatDuration(duration)}`,
      `Exported: ${new Date().toLocaleString()}`,
      ``,
      `═══════════════════════════════════════`,
      ``,
    ];

    transcript.forEach((seg) => {
      lines.push(`[${formatTimestamp(seg.timestamp)}] ${seg.speakerLabel}`);
      lines.push(seg.text);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `voicetrack-transcript-${sessionId ?? Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    state,
    startSession,
    stopSession,
    downloadTranscript,
  };
}
