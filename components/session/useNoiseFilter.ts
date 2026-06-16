"use client";

/**
 * useNoiseFilter — wires the RnnoiseAudioProcessor onto the local mic and
 * exposes the same { available, enabled, pending, toggle } shape the control
 * bar's Bell-mode trio expects (it previously came from useKrispNoiseFilter).
 *
 * NC is on by default and resets to on every join (the conference remounts, so
 * `enabled` re-initialises true). Bell mode (co-host) flips `enabled` off so
 * bells/bowls pass raw. `available` reflects browser AudioWorklet support;
 * a failed WASM/worklet load flips it false so the Bell button hides rather
 * than lie about NC state — same contract Krisp had.
 *
 * The processor attaches when the mic publishes (members join muted, so there's
 * no mic track until the first unmute). Mute/unmute keeps the same track, so
 * the processor stays attached; a device change republishes and re-attaches.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track, LocalAudioTrack } from "livekit-client";
import type { LocalTrackPublication } from "livekit-client";
import { RnnoiseAudioProcessor, RNNOISE_PROCESSOR_NAME } from "./RnnoiseAudioProcessor";

export interface NoiseFilterState {
  /** Browser supports the filter (AudioWorklet) and the WASM loaded. Gates the
   *  Bell-mode button — false hides it. */
  available: boolean;
  /** NC currently active on the local mic. Bell mode = false. */
  enabled: boolean;
  /** True while attaching/swapping — disables the Bell-mode button. */
  pending: boolean;
  /** Flip NC on ↔ off (Bell mode). */
  toggle: () => void;
}

export function useNoiseFilter(): NoiseFilterState {
  const room = useRoomContext();
  const processorRef = useRef<RnnoiseAudioProcessor | null>(null);
  // Browsers without AudioWorklet (older Safari/Firefox configs) can't run the
  // filter — start optimistic on support, flip false if a real attach fails.
  const [available, setAvailable] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [pending, setPending] = useState(false);
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  useEffect(() => {
    if (typeof AudioWorkletNode === "undefined") setAvailable(false);
  }, []);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    async function attach(track: LocalAudioTrack) {
      // Already filtered (a republish re-firing on the same track) — no-op.
      if (track.getProcessor()?.name === RNNOISE_PROCESSOR_NAME) return;
      // Tear down any prior processor (e.g. a mic device change) before the new one.
      if (processorRef.current) {
        await processorRef.current.destroy().catch(() => {});
        processorRef.current = null;
      }
      setPending(true);
      try {
        const proc = new RnnoiseAudioProcessor();
        proc.setEnabled(enabledRef.current);
        await track.setProcessor(proc); // runs proc.init() with the mic track + audio context
        if (cancelled) {
          // setProcessor already pointed the track at proc; stopProcessor both
          // detaches it from the track AND destroys it. A bare proc.destroy()
          // would leave LiveKit holding a dead processor → stranded/silent mic,
          // with the double-attach guard then refusing to re-attach.
          await track.stopProcessor().catch(() => {});
          return;
        }
        processorRef.current = proc;
        // Re-apply in case Bell mode was toggled while the WASM was loading.
        proc.setEnabled(enabledRef.current);
        setAvailable(true);
      } catch (err) {
        console.error("[rim-nc] RNNoise attach failed:", err);
        setAvailable(false);
      } finally {
        if (!cancelled) setPending(false);
      }
    }

    function onPublished(pub: LocalTrackPublication) {
      if (pub.source !== Track.Source.Microphone) return;
      if (pub.track instanceof LocalAudioTrack) attach(pub.track);
    }

    // The mic may already be live (re-mount/rejoin) — attach to it now.
    const existing = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (existing?.track instanceof LocalAudioTrack) attach(existing.track);

    room.on(RoomEvent.LocalTrackPublished, onPublished);
    return () => {
      cancelled = true;
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      processorRef.current?.destroy().catch(() => {});
      processorRef.current = null;
    };
  }, [room]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      processorRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  return { available, enabled, pending, toggle };
}
