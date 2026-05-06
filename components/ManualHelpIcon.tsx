"use client";

interface Props {
  manualSlug: string;
  label?:     string;
  /**
   * Optional hub slug to preserve as `?from=<slug>` in the chapter URL.
   * The chapter page reads this and adapts its back-link to return the
   * user to the hub-scoped manual instead of the system-wide one.
   */
  from?: string;
}

export default function ManualHelpIcon({ manualSlug, label = "Help", from }: Props) {
  const href = from
    ? `/admin/manual/${manualSlug}?from=${encodeURIComponent(from)}`
    : `/admin/manual/${manualSlug}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mh-icon"
      title={label}
      aria-label={label}
    >
      ?
    </a>
  );
}
