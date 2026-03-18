/**
 * ManualContent — RETIRED as content source.
 *
 * Content has been migrated to ManualSection DB records.
 * See /admin/manual for the index and /admin/manual/[slug] for each section.
 * To update manual content, edit via /admin/manual/[slug]/edit or re-run:
 *   prisma/seed-manual-chapters.ts
 *
 * This file is kept to avoid breaking any remaining imports.
 * It now renders nothing.
 */

export default function ManualContent({ isAdmin: _isAdmin }: { isAdmin: boolean }) {
  return null;
}
