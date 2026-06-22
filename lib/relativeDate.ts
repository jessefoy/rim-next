/**
 * Plain-language freshness for document rows — "today" / "3 days ago" / an
 * absolute date when old. The freshness signal the Documents surfaces lead with
 * (provenance "Added …" is demoted). Shared by the per-hub Documents tab and the
 * master directory. Pure + client-safe.
 */
export function relativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString(
    "en-US",
    then.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}
