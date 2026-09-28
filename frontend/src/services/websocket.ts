// ─────────────────────────────────────────────────────────────────────────────
//  websocket.ts — Dual WebSocket manager (audio sender + events receiver)
// ─────────────────────────────────────────────────────────────────────────────

import { WS_BASE, AUDIO_WS_PATH, EVENTS_WS_PATH, MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY_MS } from '../utils/constants';
import type { WSEvent, WSStatus } from '../types';

type StatusCallback = (status: WSStatus) => void;
type EventCallback  = (event: WSEvent) => void;

export class VoiceAgentWebSocket {
  private audioWs: WebSocket | null = null;
  private eventsWs: WebSocket | null = null;
  private sessionId: string | null = null;
  private onEvent: EventCallback | null = null;
  private onStatusChange: StatusCallback | null = null;

  private eventsReconnectAttempts = 0;
  private intentionalClose = false;

  private _status: WSStatus = 'disconnected';

  get status(): WSStatus {
    return this._status;
  }

  private setStatus(s: WSStatus) {
    this._status = s;
    this.onStatusChange?.(s);
  }

  /**
   * Open both WebSocket connections for the given session.
   * @param sessionId   The active session ID returned by the API
   * @param onEvent     Callback invoked for every incoming event
   * @param onStatus    Optional callback for connection status changes
   */
  connect(
    sessionId: string,
    onEvent: EventCallback,
    onStatus?: StatusCallback,
  ): void {
    this.sessionId  = sessionId;
    this.onEvent    = onEvent;
    this.onStatusChange = onStatus ?? null;
    this.intentionalClose = false;
    this.eventsReconnectAttempts = 0;

    this.setStatus('connecting');
    this._connectAudio();
    this._connectEvents();
  }

  // ── Audio WebSocket ──────────────────────────────────────────────────────

  private _connectAudio(): void {
    if (!this.sessionId) return;
    const url = `${WS_BASE}${AUDIO_WS_PATH}?session_id=${this.sessionId}`;

    try {
      this.audioWs = new WebSocket(url);
      this.audioWs.binaryType = 'arraybuffer';

      this.audioWs.onopen  = () => console.debug('[AudioWS] connected');
      this.audioWs.onerror = (e) => console.error('[AudioWS] error', e);
      this.audioWs.onclose = () => {
        if (!this.intentionalClose) {
          // Silently reconnect audio; it is less critical than events
          setTimeout(() => this._connectAudio(), RECONNECT_DELAY_MS);
        }
      };
    } catch (err) {
      console.error('[AudioWS] failed to create WebSocket', err);
    }
  }

  // ── Events WebSocket ─────────────────────────────────────────────────────

  private _connectEvents(): void {
    if (!this.sessionId) return;
    const url = `${WS_BASE}${EVENTS_WS_PATH}?session_id=${this.sessionId}`;

    try {
      this.eventsWs = new WebSocket(url);

      this.eventsWs.onopen = () => {
        console.debug('[EventsWS] connected');
        this.eventsReconnectAttempts = 0;
        this.setStatus('connected');
      };

      this.eventsWs.onmessage = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data as string) as WSEvent;
          this.onEvent?.(event);
        } catch {
          console.warn('[EventsWS] failed to parse event', e.data);
        }
      };

      this.eventsWs.onerror = (e) => {
        console.error('[EventsWS] error', e);
        this.setStatus('error');
      };

      this.eventsWs.onclose = () => {
        if (this.intentionalClose) {
          this.setStatus('disconnected');
          return;
        }

        if (this.eventsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.eventsReconnectAttempts++;
          console.warn(
            `[EventsWS] closed — reconnect attempt ${this.eventsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
          );
          this.setStatus('connecting');
          setTimeout(() => this._connectEvents(), RECONNECT_DELAY_MS);
        } else {
          console.error('[EventsWS] max reconnect attempts reached');
          this.setStatus('error');
        }
      };
    } catch (err) {
      console.error('[EventsWS] failed to create WebSocket', err);
      this.setStatus('error');
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Send a raw PCM16 audio chunk to the backend */
  sendAudio(chunk: ArrayBuffer): void {
    if (this.audioWs?.readyState === WebSocket.OPEN) {
      this.audioWs.send(chunk);
    }
  }

  /** Close both connections cleanly */
  disconnect(): void {
    this.intentionalClose = true;

    if (this.audioWs) {
      this.audioWs.close();
      this.audioWs = null;
    }
    if (this.eventsWs) {
      this.eventsWs.close();
      this.eventsWs = null;
    }

    this.sessionId = null;
    this.setStatus('disconnected');
  }
}

/** Singleton instance */
export const voiceAgentWS = new VoiceAgentWebSocket();
