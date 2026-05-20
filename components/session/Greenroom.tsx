"use client";

/**
 * Greenroom — pre-prompt screen that primes the user before the browser
 * asks for camera/microphone permission. Renders as a child of LiveKitRoom
 * so it can call setCameraEnabled/setMicrophoneEnabled synchronously from
 * the Continue click handler (iOS Safari requires the user-gesture chain).
 *
 * On mount it checks the Permissions API and a localStorage "joined-before"
 * flag, and either skips silently (granted state, attempt direct publish),
 * routes to Recovery (denied), or shows the priming UI.
 *
 * Auto-publish path (granted, or joined-before with prompt/unsupported):
 * happens inside an effect after the room reaches Connected. Any error
 * from a high-confidence "granted" attempt is treated as a real denial.
 * From the speculative "joined-before" attempt, any error falls back to
 * the manual UI — the user clicks Continue from a fresh gesture.
 */

import { useEffect, useRef, useState } from "react";
import {
  useLocalParticipant,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import {
  detectPlatform,
  defaultsToPerSessionPermission,
  type Platform,
} from "@/lib/detectPlatform";

const JOINED_BEFORE_KEY = "rim-livekit-joined-before";

type PermissionLookup = PermissionState | "unsupported";

async function queryPermission(name: "camera" | "microphone"): Promise<PermissionLookup> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unsupported";
  }
  try {
    const result = await navigator.permissions.query({ name: name as PermissionName });
    return result.state;
  } catch {
    return "unsupported";
  }
}

function readJoinedBefore(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(JOINED_BEFORE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeJoinedBefore() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JOINED_BEFORE_KEY, "1");
  } catch {
    // localStorage may be unavailable (private mode quotas etc.) — non-fatal.
  }
}

type Status = "checking" | "auto-publishing" | "manual" | "publishing";

interface Props {
  onJoined: () => void;
  onDenied: () => void;
}

