import Link from "next/link";

/**
 * ListRow — lr-row
 *
 * Universal list-row card used across the site:
 *   - Community Programs listing (/community-programs)
 *   - Dashboard Zoom links
 *   - Dashboard My Library
 *   - Course lesson lists (via SeriesListItem)
 *
 * Props:
 *   title        — bold event/item name (.lr-name)
 *   subtitle     — day/time/location text (.lr-schedule)
 *   note         — italic pre-session or early-arrival note (.lr-note)
 *   announcement — special announcement block (.lr-announcement)
 *   badge        — inline text appended to title (.lr-badge), e.g. " 🎧"
 *   href         — button link; if omitted the button renders as a span
 *   buttonLabel  — button text (default: "Go →")
 *   external     — opens in new tab (for Zoom links)
 *   disabled     — grayed non-clickable button (e.g. "Coming Soon")
 */

export type ListRowProps = {
  title: string;
  subtitle?: string;
  note?: string;
  announcement?: string;
  badge?: string;
  href?: string;
  buttonLabel?: string;
  external?: boolean;
  disabled?: boolean;
};

export default function ListRow({
  title,
  subtitle,
  note,
  announcement,
  badge,
  href,
  buttonLabel = "Go →",
  external = false,
  disabled = false,
}: ListRowProps) {
  const btnClass = disabled ? "lr-btn lr-btn--disabled" : "lr-btn";

  const button =
    href && !disabled ? (
      <Link
        href={href}
        className={btnClass}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {buttonLabel}
      </Link>
    ) : (
      <span className={btnClass}>
        {buttonLabel}
      </span>
    );

  return (
    <div className="lr-row">
      <div className="lr-info">
        <p className="lr-name">
          {title}
          {badge && <span className="lr-badge">{badge}</span>}
        </p>
        {subtitle && <p className="lr-schedule">{subtitle}</p>}
        {note && <p className="lr-note">{note}</p>}
        {announcement && <p className="lr-announcement">{announcement}</p>}
      </div>
      <div className="lr-action">{button}</div>
    </div>
  );
}
