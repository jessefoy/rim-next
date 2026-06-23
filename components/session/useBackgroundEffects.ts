"use client";

/**
 * useBackgroundEffects — wires @livekit/track-processors' BackgroundProcessor
 * onto the local CAMERA track and exposes the state the Settings panel needs.
 *
 * Mirrors useNoiseFilter (which does the same for the mic + RNNoise), with the
 * differences video brings:
 *   - The processor attaches when the CAMERA publishes. Members join camera-off,
 *     so there's no video track until they turn it on; we attach then. (A camera
 *     device change keeps the SAME track — LiveKit rebinds the processor
 *     internally on restart — so it does not go through the publish path.)
 *   - Three modes: "none" (no processor — full CPU back), "blur" (adjustable
 *     radius) and "image" (a virtual-background scene). Switching between blur
 *     and image uses the wrapper's switchTo() for an artifact-free transition;
 *     going to "none" fully detaches+destroys the processor so a device that
 *     doesn't want the effect pays zero cost.
 *   - Off by default. The choice persists in localStorage (like device prefs) so
 *     a member who wants blur keeps it across sessions.
 *   - Graceful degradation: if LiveKit reports the encoder is CPU-constrained
 *     (LocalTrackCpuConstrained), we drop the effect to keep video smooth and
 *     surface a note — the user can re-enable. Never let an effect tank video.
 *   - `available` reflects supportsBackgroundProcessors(); false hides the whole
 *     section rather than offer a control that can't run (older devices/browsers).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track, LocalVideoTrack, ParticipantEvent } from "livekit-client";
import type { LocalTrackPublication } from "livekit-client";
import { BackgroundProcessor, supportsBackgroundProcessors } from "@livekit/track-processors";
import {
  SEGMENTATION_ASSET_PATHS,
  BLUR_RADIUS_DEFAULT,
  BACKGROUND_PROCESSOR_NAME,
} from "@/lib/backgroundProcessorConfig";

export type BackgroundMode = "none" | "blur" | "image";

export interface BackgroundEffectsState {
  /** Browser can run background processors. False hides the whole UI section. */
  available: boolean;
  mode: BackgroundMode;
  blurRadius: number;
  imagePath: string | null;
  /** True while attaching/switching — disables the controls. */
  pending: boolean;
  /** The effect was auto-dropped because the device is CPU-constrained. */
  cpuPaused: boolean;
  setNone: () => void;
  setBlur: (radius?: number) => void;
  setImage: (path: string) => void;
  setBlurRadius: (radius: number) => void;
  /** Switch the camera device safely — detaches the processor first so
   *  LiveKit's in-switch processor.restart() can't blank the tile (Safari). */
  switchCamera: (deviceId: string) => Promise<boolean>;
}

type BgProcessor = ReturnType<typeof BackgroundProcessor>;

interface Desired {
  mode: BackgroundMode;
  blurRadius: number;
  imagePath: string | null;
}

const LS_KEY = "rim-background-prefs";

function readPrefs(): Desired {
  const fallback: Desired = { mode: "none", blurRadius: BLUR_RADIUS_DEFAULT, imagePath: null };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const mode: BackgroundMode = raw.mode === "blur" || raw.mode === "image" ? raw.mode : "none";
    // An "image" pref with no stored path is meaningless — fall back to none.
    if (mode === "image" && typeof raw.imagePath !== "string") return fallback;
    return {
      mode,
      blurRadius: typeof raw.blurRadius === "number" ? raw.blurRadius : BLUR_RADIUS_DEFAULT,
      imagePath: typeof raw.imagePath === "string" ? raw.imagePath : null,
    };
  } catch {
    return fallback;
  }
}

function writePrefs(d: Desired) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ mode: d.mode, blurRadius: d.blurRadius, imagePath: d.imagePath }),
    );
  } catch {
    // localStorage may be unavailable (private mode quotas etc.) — non-fatal.
  }
}

