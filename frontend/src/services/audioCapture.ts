// ─────────────────────────────────────────────────────────────────────────────
//  audioCapture.ts — Microphone capture → PCM16 mono @ 16 kHz
//
//  WHY we DON'T force AudioContext sampleRate:
//  Chrome's AudioContext honours { sampleRate: 16000 } on paper but the
//  underlying OS device still runs at 48 kHz; the browser resamples internally
//  which can introduce artefacts that confuse Deepgram's speaker-diarisation
//  model.  Instead we let the AudioContext run at its native rate (usually
//  48 kHz) and resample to 16 kHz ourselves before sending — giving Deepgram
//  clean, predictable audio.
// ─────────────────────────────────────────────────────────────────────────────

import { SCRIPT_PROCESSOR_BUFFER_SIZE } from '../utils/constants';

const TARGET_SAMPLE_RATE = 16000; // Deepgram expects 16 kHz

/** Resample a Float32 buffer from `fromRate` to `toRate` using linear interp */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = srcIdx - lo;
    output[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return output;
}

/** Convert a Float32 audio buffer to a signed Int16 PCM ArrayBuffer */
function float32ToInt16(buffer: Float32Array): ArrayBuffer {
  const out = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

export class AudioCapture {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  // ScriptProcessorNode is deprecated but has the widest browser support
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processorNode: ScriptProcessorNode | null = null;
  private onChunk: ((chunk: ArrayBuffer) => void) | null = null;
  private _audioLevel = 0;
  private _running = false;
  private _nativeSampleRate = TARGET_SAMPLE_RATE;

  get isRunning(): boolean {
    return this._running;
  }

  get nativeSampleRate(): number {
    return this._nativeSampleRate;
  }

  /** Returns the current RMS audio level (0–1) for visualisation */
  getAudioLevel(): number {
    return this._audioLevel;
  }

  /**
   * Request microphone access, set up Web Audio processing pipeline,
   * and start delivering PCM16 @ 16 kHz chunks to `onAudioChunk`.
   */
  async start(onAudioChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    if (this._running) return;

    this.onChunk = onAudioChunk;

    // Request mic — do NOT constrain sampleRate; let browser pick native rate
    // IMPORTANT: echoCancellation and noiseSuppression are DISABLED because
    // they treat phone speaker audio as "echo" and suppress the second speaker's
    // voice before it ever reaches Deepgram — breaking diarization on phone calls.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    // Run AudioContext at native rate (usually 44.1 or 48 kHz)
    this.audioCtx = new AudioContext();
    this._nativeSampleRate = this.audioCtx.sampleRate;
    console.debug(`[AudioCapture] native sample rate: ${this._nativeSampleRate} Hz → resampling to ${TARGET_SAMPLE_RATE} Hz`);

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

    // ScriptProcessorNode: buffer size, 1 input channel, 1 output channel
    this.processorNode = this.audioCtx.createScriptProcessor(
      SCRIPT_PROCESSOR_BUFFER_SIZE,
      1,
      1,
    );

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Compute RMS for the visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      this._audioLevel = Math.min(1.0, Math.sqrt(sum / inputData.length) * 3.0);

      // Resample from native rate → 16 kHz, then convert to PCM16
      const resampled = resample(inputData, this._nativeSampleRate, TARGET_SAMPLE_RATE);
      const pcm16 = float32ToInt16(resampled);
      this.onChunk?.(pcm16);
    };

    // Pipeline: source → processor → destination
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);

    this._running = true;
  }

  /** Stop recording and release all resources */
  stop(): void {
    if (!this._running) return;

    this.processorNode?.disconnect();
    this.gainNode?.disconnect();
    this.sourceNode?.disconnect();

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {/* ignore */});
    }

    this.stream?.getTracks().forEach((t) => t.stop());

    this.processorNode = null;
    this.gainNode = null;
    this.sourceNode = null;
    this.audioCtx = null;
    this.stream = null;
    this.onChunk = null;
    this._audioLevel = 0;
    this._running = false;
  }
}

/** Singleton instance */
export const audioCapture = new AudioCapture();
