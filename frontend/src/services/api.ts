// ─────────────────────────────────────────────────────────────────────────────
//  api.ts — HTTP REST calls to the backend
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from '../utils/constants';
import type { TranscriptSegment } from '../types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface StartSessionResponse {
  session_id: string;
  status: string;
  created_at?: string;
}

export interface StopSessionResponse {
  session_id: string;
  status: string;
  duration?: number;
  segment_count?: number;
}

export interface SessionDetails {
  session_id: string;
  status: string;
  created_at?: string;
  duration?: number;
  speakers?: string[];
}

export const api = {
  /** Create a new recording session on the backend */
  startSession: (): Promise<StartSessionResponse> =>
    request<StartSessionResponse>('/api/session/start', { method: 'POST' }),

  /** Signal the backend to finalize the session */
  stopSession: (sessionId: string): Promise<StopSessionResponse> =>
    request<StopSessionResponse>('/api/session/stop', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),

  /** Fetch the full transcript for a finished or live session */
  getTranscript: (sessionId: string): Promise<TranscriptSegment[]> =>
    request<TranscriptSegment[]>(`/api/session/${sessionId}/transcript`),

  /** Fetch metadata / status for a session */
  getSession: (sessionId: string): Promise<SessionDetails> =>
    request<SessionDetails>(`/api/session/${sessionId}`),

  /** Translate all session transcripts to English in one go */
  translateSession: (sessionId: string): Promise<{ session_id: string; translated_segments: any[] }> =>
    request<{ session_id: string; translated_segments: any[] }>(`/api/session/${sessionId}/translate`, {
      method: 'POST',
    }),
};
