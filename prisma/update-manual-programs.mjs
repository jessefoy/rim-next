/**
 * update-manual-programs.mjs — Surgical drift fix for the programs chapter.
 *
 * The original chapter (2,417 lines) is the largest in the manual.
 * Most of it (program fields, schedule, recurrence, registration
 * settings, dana, custom questions) is conceptually accurate. The
 * drift is concentrated in two places:
 *
 *   1. Location: every reference to /account/hub/registrar/programs
 *      points to a path that no longer exists. Program Manager moved
 *      to /tools/programs in session 73.
 *
 *   2. Video conferencing: the chapter has a substantial Google Meet
 *      section explaining how to create rooms, manage room accounts,
 *      and remove meets. Google Meet was replaced by LiveKit in
 *      session 86. Members and hosts no longer interact with Google
 *      Meet at all — sessions run inside RIM's own session room.
 *      The "Create Google Meet" button doesn't exist; there's no
 *      room-account management. The whole section is misleading.
 *
 * This update applies path replacements and removes the Google Meet
 * section. The replacement leaves the rest of the chapter intact;
 * a richer note about the session room, LiveKit, and Open Access
 * (which is also missing) is a future option-B rewrite.
 *
 * Body is normalized to a plain HTML string on save. Idempotent.
 * Wired into migrate.mjs with a v1 flag.
 */

const PATH_REPLACEMENTS = [
  ["/account/hub/registrar/programs", "/tools/programs"],
  ["the Course Hub", "the Course Manager"],
  ["Course Hub", "Course Manager"],  // generic catch
];

/**
 * Strip the Google Meet section. The original wraps it as a top-level
 * section starting with the `<!-- Google Meet: overview -->` style
 * comment and the heading "Setting up a Google Meet". It runs until the
 * next chapter break. Our marker pair matches both the comment-wrapped
 * section and the heading itself so we catch it however it survives the
 * extraction pipeline.
 */
function stripGoogleMeetSection(html) {
  // Find the section start. Match either the section that contains the
  // "Setting up a Google Meet" h2, or anything wrapped in
  // {/* ── Google Meet ── */}-style markers that survives.
  const startMatch = html.match(/<section[^>]*>\s*(?:<[^>]+>\s*)*<h2[^>]*>\s*Setting up a Google Meet\s*<\/h2>/i);
  if (!startMatch) return html;
  const start = startMatch.index;

  // The Google Meet section spans multiple <section> blocks in the source.
  // Find the next non-Google-Meet anchor — either a different chapter <div>
  // or a section whose h2 isn't about Google Meet. To stay safe, we scan
  // forward from `start` and consume sections whose first h2/h3 mentions
  // Google Meet, Meet, or "room account". Stop at the first section whose
  // h2 is something else.
  let cursor = start;
  let lastEnd = start;
  while (true) {
    const nextSectionStart = html.indexOf("<section", cursor + 1);
    if (nextSectionStart === -1) break;
    const headingSlice = html.slice(nextSectionStart, nextSectionStart + 1500);
    const headingMatch = headingSlice.match(/<h[23][^>]*>\s*([\s\S]*?)\s*<\/h[23]>/i);
    if (!headingMatch) break;
    const heading = headingMatch[1].toLowerCase().replace(/<[^>]+>/g, "").trim();
    const looksGoogleMeet =
      heading.includes("google meet") ||
      heading.includes("room account") ||
      heading.includes("creating a meet") ||
      heading.includes("removing a meet") ||
      heading.includes("meet panel") ||
      heading.includes("rescheduling") && headingSlice.toLowerCase().includes("meet");
    if (!looksGoogleMeet) break;
    // Find the closing </section> for this section.
    const sectionEnd = html.indexOf("</section>", nextSectionStart);
    if (sectionEnd === -1) break;
    cursor = sectionEnd + "</section>".length;
    lastEnd = cursor;
  }

  // Find the closing </section> after the original start (the first
  // Google Meet section itself) to make sure we cover at least that one.
  const firstSectionClose = html.indexOf("</section>", start) + "</section>".length;
  const cutEnd = Math.max(firstSectionClose, lastEnd);

  // Replace the cut span with a brief honest note.
  const replacement =
    `<section class="man-section">` +
    `<h2 class="man-section__title">Video for virtual programs</h2>` +
    `<p>Virtual programs run inside RIM's own session room. When a member or host opens a virtual program at session time, they enter the room directly — no separate Google Meet link, no Zoom account, no app to install. The host opens the room a few minutes early and tends the space while the teacher leads.</p>` +
    `<p>For host-team material on running a session — what the room looks like, what the host controls do, when to mute, when to end — see the <strong>Host Hub Manual</strong> at <strong>/account/hub/host-team/manual</strong>.</p>` +
    `</section>`;

  return html.slice(0, start) + replacement + html.slice(cutEnd);
}

function extractHtml(body) {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && body.type === "rawHtml" && typeof body.html === "string") {
    return body.html;
  }
  return null;
}

export async function updateManualPrograms(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "programs" },
    select: { body: true },
  });
  if (!existing?.body) {
    console.log("  ⚠ Manual section 'programs' has no body — skipping");
    return;
  }

  const currentHtml = extractHtml(existing.body);
  if (currentHtml === null) {
    console.log("  ⚠ Manual section 'programs' body has unexpected shape — skipping");
    return;
  }

  let updated = currentHtml;

  // 1. Strip the Google Meet section (replaced with a brief LiveKit note).
  updated = stripGoogleMeetSection(updated);

  // 2. Apply path replacements.
  for (const [from, to] of PATH_REPLACEMENTS) {
    updated = updated.split(from).join(to);
  }

  if (updated === currentHtml) {
    console.log("  ⏭ Manual section 'programs' already current");
    return;
  }

  await db.manualSection.update({
    where: { slug: "programs" },
    data:  { body: updated },
  });
  console.log("  ✔ Updated manual section: programs");
}
