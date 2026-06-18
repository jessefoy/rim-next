// lib/pageBuilder/types.ts
// The page-builder block contract. Coherence lives in the token unions below
// (every control's range IS the design system); flexibility lives in the
// per-instance BlockStyle plus each block declaring its own controls as data,
// so adding a knob, variant, or block later is additive — never a rebuild.

// ── Bounded design tokens ────────────────────────────────────────────────
export type BackgroundToken = "none" | "bright" | "dawn" | "pearl" | "blue" | "teal";
export type SpaceToken = "none" | "s" | "m" | "l" | "xl";
export type WidthToken = "reading" | "wide" | "full";
export type AlignToken = "left" | "center";

// Per-instance design controls — the "designable on rails" layer.
export interface BlockStyle {
  background?: BackgroundToken;
  spaceTop?: SpaceToken;
  spaceBottom?: SpaceToken;
  width?: WidthToken;
  align?: AlignToken;
}

// ── Page document (stored in Page.content as JSON) ───────────────────────
export interface PageSection {
  id: string;
  type: string;
  variant?: string;
  props: Record<string, unknown>;
  style?: BlockStyle;
}

export interface PageContent {
  version: 1;
  sections: PageSection[];
}

export type PageStatus = "DRAFT" | "PUBLISHED";

// ── Block registry (blocks declare their controls as data) ───────────────
export type ControlType =
  | "text"
  | "textarea"
  | "richText"
  | "image"
  | "url"
  | "select"
  | "swatch"
  | "toggle"
  | "items";

export interface ControlOption {
  value: string;
  label: string;
}

export interface ControlDef {
  key: string;
  label: string;
  type: ControlType;
  options?: ControlOption[];
  placeholder?: string;
  help?: string;
  itemControls?: ControlDef[]; // for type "items" — the per-item field controls
}

export interface BlockVariant {
  key: string;
  label: string;
}

export interface BlockDef<P = Record<string, unknown>> {
  type: string;
  label: string;
  icon: string; // tabler outline name
  group: "content" | "live";
  rendersInEmail: boolean; // web + email (static) vs web-only (dynamic)
  variants?: BlockVariant[];
  controls: ControlDef[]; // the inspector is generated from this
  defaultProps: P;
  styleControls?: (keyof BlockStyle)[]; // which BlockStyle knobs this block exposes
}

// The default style-control set most blocks expose.
export const DEFAULT_STYLE_CONTROLS: (keyof BlockStyle)[] = [
  "background",
  "spaceTop",
  "spaceBottom",
  "width",
  "align",
];

export const EMPTY_PAGE_CONTENT: PageContent = { version: 1, sections: [] };
