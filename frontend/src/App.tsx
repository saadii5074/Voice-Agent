// ─────────────────────────────────────────────────────────────────────────────
//  App.tsx — Root layout: Header + 3-column main + Footer StatusBar
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

import { useSession }      from './hooks/useSession';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useWebSocket }    from './hooks/useWebSocket';

import { SessionControls } from './components/SessionControls';
import { CurrentSpeaker }  from './components/CurrentSpeaker';
import { TranscriptView }  from './components/TranscriptView';
import { SpeakerList }     from './components/SpeakerList';
import { SessionInfo }     from './components/SessionInfo';
import { StatusBar }       from './components/StatusBar';
import { AudioVisualizer } from './components/AudioVisualizer';

import { SPEAKER_COLORS }  from './utils/constants';

function App() {
  const {
    state,
    startSession,
    stopSession,
    downloadTranscript,
    translateAll,
    isTranslating,
    isTranslated,
  } = useSession();
  const { isCapturing, audioLevel }  = useAudioCapture();
  const { wsStatus }                 = useWebSocket();

  // Last event tracking for StatusBar
  const [lastEvent, setLastEvent]         = useState<string | null>(null);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);

  // Track events for status bar display
  const prevTranscriptLen = useRef(state.transcript.length);
  useEffect(() => {
    if (state.transcript.length > prevTranscriptLen.current) {
      const seg = state.transcript[state.transcript.length - 1];
      setLastEvent(`Transcript from ${seg.speakerLabel}`);
      setLastEventTime(seg.timestamp);
    }
    prevTranscriptLen.current = state.transcript.length;
  }, [state.transcript]);

  useEffect(() => {
    if (state.currentSpeaker) {
      setLastEvent(`Speaker change → ${state.currentSpeaker.label}`);
      setLastEventTime(new Date().toISOString());
    }
  }, [state.currentSpeaker?.id]);

  const currentSpeakerColor = state.currentSpeaker?.color ?? SPEAKER_COLORS[0];

  // Latest final transcript segment
  const latestSegment =
    [...state.transcript].reverse().find((s) => s.isFinal) ?? null;

  const isLive = state.status === 'live';

  return (
    <div style={appStyles.root}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={appStyles.header}>
        <div style={appStyles.headerLeft}>
          <div style={appStyles.logo}>
            <Mic size={18} color="#fff" />
          </div>
          <div>
            <h1 style={appStyles.appTitle}>VoiceTrack</h1>
            <p style={appStyles.appSubtitle}>Real-Time Multi-Speaker Recognition</p>
          </div>
        </div>

        {/* Header right: live pill */}
        <div style={appStyles.headerRight}>
          {isLive && (
            <div style={appStyles.livePill}>
              <span style={appStyles.livePillDot} />
              LIVE
            </div>
          )}
          <div style={appStyles.headerStat}>
            <span style={appStyles.headerStatLabel}>Speakers</span>
            <span style={appStyles.headerStatValue}>{state.speakers.length}</span>
          </div>
          <div style={appStyles.headerStat}>
            <span style={appStyles.headerStatLabel}>Segments</span>
            <span style={appStyles.headerStatValue}>{state.transcript.length}</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main style={appStyles.main}>
        {/* ── LEFT SIDEBAR ── */}
        <aside style={appStyles.sidebar}>
          <SpeakerList
            speakers={state.speakers}
            currentSpeakerId={state.currentSpeaker?.id ?? null}
          />
          <SessionInfo
            status={state.status}
            duration={state.duration}
            speakerCount={state.speakers.length}
            language={state.language}
            sessionId={state.sessionId}
          />
        </aside>

        {/* ── CENTER COLUMN ── */}
        <section style={appStyles.center}>
          <CurrentSpeaker
            speaker={state.currentSpeaker}
            latestSegment={latestSegment}
            isLive={isLive}
          />
          <AudioVisualizer
            audioLevel={audioLevel}
            isRecording={isCapturing}
            speakerColor={currentSpeakerColor}
          />
          <TranscriptView
            segments={state.transcript}
            currentSpeakerId={state.currentSpeaker?.id ?? null}
          />
        </section>

        {/* ── RIGHT COLUMN (Session Controls) ── */}
        <aside style={appStyles.rightPanel}>
          <SessionControls
            status={state.status}
            onStart={startSession}
            onStop={stopSession}
            onDownload={downloadTranscript}
            onTranslate={translateAll}
            isTranslating={isTranslating}
            isTranslated={isTranslated}
            transcriptCount={state.transcript.length}
          />
        </aside>
      </main>

      {/* ── Footer StatusBar ────────────────────────────────────────── */}
      <StatusBar
        wsStatus={wsStatus}
        sessionStatus={state.status}
        lastEvent={lastEvent}
        lastEventTime={lastEventTime}
        error={state.error}
      />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const appStyles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: 'var(--bg)',
    overflow: 'hidden',
  },

  /* Header */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '60px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--primary), #818cf8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(99,102,241,0.4)',
    flexShrink: 0,
  },
  appTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  appSubtitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    margin: 0,
    marginTop: '1px',
    letterSpacing: '0.02em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  livePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.1em',
  },
  livePillDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#ef4444',
    animation: 'blink 0.9s ease-in-out infinite',
    display: 'inline-block',
  },
  headerStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
  },
  headerStatLabel: {
    fontSize: '9px',
    color: 'var(--text-muted)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  headerStatValue: {
    fontSize: '17px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },

  /* Main 3-column layout */
  main: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    gap: '12px',
    padding: '12px',
    overflow: 'hidden',
  },

  /* Left sidebar (speakers + info) */
  sidebar: {
    width: '260px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
  },

  /* Center (speaker display + visualizer + transcript) */
  center: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
  },

  /* Right panel (Q&A + controls) */
  rightPanel: {
    width: '290px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
  },
};

export default App;
