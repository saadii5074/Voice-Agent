// ─────────────────────────────────────────────────────────────────────────────
//  CurrentSpeaker.tsx — Large animated display of the active speaker
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { Speaker, TranscriptSegment } from '../types';

interface Props {
  speaker: Speaker | null;
  latestSegment: TranscriptSegment | null;
  isLive: boolean;
}

export const CurrentSpeaker: React.FC<Props> = ({ speaker, latestSegment, isLive }) => {
  const labelRef = useRef<HTMLDivElement>(null);

  // Subtle flash animation on speaker change
  useEffect(() => {
    if (labelRef.current && speaker) {
      labelRef.current.style.animation = 'none';
      // Force reflow
      void labelRef.current.offsetHeight;
      labelRef.current.style.animation = 'fade-in 0.3s ease';
    }
  }, [speaker?.id]);

  if (!isLive) {
    return (
      <div style={styles.container}>
        <div style={styles.idleState}>
          <MicOff size={32} color="var(--text-muted)" />
          <p style={styles.idleText}>Session not started</p>
          <p style={styles.idleSubtext}>Press START LIVE SESSION to begin</p>
        </div>
      </div>
    );
  }

  if (!speaker) {
    return (
      <div style={styles.container}>
        <div style={styles.idleState}>
          <div style={styles.waitingPulse}>
            <Mic size={24} color="var(--primary)" />
          </div>
          <p style={styles.waitingText}>Waiting for speech...</p>
          <p style={styles.idleSubtext}>Start speaking to detect speakers</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, borderColor: `${speaker.color}40` }}>
      {/* Glow background */}
      <div
        style={{
          ...styles.glowBg,
          background: `radial-gradient(ellipse at 50% 0%, ${speaker.color}15 0%, transparent 70%)`,
        }}
      />

      <div style={styles.innerContent} ref={labelRef}>
        {/* Pulsing avatar */}
        <div style={styles.avatarWrapper}>
          <div
            style={{
              ...styles.pulseRing,
              borderColor: speaker.color,
              animation: 'pulse-ring 1.5s cubic-bezier(0.215,0.61,0.355,1) infinite',
            }}
          />
          <div
            style={{
              ...styles.avatarCircle,
              background: `linear-gradient(135deg, ${speaker.color}, ${speaker.color}cc)`,
              boxShadow: `0 0 20px ${speaker.color}55`,
            }}
          >
            <span style={styles.avatarLetter}>
              {speaker.label.charAt(0)}
            </span>
          </div>
        </div>

        {/* Speaker name */}
        <div style={styles.speakerInfo}>
          <div style={styles.speakingBadge}>
            <span
              style={{
                ...styles.speakingDot,
                background: speaker.color,
                animation: 'pulse-dot 0.8s ease-in-out infinite',
              }}
            />
            IS SPEAKING
          </div>
          <h2 style={{ ...styles.speakerName, color: speaker.color }}>
            {speaker.label.toUpperCase()}
          </h2>
        </div>
      </div>

      {/* Latest transcript text */}
      {latestSegment && (
        <div style={styles.latestText}>
          <p style={styles.latestQuote}>
            "{latestSegment.text}"
          </p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    minHeight: '160px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    transition: 'border-color 0.4s ease',
  },
  glowBg: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    transition: 'background 0.4s ease',
  },
  innerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
    zIndex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
    width: '72px',
    height: '72px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    inset: '-8px',
    borderRadius: '50%',
    border: '2px solid',
    opacity: 0,
  },
  avatarCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    userSelect: 'none',
  },
  speakerInfo: {
    flex: 1,
  },
  speakingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  speakingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  speakerName: {
    fontSize: '28px',
    fontWeight: 800,
    letterSpacing: '0.02em',
    lineHeight: 1,
  },
  latestText: {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-md)',
    borderLeft: '3px solid var(--border)',
    zIndex: 1,
    animation: 'slide-in-up 0.25s ease',
  },
  latestQuote: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    lineHeight: 1.5,
    margin: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  idleState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
  },
  idleText: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  idleSubtext: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: 0,
  },
  waitingPulse: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(99,102,241,0.12)',
    border: '2px solid rgba(99,102,241,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse-dot 1.5s ease-in-out infinite',
  },
  waitingText: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
};

export default CurrentSpeaker;
