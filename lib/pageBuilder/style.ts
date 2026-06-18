// lib/pageBuilder/style.ts
// Maps the bounded BlockStyle tokens to CSS classes. One place owns the
// token→class mapping so the renderer and (later) the composer agree.
// Background/spacing/align live on the full-bleed section; width constrains
// the inner content — so a colored band spans the page while its content
// stays in a readable column.
import type { BlockStyle } from "./types";

const BG: Record<string, string> = {
  none: "",
  bright: "blk--bg-bright",
  dawn: "blk--bg-dawn",
  pearl: "blk--bg-pearl",
  blue: "blk--bg-blue",
  teal: "blk--bg-teal",
};
const MT: Record<string, string> = {
  none: "blk--mt-0",
  s: "blk--mt-s",
  m: "blk--mt-m",
  l: "blk--mt-l",
  xl: "blk--mt-xl",
};
const MB: Record<string, string> = {
  none: "blk--mb-0",
  s: "blk--mb-s",
  m: "blk--mb-m",
  l: "blk--mb-l",
  xl: "blk--mb-xl",
};
const W: Record<string, string> = {
  reading: "blk__inner--reading",
  wide: "blk__inner--wide",
  full: "blk__inner--full",
};
const ALIGN: Record<string, string> = {
  left: "blk--align-left",
  center: "blk--align-center",
};

export interface BlockClasses {
  section: string;
  inner: string;
}

export function blockStyleClasses(style?: BlockStyle): BlockClasses {
  if (!style) return { section: "", inner: "" };
  const section = [
    style.background ? BG[style.background] : "",
    style.spaceTop ? MT[style.spaceTop] : "",
    style.spaceBottom ? MB[style.spaceBottom] : "",
    style.align ? ALIGN[style.align] : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inner = [style.width ? W[style.width] : ""].filter(Boolean).join(" ");
  return { section, inner };
}
