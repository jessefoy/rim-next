/** Shared, side-effect-free validation and ordering for personal file views. */
export const FILE_SORTS = ["name", "name-desc", "newest", "oldest", "kind"] as const;
export type FileSort = typeof FILE_SORTS[number];
export function isFileSort(value: unknown): value is FileSort {
  return typeof value === "string" && FILE_SORTS.includes(value as FileSort);
}
export function validFileColor(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value));
}
export type FileOrganizationPatch = { place: string; favorite?: boolean; color?: string | null; pinned?: boolean };
export function parseFileOrganization(value: unknown): FileOrganizationPatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.place !== "string" || v.place.length > 200 ||
      Object.keys(v).some(k => !["place", "favorite", "color", "pinned"].includes(k))) return null;
  if (v.favorite !== undefined && typeof v.favorite !== "boolean") return null;
  if (v.color !== undefined && !validFileColor(v.color)) return null;
  if (v.pinned !== undefined && typeof v.pinned !== "boolean") return null;
  if (v.favorite === undefined && v.color === undefined && v.pinned === undefined) return null;
  return v as FileOrganizationPatch;
}
export function orderFiles<T extends { id: string; name: string; mimeType: string; modifiedTime: string | null; pinned?: boolean }>(files: T[], sort: FileSort): T[] {
  const compareName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) || a.id.localeCompare(b.id);
  return [...files].sort((a, b) => {
    const pins = Number(!!b.pinned) - Number(!!a.pinned);
    if (pins) return pins;
    const folders = Number(b.mimeType === "application/vnd.google-apps.folder") - Number(a.mimeType === "application/vnd.google-apps.folder");
    if (folders) return folders;
    if (sort === "name-desc") return -compareName(a, b);
    if (sort === "kind") return a.mimeType.localeCompare(b.mimeType) || compareName(a, b);
    if (sort === "newest" || sort === "oldest") {
      const time = (f: T) => f.modifiedTime ? (Date.parse(f.modifiedTime) || 0) : 0;
      return (sort === "newest" ? time(b) - time(a) : time(a) - time(b)) || compareName(a, b);
    }
    return compareName(a, b);
  });
}
