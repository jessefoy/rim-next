/**
 * Background-effects config — shared by useBackgroundEffects + VideoSettingsPanel.
 *
 * Asset hosting. The @livekit/track-processors BackgroundProcessor loads a
 * MediaPipe selfie-segmentation model + WASM. By default the library fetches
 * these from public CDNs (jsDelivr for the tasks-vision WASM, Google storage
 * for the .tflite model). That works out of the box — which is what this first
 * cut uses (SEGMENTATION_ASSET_PATHS = undefined).
 *
 * To SELF-HOST for production (recommended — mirrors how we serve RNNoise from
 * /public/noise, and keeps us off third-party CDNs at session time):
 *   1. Copy node_modules/@mediapipe/tasks-vision/wasm/* into public/segmentation/
 *      (version-matched to the installed track-processors — no CDN drift).
 *   2. Download the model into public/segmentation/, e.g. selfie_segmenter.tflite:
 *      https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
 *   3. Set SEGMENTATION_ASSET_PATHS below to:
 *        { tasksVisionFileSet: "/segmentation", modelAssetPath: "/segmentation/selfie_segmenter.tflite" }
 * The hook passes this straight to BackgroundProcessor({ assetPaths }); undefined
 * means "use the library defaults".
 */
export const SEGMENTATION_ASSET_PATHS:
  | { tasksVisionFileSet?: string; modelAssetPath?: string }
  | undefined = undefined;

/** Blur strength bounds for the settings slider. The library's own default is 10. */
export const BLUR_RADIUS_DEFAULT = 10;
export const BLUR_RADIUS_MIN = 5;
export const BLUR_RADIUS_MAX = 20;

/** Names the processor so the double-attach guard can recognise it (mirrors RNNOISE_PROCESSOR_NAME). */
export const BACKGROUND_PROCESSOR_NAME = "rim-background";

export interface BackgroundScene {
  id: string;
  label: string;
  /** Served from /public. */
  path: string;
}

/**
 * Bundled virtual-background scenes. These ship as lightweight SVG gradients in
 * RIM's palette — calm starters, not photographs. To add real scenes, drop
 * JPG/PNG files (~1280x720) into public/images/backgrounds/ and list them here.
 * Note: virtual-background images are heavier than blur and, being SVG, may not
 * render on every older browser — blur is the robust, universal option.
 */
export const BACKGROUND_SCENES: BackgroundScene[] = [
  { id: "cream", label: "Warm cream", path: "/images/backgrounds/cream.svg" },
  { id: "sage", label: "Soft sage", path: "/images/backgrounds/sage.svg" },
  { id: "dusk", label: "Quiet blue", path: "/images/backgrounds/dusk.svg" },
];
