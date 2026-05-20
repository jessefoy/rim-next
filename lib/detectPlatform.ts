/**
 * Client-only browser + OS detection for permission-prompt instructions in
 * Greenroom and Recovery. Used to show users instructions that match what
 * is actually in front of them (Safari address-bar AA icon on iOS, "Settings
 * for This Website…" on Safari Mac, the camera icon at the left of the URL
 * bar on Chrome/Edge, etc.).
 *
 * Detection is best-effort. Misidentifications are accepted as rare; the
 * "other" fallbacks in the consuming components handle them with generic
 * prose. There is no safety-hatch disclosure on the UI (decided session 120).
 *
 * Brave hides itself in the UA on modern versions; we classify it as Chrome
 * since the address-bar permission affordance is identical.
 */

export type Browser = "safari" | "chrome" | "edge" | "firefox" | "other";
export type OS = "macos" | "ios" | "ipados" | "windows" | "android" | "other";

export interface Platform {
  browser: Browser;
  os: OS;
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined" || typeof document === "undefined") {
    return { browser: "other", os: "other" };
  }
  const ua = navigator.userAgent;

  let os: OS = "other";
  if (/iPhone|iPod/.test(ua)) {
    os = "ios";
  } else if (/iPad/.test(ua)) {
    os = "ipados";
  } else if (/CriOS|FxiOS|EdgiOS/.test(ua)) {
    // iOS browser wrappers (Chrome / Firefox / Edge on iOS). Their UAs can
    // omit iPhone/iPad in some desktop-spoof configurations but the engine
    // token uniquely identifies an iOS device. Default to ios — close enough
    // to iPadOS that the instructions still apply.
    os = "ios";
  } else if (/Macintosh/.test(ua)) {
    // iPadOS 13+ reports as Macintosh; the touch capability distinguishes
    // a real Mac from an iPad in desktop-mode.
    os = "ontouchend" in document ? "ipados" : "macos";
  } else if (/Android/.test(ua)) {
    os = "android";
  } else if (/Windows/.test(ua)) {
    os = "windows";
  }

  let browser: Browser = "other";
  if (/EdgiOS|Edg\/|EdgA/.test(ua)) {
    browser = "edge";
  } else if (/Firefox|FxiOS/.test(ua)) {
    browser = "firefox";
  } else if (/CriOS|Chrome/.test(ua)) {
    browser = "chrome";
  } else if (/Safari/.test(ua)) {
    browser = "safari";
  }

  return { browser, os };
}

/**
 * Browsers that default to per-session camera/mic permission — Safari on
 * macOS, iOS, and iPadOS. These are the only platforms where the Greenroom
 * "set this site to remember" disclosure is useful; other browsers persist
 * permission by default once the user clicks Allow.
 */
export function defaultsToPerSessionPermission(platform: Platform): boolean {
  return (
    platform.browser === "safari" &&
    (platform.os === "macos" || platform.os === "ios" || platform.os === "ipados")
  );
}
