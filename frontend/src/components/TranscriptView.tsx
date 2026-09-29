// ─────────────────────────────────────────────────────────────────────────────
//  TranscriptView.tsx — Live scrolling transcript with chat-bubble style
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { TranscriptSegment } from '../types';
import { formatTimestamp } from '../utils/formatters';

interface Props {
  segments: TranscriptSegment[];
  currentSpeakerId: string | null;
}

/** Returns true if two consecutive segments are from different speakers */
function isDifferentSpeaker(a: TranscriptSegment, b: TranscriptSegment): boolean {
  return a.speakerId !== b.speakerId;
}

export const TranscriptView: React.FC<Props> = ({ segments, currentSpeakerId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);

  // Auto-scroll to bottom whenever a new segment arrives, unless user scrolled up
  useEffect(() => {
    if (!userScrolled.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [segments.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolled.current = !atBottom;
  };

  if (segments.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <MessageSquare size={15} color="var(--primary)" />
          <span style={styles.headerTitle}>Live Transcript</span>
        </div>
        <div style={styles.emptyState}>
          <MessageSquare size={36} color="var(--border-light)" />
          <p style={styles.emptyTitle}>No transcript yet</p>
          <p style={styles.emptySubtext}>Transcript segments will appear here as speakers are detected</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <MessageSquare size={15} color="var(--primary)" />
        <span style={styles.headerTitle}>Live Transcript</span>
        <span style={styles.segmentCount}>{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
      </div>

      <div
        ref={containerRef}
        style={styles.scrollArea}
        onScroll={handleScroll}
      >
        {segments.map((seg, idx) => {
          const prev = segments[idx - 1];
          const showSpeakerHeader = !prev || isDifferentSpeaker(prev, seg);
          // Alternate alignment by speaker index derived from id
          const speakerNum = parseInt(seg.speakerId.replace(/\D/g, '') || '0', 10);
          const isRight = speakerNum % 2 !== 0;
          const isActive = seg.speakerId === currentSpeakerId;

          return (
            <div key={seg.id} style={styles.segmentWrapper}>
              {/* Speaker label header (shown once per speaker run) */}
              {showSpeakerHeader && (
                <div
                  style={{
                    ...styles.speakerHeader,
                    justifyContent: isRight ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span
                    style={{
                      ...styles.speakerDot,
                      background: seg.color,
                      boxShadow: isActive ? `0 0 8px ${seg.color}` : 'none',
                    }}
                  />
                  <span style={{ ...styles.speakerLabel, color: seg.color }}>
                    {seg.speakerLabel}
                  </span>
                  {seg.language && (
                    <span style={styles.langBadge}>{seg.language}</span>
                  )}
                  <span style={styles.timestamp}>{formatTimestamp(seg.timestamp)}</span>
                </div>
              )}

              {/* Bubble row */}
              <div
                style={{
                  ...styles.bubbleRow,
                  justifyContent: isRight ? 'flex-end' : 'flex-start',
                  animation: 'slide-in-up 0.2s ease',
                }}
              >
                <div
                  style={{
                    ...styles.bubble,
                    background: isRight
                      ? `linear-gradient(135deg, ${seg.color}22, ${seg.color}11)`
                      : 'var(--surface)',
                    borderColor: isRight ? `${seg.color}40` : 'var(--border)',
                    fontStyle: seg.isFinal ? 'normal' : 'italic',
                    color: seg.isFinal ? 'var(--text-primary)' : 'var(--text-muted)',
                    maxWidth: '75%',
                    opacity: seg.isFinal ? 1 : 0.7,
                  }}
                >
                  {seg.text}
                  {seg.originalText && seg.originalText !== seg.text && (
                    <div style={styles.originalSubtext}>
                      <span style={styles.originalBadge}>Original</span>
                      {seg.originalText}
                    </div>
                  )}
                  {!seg.isFinal && (
                    <span style={styles.interimDot}>
                      <span style={styles.dot} />
                      <span style={styles.dot} />
                      <span style={styles.dot} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '4px' }} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--surface)',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
  },
  segmentCount: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  segmentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '4px',
  },
  speakerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
    marginBottom: '2px',
  },
  speakerDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  speakerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  langBadge: {
    fontSize: '10px',
    padding: '1px 6px',
    background: 'rgba(99,102,241,0.15)',
    color: 'var(--primary)',
    borderRadius: '4px',
    border: '1px solid rgba(99,102,241,0.3)',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  timestamp: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  bubbleRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    padding: '9px 13px',
    borderRadius: '12px',
    border: '1px solid',
    fontSize: '13px',
    lineHeight: 1.55,
    wordBreak: 'break-word',
    position: 'relative',
  },
  originalSubtext: {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid var(--border)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  originalBadge: {
    fontSize: '9px',
    textTransform: 'uppercase',
    fontWeight: 700,
    letterSpacing: '0.05em',
    padding: '1px 5px',
    borderRadius: '3px',
    background: 'var(--card-hover)',
    color: 'var(--text-secondary)',
    fontStyle: 'normal',
  },
  interimDot: {
    display: 'inline-flex',
    gap: '3px',
    marginLeft: '6px',
    verticalAlign: 'middle',
  },
  dot: {
    display: 'inline-block',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'var(--text-muted)',
    animation: 'pulse-dot 1.2s ease-in-out infinite',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '40px',
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  emptySubtext: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: 0,
    textAlign: 'center',
    maxWidth: '260px',
  },
};

export default TranscriptView;
