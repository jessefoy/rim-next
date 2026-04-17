/**
 * Deterministic avatar background colors keyed off initials (or any string).
 * Palette is muted and RIM-aligned — no electric / saturated hues.
 */

/** Muted, hue-distributed palette so adjacent seeds land on visibly different colors. */
const PALETTE = [
  "#3f6a78", // teal
  "#5c7a52", // sage
  "#9c7530", // goldenrod
  "#a05a3d", // rust
  "#8a3d4a", // burgundy
  "#764a5e", // plum
  "#5c4a7a", // violet
  "#2d4a6b", // deep blue
  "#3d6b5c", // forest
  "#6b7a3d", // olive
  "#8a5a4a", // clay
  "#3d5a7a", // navy
];

export function avatarColorFor(seed: string): string {
  if (!seed) return PALETTE[0];
  // FNV-1a 32-bit — better distribution than polynomial hash for short strings.
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return PALETTE[(hash >>> 0) % PALETTE.length];
}
