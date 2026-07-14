/**
 * Shared status pill for the admin diagnostic pages (/admin/zoom-test,
 * /admin/google-test). Server-safe — no client boundary — so both server
 * components render it directly. Styles live under the adm-diag__ prefix.
 */
export function pill(tone: "success" | "warning" | "error", label: string) {
  return <span className={`adm-diag__pill adm-diag__pill--${tone}`}>{label}</span>;
}
