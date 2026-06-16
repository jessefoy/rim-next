"use client";

/**
 * RnnoiseAudioProcessor — custom LiveKit audio TrackProcessor that runs the
 * outgoing mic through RNNoise (xiph/rnnoise) for AI noise suppression.
 *
 * This is the in-browser replacement for LiveKit Cloud's Krisp NC, which went
 * inactive when RIM self-hosted LiveKit (session 150 — Krisp BVC is Cloud-only).
 * RNNoise is a light, proven WebRTC-grade denoiser that runs on every device
 * (including older iPads) — see RIM_SessionRoom.md "Audio & echo" for the
 * RNNoise-vs-DeepFilterNet decision.
 *
 * Implements the TrackProcessor<Track.Kind.Audio> shape from livekit-client
 * (structurally, like BrightnessProcessor does for video). LiveKit calls
 * init() with the captured mic MediaStreamTrack and publishes processedTrack.
 *
 * Graph:  mic source ─▶ RnnoiseWorkletNode ─▶ MediaStreamDestination ─▶ published
 *         (Bell mode bypasses the RNNoise node:  mic source ─▶ destination)
 *
 * Echo cancellation is unaffected: browser AEC is applied at capture (upstream
 * of this graph) exactly as it was with Krisp — see RIM_SessionRoom.md.
 *
 * Assets are served statically from /public/noise (copied verbatim from
 * @sapphi-red/web-noise-suppressor@0.3.5 dist — re-copy if that package is
 * upgraded). RNNoise assumes 48 kHz, so we always run our own 48 kHz
 * AudioContext rather than trust LiveKit's (a Mac default context can be
 * 44.1 kHz, which would feed the model the wrong rate).
 *
 * Browser-only: the package's worklet classes extend AudioWorkletNode at
 * module scope, which is undefined in Node. Safe here because the whole
 * VideoRoom subtree mounts via next/dynamic { ssr: false } — do NOT import
 * this module (or useNoiseFilter) into a server-rendered path.
 */

import { RnnoiseWorkletNode, loadRnnoise } from "@sapphi-red/web-noise-suppressor";

const WORKLET_URL = "/noise/rnnoise-worklet.js";
const WASM_URL = "/noise/rnnoise.wasm";
const WASM_SIMD_URL = "/noise/rnnoise_simd.wasm";

/** Processor name — used to detect an already-attached processor on a track. */
export const RNNOISE_PROCESSOR_NAME = "rim-rnnoise";

/** The subset of LiveKit's AudioProcessorOptions this processor reads. The
 *  full type isn't root-exported by livekit-client; structural typing keeps
 *  us off the internal deep-import path and still satisfies setProcessor(). */
type AudioProcessorInit = { track: MediaStreamTrack; audioContext?: AudioContext };

// The WASM binary is identical for every participant and never changes within a
// page load — fetch it once (loadRnnoise picks the SIMD build when supported)
// and reuse across attach/device-change so re-attaching doesn't refetch ~150 KB.
let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;
function getWasmBinary(): Promise<ArrayBuffer> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = loadRnnoise({ url: WASM_URL, simdUrl: WASM_SIMD_URL });
  }
  return wasmBinaryPromise;
}

export class RnnoiseAudioProcessor {
  name = RNNOISE_PROCESSOR_NAME;
  processedTrack: MediaStreamTrack | undefined;

  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private rnnoise: RnnoiseWorkletNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  // NC on by default; Bell mode flips this to false (bypass — bells pass raw).
  private enabled = true;

  async init(opts: AudioProcessorInit): Promise<void> {
    // Own 48 kHz context (RNNoise requirement). The source node resamples the
    // device mic to 48 kHz automatically.
    const ctx = new AudioContext({ sampleRate: 48000 });
    if (ctx.state === "suspended") {
      // init runs from the user's unmute gesture, so resume should succeed; a
      // still-suspended context would publish silence, so surface a failure
      // (notably for the iOS/iPad smoke test) rather than swallow it.
      await ctx.resume().catch((e) =>
        console.warn("[rim-nc] AudioContext resume failed — mic may be silent:", e),
      );
    }
    this.ctx = ctx;

    const wasmBinary = await getWasmBinary();
    await ctx.audioWorklet.addModule(WORKLET_URL);

    this.source = ctx.createMediaStreamSource(new MediaStream([opts.track]));
    this.rnnoise = new RnnoiseWorkletNode(ctx, { wasmBinary, maxChannels: 1 });
    this.dest = ctx.createMediaStreamDestination();
    this.dest.channelCount = 1; // voice is mono
    this.wire();
    this.processedTrack = this.dest.stream.getAudioTracks()[0];
  }

  /** Connect the graph for the current enabled/bypass state. Disconnecting the
   *  RNNoise node on bypass also stops its worklet from processing (no input/
   *  output edges → not pulled), so Bell mode costs nothing. processedTrack
   *  identity never changes, so toggling needs no LiveKit renegotiation. */
  private wire(): void {
    if (!this.source || !this.rnnoise || !this.dest) return;
    this.source.disconnect();
    this.rnnoise.disconnect();
    if (this.enabled) {
      this.source.connect(this.rnnoise);
      this.rnnoise.connect(this.dest);
    } else {
      this.source.connect(this.dest);
    }
  }

  /** NC on (true) ↔ Bell mode / bypass (false). Safe to call before init —
   *  the flag is applied when the graph is built. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.wire();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async restart(opts: AudioProcessorInit): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    try { this.source?.disconnect(); } catch { /* already gone */ }
    try { this.rnnoise?.disconnect(); } catch { /* already gone */ }
    try { this.rnnoise?.destroy(); } catch { /* already gone */ }
    try { this.dest?.disconnect(); } catch { /* already gone */ }
    this.processedTrack?.stop();
    try { await this.ctx?.close(); } catch { /* already closed */ }
    this.source = null;
    this.rnnoise = null;
    this.dest = null;
    this.ctx = null;
    this.processedTrack = undefined;
  }
}
