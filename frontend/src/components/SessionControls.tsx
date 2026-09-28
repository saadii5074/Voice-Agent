// ─────────────────────────────────────────────────────────────────────────────
//  SessionControls.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Play, Square, Download, Loader2, Radio } from 'lucide-react';
import type { SessionStatus } from '../types';

interface Props {
  status: SessionStatus;
  onStart: () => void;
  onStop: () => void;
  onDownload: () => void;
  transcriptCount: number;
}

const statusLabels: Record<SessionStatus, string> = {
  idle:       'Ready to start',
  connecting: 'Connecting...',
  live:       'LIVE',
  stopping:   'Stopping...',
  stopped:    'Session stopped',
  error:      'Error occurred',
};

export const SessionControls: React.FC<Props> = ({
  status,
  onStart,
  onStop,
  onDownload,
  transcriptCount,
}) => {
  const isLive      = status === 'live';
  const isConnecting = status === 'connecting' || status === 'stopping';
  const isStopped   = status === 'stopped' || status === 'idle' || status === 'error';

  return (
    <div style={styles.container}>
      {/* Status indicator */}
      <div style={styles.statusRow}>
        {isLive && (
          <span style={styles.liveIndicator}>
            <span style={styles.liveDot} />
            REC
          </span>
        )}
        {isConnecting && (
          <Loader2
            size={14}
            color="var(--warning)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        )}
        <span
          style={{
            ...styles.statusText,
            color: isLive ? 'var(--success)' :
                   isConnecting ? 'var(--warning)' :
                   status === 'error' ? 'var(--danger)' :
                   'var(--text-secondary)',
          }}
        >
          {statusLabels[status]}
        </span>
      </div>

      {/* Main action button */}
      {isStopped && (
        <button
          style={styles.startBtn}
          onClick={onStart}
          disabled={status === 'error' && false /* allow restart */}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 8px 32px rgba(34,197,94,0.45)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 20px rgba(34,197,94,0.3)';
          }}
        >
          <Play size={18} fill="currentColor" />
          START LIVE SESSION
        </button>
      )}

      {isConnecting && (
        <button style={{ ...styles.startBtn, ...styles.disabledBtn }} disabled>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          {status === 'connecting' ? 'CONNECTING...' : 'STOPPING...'}
        </button>
      )}

      {isLive && (
        <div style={styles.liveButtons}>
          <button
            style={styles.stopBtn}
            onClick={onStop}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(135deg,#dc2626,#b91c1c)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(135deg,#ef4444,#dc2626)';
            }}
          >
            <Square size={16} fill="currentColor" />
            STOP SESSION
          </button>

          {transcriptCount > 0 && (
            <button
              style={styles.downloadBtn}
              onClick={onDownload}
              title="Download transcript as .txt"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--card-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <Download size={14} />
              Download
            </button>
          )}
        </div>
      )}

      {/* Download button when stopped */}
      {status === 'stopped' && transcriptCount > 0 && (
        <button
          style={styles.downloadBtnFull}
          onClick={onDownload}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
        >
          <Download size={16} />
          Download Transcript
        </button>
      )}

      {/* Separator with radio icon for branding */}
      <div style={styles.brandRow}>
        <Radio size={12} color="var(--primary)" />
        <span style={styles.brandText}>Real-time multi-speaker AI</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  liveIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: '20px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  liveDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#ef4444',
    animation: 'blink 1s ease-in-out infinite',
    display: 'inline-block',
  },
  statusText: {
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.03em',
  },
  startBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font)',
    width: '100%',
  },
  disabledBtn: {
    background: 'linear-gradient(135deg, #374151, #1f2937)',
    boxShadow: 'none',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  liveButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font)',
    width: '100%',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font)',
    width: '100%',
  },
  downloadBtnFull: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font)',
    width: '100%',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    marginTop: '2px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border)',
  },
  brandText: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
};

export default SessionControls;
