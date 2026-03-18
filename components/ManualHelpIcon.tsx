"use client";

interface Props {
  manualSlug: string;
  label?: string;
}

export default function ManualHelpIcon({ manualSlug, label = "Help" }: Props) {
  return (
    <a
      href={`/admin/manual/${manualSlug}`}
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
