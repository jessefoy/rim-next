import Link from "next/link";

/**
 * SeriesListItem — w-layout-grid series-list-grid rows
 * Used in course pages (lesson lists) and anywhere else that renders
 * a series/lesson list in the Webflow series-list-grid layout.
 *
 * isSectionTitle=true renders a transparent header row with no Go button.
 * isSectionTitle=false (default) renders a white card row with a Go ➞ link.
 */
export default function SeriesListItem({
  title,
  href,
  isSectionTitle = false,
  includesAudio = false,
}: {
  title: string;
  href?: string;
  isSectionTitle?: boolean;
  includesAudio?: boolean;
}) {
  if (isSectionTitle) {
    return (
      <div className="w-layout-grid series-list-grid section-title-bg">
        <div className="dashboard-list-name-and-date-container">
          <div className="dashboard-title-container">
            <div className="lesson-section-break">{title}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-layout-grid series-list-grid">
      <div className="dashboard-list-name-and-date-container">
        <div className="dashboard-title-container">
          <div className="event-name">
            {title}
            {includesAudio && <span className="audio-badge"> 🎧</span>}
          </div>
        </div>
      </div>
      {href && (
        <div className="program-links">
          <Link href={href} className="button-2-copy w-button">
            Go ➞
          </Link>
        </div>
      )}
    </div>
  );
}