export default function Greenroom({ onJoined, onDenied }: Props) {
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const [status, setStatus] = useState<Status>("checking");
  const [showRememberInstructions, setShowRememberInstructions] = useState(false);
  const decisionRef = useRef<"granted" | "manual" | null>(null);
  const attemptedRef = useRef(false);
  const [platform, setPlatform] = useState<Platform | null>(null);

  // Detect platform once on the client (avoids SSR/hydration mismatch).
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const showRememberDisclosure = platform ? defaultsToPerSessionPermission(platform) : false;

  // Initial permission decision — runs once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cam, mic] = await Promise.all([
        queryPermission("camera"),
        queryPermission("microphone"),
      ]);
      if (cancelled) return;

      if (cam === "denied" || mic === "denied") {
        onDenied();
        return;
      }

      // Only auto-skip the Greenroom when the Permissions API confirms both
      // tracks are already granted. The joined-before localStorage flag is
      // NOT a safe signal to skip: Safari defaults to per-session Allow, so a
      // user who clicked Allow last visit will report 'prompt' this visit.
      // Auto-publishing from a useEffect (no user gesture) with state 'prompt'
      // fires the browser prompt without the priming card visible — the exact
      // problem the Greenroom was built to prevent. Always show the manual
      // UI for non-granted states so the Continue click provides the gesture.
      if (cam === "granted" && mic === "granted") {
        decisionRef.current = "granted";
        setStatus("auto-publishing");
      } else {
        decisionRef.current = "manual";
        setStatus("manual");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDenied]);

  // Auto-publish effect — fires once the room is Connected and decision is set.
  useEffect(() => {
    if (status !== "auto-publishing") return;
    if (connectionState !== ConnectionState.Connected) return;
    if (!localParticipant) return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    (async () => {
      try {
        await Promise.all([
          localParticipant.setMicrophoneEnabled(true),
          localParticipant.setCameraEnabled(true),
        ]);
        writeJoinedBefore();
        onJoined();
      } catch (err) {
        const errName = err instanceof Error ? err.name : "";
        // We only reach this effect with decisionRef === "granted" (Permissions
        // API confirmed both tracks). Any standard WebRTC failure here is a
        // real condition the user can't resolve from a fresh gesture — route
        // to Recovery so they see the "fix it" instructions (NotReadable is
        // covered by Recovery's "another app like Zoom" line).
        if (errName === "NotAllowedError" || errName === "NotReadableError" || errName === "NotFoundError") {
          onDenied();
        } else {
          // Unknown error — fall back to the manual UI as a last resort.
          attemptedRef.current = false;
          setStatus("manual");
        }
      }
    })();
  }, [status, connectionState, localParticipant, onJoined, onDenied]);

  async function handleContinue() {
    if (!localParticipant) return;
    setStatus("publishing");
    try {
      await Promise.all([
        localParticipant.setMicrophoneEnabled(true),
        localParticipant.setCameraEnabled(true),
      ]);
      writeJoinedBefore();
      onJoined();
    } catch (err) {
      const errName = err instanceof Error ? err.name : "";
      if (errName === "NotAllowedError" || errName === "NotReadableError" || errName === "NotFoundError") {
        onDenied();
      } else {
        // Unknown error — leave the user in the manual UI so they can retry
        setStatus("manual");
      }
    }
  }

  // Hide the card entirely during the checking / auto-publishing phases.
  if (status === "checking" || status === "auto-publishing") {
    return (
      <div className="gr-screen" aria-busy="true">
        <div className="gr-card gr-card--silent">
          <p className="gr-card__pending">Connecting…</p>
        </div>
      </div>
    );
  }

  const connecting = connectionState !== ConnectionState.Connected;
  const publishing = status === "publishing";
  const ctaDisabled = connecting || publishing;
  const ctaLabel = publishing ? "Joining…" : connecting ? "Connecting…" : "Continue →";

  return (
    <div className="gr-screen">
      <div className="gr-card">
        <h1 className="gr-card__title">You&apos;re almost in.</h1>
        <p className="gr-card__body">
          In a moment, your browser will ask to use your camera and microphone.
          Please click <strong>Allow</strong> when prompted.
        </p>
        <button
          type="button"
          className="gr-card__cta"
          onClick={handleContinue}
          disabled={ctaDisabled}
        >
          {ctaLabel}
        </button>
        <p className="gr-card__hint">You can mute yourself anytime once you&apos;re in.</p>

        {showRememberDisclosure && platform && (
          <div className="gr-remember">
            <button
              type="button"
              className="gr-remember__toggle"
              onClick={() => setShowRememberInstructions((v) => !v)}
              aria-expanded={showRememberInstructions}
            >
              {showRememberInstructions ? "Hide instructions" : "Tired of seeing this? Set Safari to remember →"}
            </button>
            {showRememberInstructions && (
              <div className="gr-remember__panel">
                <p className="gr-remember__intro">Skip this screen on future visits:</p>
                <RememberSteps platform={platform} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RememberSteps({ platform }: { platform: Platform }) {
  // Only Safari on macOS / iOS / iPadOS reaches this — guarded by
  // defaultsToPerSessionPermission above. Branch on OS for the device-matched
  // affordance: menu bar on Mac, AA icon on iPhone, ᴬA icon on iPad.
  if (platform.os === "macos") {
    return (
      <ol className="gr-remember__steps">
        <li>Click <strong>Safari</strong> in the menu bar at the top of your screen</li>
        <li>Choose <strong>Settings for This Website…</strong></li>
        <li>Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong></li>
        <li>Refresh — RIM won&apos;t ask again on this Mac</li>
      </ol>
    );
  }
  if (platform.os === "ipados") {
    return (
      <ol className="gr-remember__steps">
        <li>Tap the <strong>ᴬA</strong> icon in the address bar</li>
        <li>Tap <strong>Website Settings</strong></li>
        <li>Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong></li>
        <li>Refresh — RIM won&apos;t ask again on this iPad</li>
      </ol>
    );
  }
  // ios
  return (
    <ol className="gr-remember__steps">
      <li>Tap the <strong>AA</strong> icon at the left of the address bar</li>
      <li>Tap <strong>Website Settings</strong></li>
      <li>Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong></li>
      <li>Refresh — RIM won&apos;t ask again on this iPhone</li>
    </ol>
  );
}
