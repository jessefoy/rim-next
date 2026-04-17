/**
 * Deterministic avatar background colors keyed off initials (or any string).
 * Palette is muted and RIM-aligned — no electric / saturated hues.
 */

const PALETTE = [
  "#3f6a78", // teal
  "#2d4a6b", // deep blue
  "#5c7a6b", // sage
  "#7a5c3d", // warm brown
  "#6b3d5c", // plum
  "#4a5c7a", // slate blue
  "#6b7a3d", // olive
  "#8a5a3d", // rust
  "#3d6b5c", // forest
  "#5c4a6b", // muted violet
  "#7a4a4a", // dusty clay
  "#4a6b7a", // steel
];

export function avatarColorFor(seed: string): string {
  if (!seed) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
