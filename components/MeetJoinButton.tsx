"use client";

/**
 * MeetJoinButton — intercepts a Meet link click to record attendance,
 * then opens the Meet URL in a new tab.
 *
 * Drop-in replacement for <a href={zoomLink} target="_blank"> anywhere
 * in the member-facing UI.
 */

interface Props {
  programId: string;
  programSlug: string;
  zoomLink: string;
  className?: string;
  children: React.ReactNode;
}

export default function MeetJoinButton({
  programId,
  programSlug,
  zoomLink,
  className,
  children,
}: Props) {
  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();

    // Open the Meet URL immediately — don't wait for the API call.
    // The record is best-effort; a slow or failed API call must not block the join.
    window.open(zoomLink, "_blank", "noopener,noreferrer");

    // Fire-and-forget attendance record.
    fetch("/api/attendance/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId, programSlug }),
    }).catch(() => {
      // Silently ignore — attendance tracking must never interrupt the join flow.
    });
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
