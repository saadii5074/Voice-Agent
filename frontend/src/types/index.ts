// ─────────────────────────────────────────────────────────────────────────────
//  TypeScript Interfaces & Types for VoiceTrack
// ─────────────────────────────────────────────────────────────────────────────

export interface Speaker {
  id: string;        // e.g. 'speaker_1'
  label: string;     // e.g. 'Speaker 1'
  color: string;     // hex color
  segmentCount: number;
  firstSeen: string; // ISO timestamp
  lastSeen: string;  // ISO timestamp
}

export interface TranscriptSegment {
  id: string;
  speakerLabel: string;
  speakerId: string;
  text: string;
  startTime: number;
  endTime: number;
  language?: string;
  isFinal: boolean;
  timestamp: string; // ISO timestamp
  color: string;     // speaker hex color
}

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface SessionState {
  sessionId: string | null;
  status: SessionStatus;
  currentSpeaker: Speaker | null;
  speakers: Speaker[];
  transcript: TranscriptSegment[];
  duration: number;  // seconds elapsed
  language: string;
  error: string | null;
}

export interface WSEvent {
  type:
    | 'speaker_change'
    | 'transcript'
    | 'session_start'
    | 'session_stop'
    | 'speaker_list'
    | 'error'
    | 'status';
  // speaker_change
  speaker_id?: string;
  speaker_label?: string;
  speaker_color?: string;
  // transcript
  segment_id?: string;
  text?: string;
  start_time?: number;
  end_time?: number;
  language?: string;
  is_final?: boolean;
  timestamp?: string;
  // speaker_list
  speakers?: Speaker[];
  // error / status
  message?: string;
  session_id?: string;
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface AudioCaptureOptions {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onError?: (err: Error) => void;
}
