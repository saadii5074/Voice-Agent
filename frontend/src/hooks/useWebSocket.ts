// ─────────────────────────────────────────────────────────────────────────────
//  useWebSocket.ts — React hook wrapping VoiceAgentWebSocket
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react';
import { voiceAgentWS } from '../services/websocket';
import type { WSEvent, WSStatus } from '../types';

export function useWebSocket() {
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected');
  const onEventRef = useRef<((event: WSEvent) => void) | null>(null);

  const connect = useCallback(
    (sessionId: string, onEvent: (event: WSEvent) => void) => {
      onEventRef.current = onEvent;
      voiceAgentWS.connect(sessionId, onEvent, (s) => setWsStatus(s));
    },
    [],
  );

  const sendAudio = useCallback((chunk: ArrayBuffer) => {
    voiceAgentWS.sendAudio(chunk);
  }, []);

  const disconnect = useCallback(() => {
    voiceAgentWS.disconnect();
  }, []);

  return { wsStatus, connect, sendAudio, disconnect };
}
