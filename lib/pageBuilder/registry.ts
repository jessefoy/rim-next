// lib/pageBuilder/registry.ts
// The block registry — pure data (no JSX), safe to import in the client composer.
// The palette is BLOCKS; the inspector is generated from each block's `controls`
// + `styleControls` (resolved against STYLE_CONTROL_META). Adding a block, a
// control, or a style option is additive here — no other file needs to change.
import type { BlockDef, BlockStyle, ControlOption } from "./types";

const SPACE_OPTIONS: ControlOption[] = [
  { value: "none", label: "None" },
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
  { value: "xl", label: "X-large" },
];

// Shared, bounded design controls — same vocabulary for every block.
export const STYLE_CONTROL_META: Record<
  keyof BlockStyle,
  { label: string; type: "swatch" | "select"; options: ControlOption[] }
> = {
  background: {
    label: "Background",
    type: "swatch",
    options: [
      { value: "none", label: "None" },
      { value: "bright", label: "Bright" },
      { value: "dawn", label: "Dawn Pink" },
      { value: "pearl", label: "Pearl Bush" },
      { value: "blue", label: "Blue" },
      { value: "teal", label: "Teal" },
    ],
  },
  spaceTop: { label: "Space above", type: "select", options: SPACE_OPTIONS },
  spaceBottom: { label: "Space below", type: "select", options: SPACE_OPTIONS },
  width: {
    label: "Width",
    type: "select",
    options: [
      { value: "reading", label: "Reading" },
      { value: "wide", label: "Wide" },
      { value: "full", label: "Full bleed" },
    ],
  },
  align: {
    label: "Align",
    type: "select",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Center" },
    ],
  },
};

export const BLOCKS: BlockDef[] = [
  {
    type: "hero",
    label: "Hero",
    icon: "ti-layout-navbar",
    group: "content",
    rendersInEmail: true,
    variants: [
      { key: "centered", label: "Centered" },
      { key: "split", label: "Split" },
      { key: "minimal", label: "Minimal" },
    ],
    controls: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Welcome" },
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url", placeholder: "/community-programs" },
    ],
    defaultProps: {
      eyebrow: "Welcome",
      title: "A community of practice",
      subtitle: "Live online sits, courses, and dharma — open to all.",
      buttonLabel: "Explore programs",
      buttonHref: "/community-programs",
    },
    styleControls: ["background", "spaceTop", "spaceBottom", "width", "align"],
  },
  {
    type: "richText",
    label: "Rich text",
    icon: "ti-align-left",
    group: "content",
    rendersInEmail: true,
    controls: [{ key: "html", label: "Content", type: "richText" }],
    defaultProps: { html: "<p>Write something here…</p>" },
    styleControls: ["background", "spaceTop", "spaceBottom", "width"],
  },
  {
    type: "cardGrid",
    label: "Card grid",
    icon: "ti-layout-grid",
    group: "content",
    rendersInEmail: true,
    variants: [
      { key: "two", label: "2 columns" },
      { key: "three", label: "3 columns" },
      { key: "four", label: "4 columns" },
    ],
    controls: [
      { key: "heading", label: "Heading", type: "text" },
      {
        key: "cards",
        label: "Cards",
        type: "items",
        itemControls: [
          { key: "title", label: "Title", type: "text" },
          { key: "body", label: "Body", type: "textarea" },
          { key: "linkLabel", label: "Link label", type: "text" },
          { key: "href", label: "Link", type: "url" },
        ],
      },
    ],
    defaultProps: {
      heading: "What you'll find here",
      cards: [
        { title: "Card one", body: "A short description.", linkLabel: "Learn more", href: "#" },
        { title: "Card two", body: "A short description.", linkLabel: "Learn more", href: "#" },
        { title: "Card three", body: "A short description.", linkLabel: "Learn more", href: "#" },
      ],
    },
    styleControls: ["background", "spaceTop", "spaceBottom", "width"],
  },
  {
    type: "cta",
    label: "CTA band",
    icon: "ti-click",
    group: "content",
    rendersInEmail: true,
    controls: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "buttonLabel", label: "Button label", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url" },
    ],
    defaultProps: { heading: "Begin where you are.", buttonLabel: "Join", buttonHref: "/join" },
    styleControls: ["background", "spaceTop", "spaceBottom", "align"],
  },
];

export function getBlock(type: string): BlockDef | undefined {
  return BLOCKS.find((b) => b.type === type);
}
