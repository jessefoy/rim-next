import Link from "next/link";

/**
 * ListRow — w-layout-grid programlistblock
 *
 * The universal list-row card used across the site:
 *   - Community Programs listing
 *   - Dashboard Zoom links
 *   - Dashboard My Library
 *   - Course lesson lists (via SeriesListItem)
 *
 * Props:
 *   title        — bold event/item name (.event-name)
 *   subtitle     — day/time/location text (.text-block-46)
 *   note         — italic pre-session or early-arrival note (.presession-message)
 *   announcement — special announcement block (.special-announcment)
 *   badge        — inline text appended to title (.audio-badge), e.g. " 🎧"
 *   href         — button link; if omitted the button is rendered as a span
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
  const btnClass = "program-list-button w-button";

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
      <span className={btnClass} style={{ opacity: 0.5, cursor: "default" }}>
        {buttonLabel}
      </span>
    );

  return (
    <div className="w-layout-grid programlistblock">
      <div className="dashboard-list-name-and-date-container">
        <div className="name-day-and-time-block">
          <div className="dashboard-title-container">
            <h1 className="event-name">
              {title}
              {badge && <span className="audio-badge">{badge}</span>}
            </h1>
          </div>
          {subtitle && (
            <div className="dashboard-date-time-container">
              <div className="text-block-46">{subtitle}</div>
            </div>
          )}
        </div>
        {note && <h1 className="presession-message">{note}</h1>}
        {announcement && (
          <div className="special-program-announcment">
            <h1 className="special-announcment">{announcement}</h1>
          </div>
        )}
      </div>
      <div className="program-links">{button}</div>
    </div>
  );
}
