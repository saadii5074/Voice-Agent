// ─────────────────────────────────────────────────────────────────────────────
//  SpeakerList.tsx — Sidebar list of all detected speakers
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Users } from 'lucide-react';
import type { Speaker } from '../types';

interface Props {
  speakers: Speaker[];
  currentSpeakerId: string | null;
}

export const SpeakerList: React.FC<Props> = ({ speakers, currentSpeakerId }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Users size={15} color="var(--primary)" />
        <span style={styles.headerTitle}>Detected Speakers</span>
        <span style={styles.countBadge}>{speakers.length}</span>
      </div>

      <div style={styles.list}>
        {speakers.length === 0 ? (
          <div style={styles.emptyState}>
            <Users size={28} color="var(--border-light)" />
            <p style={styles.emptyText}>No speakers detected yet</p>
            <p style={styles.emptySubtext}>Speakers appear when audio is processed</p>
          </div>
        ) : (
          speakers.map((speaker) => {
            const isActive = speaker.id === currentSpeakerId;
            return (
              <div
                key={speaker.id}
                style={{
                  ...styles.speakerRow,
                  background: isActive ? `${speaker.color}12` : 'transparent',
                  borderColor: isActive ? `${speaker.color}40` : 'transparent',
                }}
              >
                {/* Avatar */}
                <div style={styles.avatarWrapper}>
                  {isActive && (
                    <div
                      style={{
                        ...styles.activeRing,
                        borderColor: speaker.color,
                      }}
                    />
                  )}
                  <div
                    style={{
                      ...styles.avatar,
                      background: `linear-gradient(135deg, ${speaker.color}, ${speaker.color}bb)`,
                      boxShadow: isActive ? `0 0 12px ${speaker.color}55` : 'none',
                    }}
                  >
                    <span style={styles.avatarText}>
                      {speaker.label.replace('Speaker ', '')}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div style={styles.speakerInfo}>
                  <div style={styles.speakerNameRow}>
                    <span
                      style={{
                        ...styles.speakerName,
                        color: isActive ? speaker.color : 'var(--text-primary)',
                      }}
                    >
                      {speaker.label}
                    </span>
                    {isActive && (
                      <span style={{ ...styles.activeBadge, color: speaker.color, borderColor: `${speaker.color}40` }}>
                        Speaking
                      </span>
                    )}
                  </div>
                  <span style={styles.segmentCount}>
                    {speaker.segmentCount} segment{speaker.segmentCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Activity dots */}
                {isActive && (
                  <div style={styles.activityDots}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.activityDot,
                          background: speaker.color,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
  },
  countBadge: {
    fontSize: '11px',
    fontWeight: 700,
    background: 'rgba(99,102,241,0.2)',
    color: 'var(--primary)',
    padding: '1px 7px',
    borderRadius: '10px',
    border: '1px solid rgba(99,102,241,0.3)',
  },
  list: {
    overflowY: 'auto',
    flex: 1,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  speakerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    transition: 'all var(--transition)',
    animation: 'slide-in-right 0.25s ease',
  },
  avatarWrapper: {
    position: 'relative',
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeRing: {
    position: 'absolute',
    inset: '-3px',
    borderRadius: '50%',
    border: '2px solid',
    animation: 'pulse-dot 1s ease-in-out infinite',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow var(--transition)',
  },
  avatarText: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
    userSelect: 'none',
  },
  speakerInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  speakerNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  speakerName: {
    fontSize: '13px',
    fontWeight: 600,
    transition: 'color var(--transition)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  activeBadge: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '1px 5px',
    borderRadius: '4px',
    border: '1px solid',
    flexShrink: 0,
  },
  segmentCount: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  activityDots: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flexShrink: 0,
  },
  activityDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    animation: 'pulse-dot 0.8s ease-in-out infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '32px 16px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  emptySubtext: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    margin: 0,
    lineHeight: 1.5,
  },
};

export default SpeakerList;
