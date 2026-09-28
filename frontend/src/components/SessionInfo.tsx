// ─────────────────────────────────────────────────────────────────────────────
//  SessionInfo.tsx — Stats panel: duration, status, speakers, language
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Clock, Users, Globe, Hash } from 'lucide-react';
import type { SessionStatus } from '../types';
import { formatDuration, truncate } from '../utils/formatters';

interface Props {
  status: SessionStatus;
  duration: number;
  speakerCount: number;
  language: string;
  sessionId: string | null;
}

export const SessionInfo: React.FC<Props> = ({
  status,
  duration,
  speakerCount,
  language,
  sessionId,
}) => {
  const isLive = status === 'live';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Session Info</span>
      </div>

      <div style={styles.grid}>
        {/* Duration */}
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <Clock size={14} color="var(--primary)" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Duration</span>
            <span
              style={{
                ...styles.statValue,
                color: isLive ? 'var(--success)' : 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background:
                  isLive ? 'var(--success)' :
                  status === 'connecting' ? 'var(--warning)' :
                  status === 'error' ? 'var(--danger)' :
                  'var(--text-muted)',
                animation: isLive ? 'blink 1.2s ease-in-out infinite' : 'none',
              }}
            />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Status</span>
            <span
              style={{
                ...styles.statValue,
                color:
                  isLive ? 'var(--success)' :
                  status === 'connecting' ? 'var(--warning)' :
                  status === 'error' ? 'var(--danger)' :
                  'var(--text-secondary)',
                textTransform: 'uppercase',
                fontSize: '11px',
                letterSpacing: '0.06em',
              }}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Speakers */}
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <Users size={14} color="var(--primary)" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Speakers</span>
            <span style={styles.statValue}>{speakerCount}</span>
          </div>
        </div>

        {/* Language */}
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <Globe size={14} color="var(--primary)" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Language</span>
            <span style={styles.statValue}>{language}</span>
          </div>
        </div>
      </div>

      {/* Session ID */}
      {sessionId && (
        <div style={styles.sessionIdRow}>
          <Hash size={11} color="var(--text-muted)" />
          <span style={styles.sessionIdText} title={sessionId}>
            {truncate(sessionId, 24)}
          </span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1px',
    background: 'var(--border)',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 12px',
    background: 'var(--card)',
  },
  statIcon: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    background: 'rgba(99,102,241,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: 0,
  },
  statLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontWeight: 500,
    letterSpacing: '0.03em',
  },
  statValue: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sessionIdRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  sessionIdText: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    letterSpacing: '0.02em',
  },
};

export default SessionInfo;
