// ─────────────────────────────────────────────────────────────────────────────
//  StatusBar.tsx — Bottom connection status bar
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Wifi, WifiOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import type { WSStatus, SessionStatus } from '../types';
import { formatTimestamp } from '../utils/formatters';

interface Props {
  wsStatus: WSStatus;
  sessionStatus: SessionStatus;
  lastEvent: string | null;
  lastEventTime: string | null;
  error: string | null;
}

const wsStatusConfig: Record<WSStatus, { icon: React.ReactNode; label: string; color: string }> = {
  connected: {
    icon: <Wifi size={13} />,
    label: 'Connected',
    color: 'var(--success)',
  },
  connecting: {
    icon: <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />,
    label: 'Connecting...',
    color: 'var(--warning)',
  },
  disconnected: {
    icon: <WifiOff size={13} />,
    label: 'Disconnected',
    color: 'var(--text-muted)',
  },
  error: {
    icon: <AlertCircle size={13} />,
    label: 'Connection error',
    color: 'var(--danger)',
  },
};

export const StatusBar: React.FC<Props> = ({
  wsStatus,
  sessionStatus,
  lastEvent,
  lastEventTime,
  error,
}) => {
  const wsCfg = wsStatusConfig[wsStatus];

  return (
    <div style={styles.bar}>
      {/* Left: WS connection status */}
      <div style={styles.section}>
        <span style={{ ...styles.wsIcon, color: wsCfg.color }}>{wsCfg.icon}</span>
        <span style={{ ...styles.wsLabel, color: wsCfg.color }}>{wsCfg.label}</span>
        <span style={styles.divider} />
        <span style={styles.sessionLabel}>
          Session:{' '}
          <span
            style={{
              color:
                sessionStatus === 'live' ? 'var(--success)' :
                sessionStatus === 'error' ? 'var(--danger)' :
                sessionStatus === 'connecting' ? 'var(--warning)' :
                'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: '10px',
            }}
          >
            {sessionStatus}
          </span>
        </span>
      </div>

      {/* Center: last event or error */}
      <div style={styles.center}>
        {error ? (
          <span style={styles.errorText}>
            <AlertCircle size={12} />
            {error}
          </span>
        ) : lastEvent ? (
          <span style={styles.eventText}>
            <CheckCircle2 size={12} color="var(--success)" />
            {lastEvent}
            {lastEventTime && (
              <span style={styles.eventTime}>{formatTimestamp(lastEventTime)}</span>
            )}
          </span>
        ) : (
          <span style={styles.placeholder}>Waiting for events…</span>
        )}
      </div>

      {/* Right: branding */}
      <div style={styles.right}>
        <span style={styles.brand}>VoiceTrack v1.0</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 20px',
    height: '36px',
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  wsIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  wsLabel: {
    fontSize: '11px',
    fontWeight: 500,
  },
  divider: {
    width: '1px',
    height: '14px',
    background: 'var(--border)',
  },
  sessionLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: 'var(--danger)',
    background: 'rgba(239,68,68,0.08)',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(239,68,68,0.2)',
    maxWidth: '500px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventText: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    maxWidth: '500px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventTime: {
    color: 'var(--text-muted)',
    fontSize: '10px',
    marginLeft: '4px',
  },
  placeholder: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  right: {
    flexShrink: 0,
  },
  brand: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
};

export default StatusBar;