export function useBackgroundEffects(): BackgroundEffectsState {
  const room = useRoomContext();
  const processorRef = useRef<BgProcessor | null>(null);
  const desiredRef = useRef<Desired>({ mode: "none", blurRadius: BLUR_RADIUS_DEFAULT, imagePath: null });
  const supportedRef = useRef(false);
  const mountedRef = useRef(true);
  // Serialises reconciles so two rapid changes can't race setProcessor/switchTo;
  // each link reads desiredRef fresh, so the latest intent always wins.
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState<BackgroundMode>("none");
  const [blurRadius, setBlurRadiusState] = useState(BLUR_RADIUS_DEFAULT);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cpuPaused, setCpuPaused] = useState(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Feature-detect + restore the saved preference once, on the client.
  useEffect(() => {
    const ok = supportsBackgroundProcessors();
    supportedRef.current = ok;
    setAvailable(ok);
    const saved = readPrefs();
    desiredRef.current = saved;
    setMode(saved.mode);
    setBlurRadiusState(saved.blurRadius);
    setImagePath(saved.imagePath);
  }, []);

  const cameraTrack = useCallback((): LocalVideoTrack | undefined => {
    const pub = room?.localParticipant.getTrackPublication(Track.Source.Camera);
    return pub?.track instanceof LocalVideoTrack ? pub.track : undefined;
  }, [room]);

  // Reconcile the live camera track with desiredRef (one pass).
  const applyDesiredOnce = useCallback(async () => {
    if (!supportedRef.current) return;
    const track = cameraTrack();
    if (!track) return; // no camera published yet — will reconcile on publish
    if (mountedRef.current) setPending(true);
    try {
      const desired = desiredRef.current;
      // Normalise a torn "image with no path" intent to "none" — shouldn't
      // happen (setImage always sets a path; readPrefs downgrades a pathless
      // image pref), but it keeps the branches below exhaustive and stops the
      // live processor from silently diverging from desiredRef.
      const effectiveMode =
        desired.mode === "image" && !desired.imagePath ? "none" : desired.mode;
      if (effectiveMode === "none") {
        if (processorRef.current) {
          await track.stopProcessor().catch(() => {});
          processorRef.current = null;
        }
      } else if (processorRef.current) {
        // Already attached → switch mode/params without a detach (artifact-free).
        if (effectiveMode === "blur") {
          await processorRef.current.switchTo({ mode: "background-blur", blurRadius: desired.blurRadius });
        } else {
          await processorRef.current.switchTo({ mode: "virtual-background", imagePath: desired.imagePath as string });
        }
      } else {
        const proc =
          effectiveMode === "blur"
            ? BackgroundProcessor(
                { mode: "background-blur", blurRadius: desired.blurRadius, assetPaths: SEGMENTATION_ASSET_PATHS },
                BACKGROUND_PROCESSOR_NAME,
              )
            : BackgroundProcessor(
                { mode: "virtual-background", imagePath: desired.imagePath as string, assetPaths: SEGMENTATION_ASSET_PATHS },
                BACKGROUND_PROCESSOR_NAME,
              );
        await track.setProcessor(proc);
        processorRef.current = proc;
      }
    } catch (err) {
      console.error("[rim-bg] apply failed:", err);
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }, [cameraTrack]);

  const reconcile = useCallback(() => {
    chainRef.current = chainRef.current.then(() => applyDesiredOnce()).catch(() => {});
    return chainRef.current;
  }, [applyDesiredOnce]);

  const setNone = useCallback(() => {
    setCpuPaused(false);
    desiredRef.current = { ...desiredRef.current, mode: "none" };
    setMode("none");
    writePrefs(desiredRef.current);
    reconcile();
  }, [reconcile]);

  const setBlur = useCallback((radius?: number) => {
    setCpuPaused(false);
    const r = radius ?? desiredRef.current.blurRadius;
    desiredRef.current = { ...desiredRef.current, mode: "blur", blurRadius: r };
    setMode("blur");
    setBlurRadiusState(r);
    writePrefs(desiredRef.current);
    reconcile();
  }, [reconcile]);

  const setImage = useCallback((path: string) => {
    setCpuPaused(false);
    desiredRef.current = { ...desiredRef.current, mode: "image", imagePath: path };
    setMode("image");
    setImagePath(path);
    writePrefs(desiredRef.current);
    reconcile();
  }, [reconcile]);

  // Live slider — light update on the running transformer when already blurring,
  // otherwise fall back to a full reconcile (e.g. camera was off).
  const setBlurRadius = useCallback((r: number) => {
    setCpuPaused(false);
    desiredRef.current = { ...desiredRef.current, mode: "blur", blurRadius: r };
    setMode("blur");
    setBlurRadiusState(r);
    writePrefs(desiredRef.current);
    const proc = processorRef.current;
    // Cheap in-place radius update — but ONLY when the live processor is really
    // in blur mode. updateTransformerOptions({ blurRadius }) with no imagePath
    // would clear a virtual background, so anything else goes through reconcile.
    if (proc && proc.mode === "background-blur" && cameraTrack()) {
      proc.updateTransformerOptions({ blurRadius: r }).catch(() => {});
    } else {
      reconcile();
    }
  }, [cameraTrack, reconcile]);

  const switchCamera = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!room) return false;
    // Detach the processor BEFORE swapping cameras. LiveKit's restartTrack runs
    // processor.restart() mid-switch; on Safari, acquiring the new camera stops
    // the stream the processor is mid-pipeline on, the restart throws, and the
    // tile is left blank. Detaching first sidesteps that; reconcile() re-applies
    // the effect to the fresh track once the switch lands.
    const hadProcessor = !!processorRef.current;
    if (hadProcessor) {
      const track = cameraTrack();
      if (track) await track.stopProcessor().catch(() => {});
      processorRef.current = null;
    }
    try {
      await room.switchActiveDevice("videoinput", deviceId);
      return true;
    } catch (err) {
      console.error("[rim-bg] camera switch failed:", err);
      return false;
    } finally {
      if (hadProcessor) reconcile();
    }
  }, [room, cameraTrack, reconcile]);

  // Attach on camera publish; auto-drop on CPU pressure.
  useEffect(() => {
    if (!room) return;

    function onPublished(pub: LocalTrackPublication) {
      if (pub.source !== Track.Source.Camera) return;
      if (!(pub.track instanceof LocalVideoTrack)) return;
      // A fresh camera publish (camera toggled on). Any prior processor belonged
      // to the now-stopped track — drop the ref so reconcile re-attaches cleanly.
      // (A device change keeps the same track and rebinds the processor inside
      // LiveKit; it does NOT fire this event.)
      processorRef.current = null;
      reconcile();
    }

    function onCpuConstrained(_track: LocalVideoTrack, _pub: LocalTrackPublication) {
      // The encoder is struggling — shed the effect to protect video quality.
      // Keep the saved preference untouched (this is a transient device state,
      // not the user changing their mind); they can re-enable from Settings.
      if (desiredRef.current.mode === "none") return;
      setCpuPaused(true);
      desiredRef.current = { ...desiredRef.current, mode: "none" };
      setMode("none");
      reconcile();
    }

    // Camera may already be live (rejoin / already on) — reconcile now.
    if (cameraTrack()) reconcile();

    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.localParticipant.on(ParticipantEvent.LocalTrackCpuConstrained, onCpuConstrained);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, onCpuConstrained);
      // Prefer stopProcessor (detaches AND destroys) over a bare destroy() so we
      // never leave LiveKit holding a dead processor on a surviving track — the
      // same contract useNoiseFilter follows. In practice the hook unmounts only
      // when the whole room tears down, but this is cheap insurance if the phase
      // machine ever remounts mid-session.
      const track = cameraTrack();
      if (track) track.stopProcessor().catch(() => {});
      else processorRef.current?.destroy().catch(() => {});
      processorRef.current = null;
    };
  }, [room, reconcile, cameraTrack]);

  return { available, mode, blurRadius, imagePath, pending, cpuPaused, setNone, setBlur, setImage, setBlurRadius, switchCamera };
}
