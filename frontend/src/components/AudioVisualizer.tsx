// ─────────────────────────────────────────────────────────────────────────────
//  AudioVisualizer.tsx — Canvas-based animated audio level visualizer
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react';

interface Props {
  audioLevel: number;       // 0–1 RMS value from the microphone
  isRecording: boolean;
  speakerColor: string;     // hex color of current speaker
}

const BAR_COUNT = 32;
const BAR_MIN_HEIGHT = 3;

export const AudioVisualizer: React.FC<Props> = ({
  audioLevel,
  isRecording,
  speakerColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef   = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const rafRef    = useRef<number | null>(null);
  const colorRef  = useRef(speakerColor);

  // Update color ref without re-triggering animation loop
  useEffect(() => {
    colorRef.current = speakerColor;
  }, [speakerColor]);

  const levelRef = useRef(audioLevel);
  useEffect(() => {
    levelRef.current = audioLevel;
  }, [audioLevel]);

  const recordingRef = useRef(isRecording);
  useEffect(() => {
    recordingRef.current = isRecording;
  }, [isRecording]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const bars = barsRef.current;
    const level = levelRef.current;
    const recording = recordingRef.current;
    const color = colorRef.current;

    const barWidth = (width - BAR_COUNT * 2) / BAR_COUNT;
    const centerY = height / 2;

    for (let i = 0; i < BAR_COUNT; i++) {
      if (recording) {
        // Natural audio-driven movement with randomness to simulate a real waveform
        const noise = (Math.random() - 0.5) * 0.5;
        const target = level * 120 * (0.4 + Math.random() * 0.6) + noise * 10;
        bars[i] = bars[i] * 0.75 + target * 0.25; // smoothing
      } else {
        // Decay toward zero
        bars[i] = bars[i] * 0.88;
      }

      const barH = Math.max(BAR_MIN_HEIGHT, bars[i]);
      const x = i * (barWidth + 2);

      // Gradient fill
      const grad = ctx.createLinearGradient(0, centerY - barH, 0, centerY + barH);
      grad.addColorStop(0, `${color}cc`);
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, `${color}cc`);

      ctx.fillStyle = recording ? grad : 'rgba(45,45,61,0.7)';

      const radius = Math.min(barWidth / 2, 3);
      const x0 = x;
      const y0 = centerY - barH;
      const w  = barWidth;
      const h  = barH * 2;

      // Rounded rectangle
      ctx.beginPath();
      ctx.moveTo(x0 + radius, y0);
      ctx.lineTo(x0 + w - radius, y0);
      ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + radius);
      ctx.lineTo(x0 + w, y0 + h - radius);
      ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - radius, y0 + h);
      ctx.lineTo(x0 + radius, y0 + h);
      ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - radius);
      ctx.lineTo(x0, y0 + radius);
      ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
      ctx.closePath();
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // Start/stop animation loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // Resize canvas to match display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    observer.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => observer.disconnect();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.label}>
        <div
          style={{
            ...styles.dot,
            background: isRecording ? speakerColor : 'var(--text-muted)',
            animation: isRecording ? 'blink 1s ease-in-out infinite' : 'none',
          }}
        />
        <span style={styles.labelText}>
          {isRecording ? 'AUDIO INPUT' : 'NO INPUT'}
        </span>
        {isRecording && (
          <span style={styles.levelText}>
            {Math.round(audioLevel * 100)}%
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '10px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    height: '80px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  labelText: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  levelText: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
    fontVariantNumeric: 'tabular-nums',
  },
  canvas: {
    flex: 1,
    width: '100%',
    display: 'block',
  },
};

export default AudioVisualizer;
