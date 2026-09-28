// ─────────────────────────────────────────────────────────────────────────────
//  Constants & Configuration
// ─────────────────────────────────────────────────────────────────────────────

// In production (Railway), frontend & backend are on the same domain — use relative URLs
// In local dev, Vite proxy handles it via localhost:8000
const _isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const _proto    = window.location.protocol === 'https:' ? 'wss' : 'ws';

export const API_BASE = _isLocal ? 'http://localhost:8000' : '';
export const WS_BASE  = _isLocal ? 'ws://localhost:8000'   : `${_proto}://${window.location.host}`;

export const AUDIO_WS_PATH   = '/ws/audio';
export const EVENTS_WS_PATH  = '/ws/events';

export const MAX_RECONNECT_ATTEMPTS = 3;
export const RECONNECT_DELAY_MS     = 2000;

/** Distinct colors for up to 10 speakers */
export const SPEAKER_COLORS: string[] = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f97316', // orange
  '#14b8a6', // teal
  '#ef4444', // red
  '#84cc16', // lime
];

export const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;
export const AUDIO_SAMPLE_RATE = 16000;

/** How often to tick the session duration counter (ms) */
export const DURATION_TICK_MS = 1000;
