/**
 * update-manual-host-rotations-v3.mjs — Host Rotations chapter refresh.
 *
 * v3 updates:
 *   - Removes the "Pair" pattern (removed from UI in session 108).
 *   - Corrects the End section: one action (end + release all future dates
 *     + email hosts). The "just stop generating" option no longer exists.
 *   - Adds "Release one person's upcoming dates" — frees one host's
 *     sessions without affecting others in a shared rotation.
 *   - Adds per-program "Reset rotations" for coordinators.
 *   - Notes that coordinators (as well as HOST_MANAGER / ADMIN) have
 *     full access to rotation controls.
 *
 * Body is a plain HTML string (canonical Tiptap format).
 * Idempotent via migrate.mjs flag update_manual_host_rotations_v3.
 */

const ROTATIONS_BODY = `<p>The Rotations tab is where you set up the standing pattern of who hosts what — say, "Sarah hosts the Tuesday morning sit through the end of June." Once a rotation is set, the system fills in the actual sessions on the schedule for you. You don't have to assign each week one at a time.</p>
<p>This chapter walks through what's there and how to use it. Rotations look complex at first, but the page is organized to make the choices small and clear.</p>
<p>The Rotations tab is available to hub coordinators, HOST_MANAGER, and ADMIN.</p>
<h2>What a rotation is</h2>
<p>A rotation is a rule, not a single assignment. It says: "for this program on this day, here's who hosts each occurrence of the month." The system reads the rotation and creates the actual session assignments on the schedule, automatically, going forward.</p>
<p>You can set up rotations for as many programs and days as the team needs. The schedule fills in around them. When something changes — someone's availability, a program's pattern — you come back here and update the rotation. The schedule catches up.</p>
<h2>How the page is organized</h2>
<p>When you open the Rotations tab, you'll see a card for each recurring program. Each card has a small grid:</p>
<ul>
<li><strong>Rows</strong> are the days of the week the program runs on.</li>
<li><strong>Columns</strong> are the occurrences of the month — 1st, 2nd, 3rd, 4th, and 5th.</li>
<li><strong>Cells</strong> show whose name is assigned for that day-and-occurrence.</li>
</ul>
<p>To the right of each row you'll see action buttons:</p>
<ul>
<li>If no one is assigned yet: <strong>Set up</strong> — the row is empty and waiting.</li>
<li>If a rotation is already in place: <strong>Edit</strong> and <strong>End</strong>.</li>
</ul>
<h2>Setting up a rotation</h2>
<p>Click <strong>Set up</strong> on an empty row (or <strong>Edit</strong> to change one that's already there). A small form opens inline.</p>
<p>The form asks four things:</p>
<ol>
<li><strong>What's the pattern?</strong> Same, Alternate, or Custom — explained below.</li>
<li><strong>Who fills each slot?</strong> Pick a host from the team for each slot the pattern uses.</li>
<li><strong>Is there a 5th-week host?</strong> Optional. Some months have a 5th occurrence; you can pick a different host for that, or leave it blank.</li>
<li><strong>When does the rotation end?</strong> Optional. Leave blank for no end date. Set a date if the rotation should stop on a known day — say, a host committed only through June.</li>
</ol>
<p>A live preview shows the next six sessions with their projected hosts as you fill in the form. Click <strong>Save &amp; apply</strong> when it looks right. The system checks for conflicts with sessions already on the schedule and shows a window if any decisions are needed.</p>
<h2>The three patterns</h2>
<p><strong>Same.</strong> The same person hosts every week — one name, every occurrence.</p>
<blockquote><p>Sarah every week of the month.</p></blockquote>
<p><strong>Alternate.</strong> Two people split the month: one hosts the 1st and 3rd; the other hosts the 2nd and 4th.</p>
<blockquote><p>Sarah on the 1st and 3rd; Jordan on the 2nd and 4th.</p></blockquote>
<p><strong>Custom.</strong> You pick each occurrence independently — useful for three or four people sharing irregularly, or any pattern that doesn't fit Same or Alternate.</p>
<h2>The 5th week</h2>
<p>Most months have four occurrences of any given day; some have five. The 5th-week field handles the rare fifth occurrence. Leave it blank to leave those sessions unassigned (the team can claim them), or pick a specific person to cover them.</p>
<h2>Ending a rotation</h2>
<p><strong>If you know the end date in advance</strong> — a host committed only through June, a program pausing for the summer — click <strong>Edit</strong>, set the <strong>end date</strong>, and save. The rotation runs until that date and stops. Sessions up to the end date stay scheduled; sessions after go back to unassigned.</p>
<p><strong>If you need to end it now</strong>, click <strong>End</strong>. A panel opens with two options:</p>
<p><strong>Release one person's upcoming dates.</strong> This is for shared rotations (Alternate or Custom) when one person needs to step back but the others should keep their schedule unchanged. Their upcoming sessions are freed — shown as "Needs Coverage" so the team can claim them. The rotation stays active and can be edited to add a replacement. Each rotation participant's name appears here with a "Release their dates" button.</p>
<p><strong>End this rotation.</strong> Stops the rotation entirely, clears all upcoming sessions from every host's schedule, and emails each affected host to let them know. Use this when the rotation pattern itself is done — not just one person stepping back.</p>
<h2>Resetting a program</h2>
<p>If a program's rotation structure needs to be rebuilt from scratch, a <strong>Reset rotations</strong> button appears at the bottom of each program card (coordinator and manager only). This deletes all rotation rules for that program and removes all upcoming assignments — the grid becomes empty and you can start fresh. Past sessions are never touched.</p>
<h2>What happens behind the scenes</h2>
<p>When you save a rotation, the system creates session assignments going forward through the end of the year. Once a day, it also checks whether any new sessions need filling (for example, as the calendar rolls into the next month) and fills them. When new assignments are created, the host gets a notification.</p>
<h2>When to come back</h2>
<ul>
<li>A host's availability changes for the foreseeable future.</li>
<li>A new host is ready for a regular slot.</li>
<li>A program's recurring schedule changes.</li>
<li>A host steps back and their sessions need to be freed.</li>
<li>The team has decided to rebalance.</li>
</ul>
<p>For one-off coverage changes — someone can't make next Tuesday — the host handles it through the Schedule tab (request a sub, claim cover). You don't need to touch the rotation for a single week.</p>
<p>If something feels off — a rotation that won't save, a conflict window that's confusing — message Jesse and we'll work it out together.</p>`;

export async function updateManualHostRotationsV3(db) {
  const existing = await db.manualSection.findUnique({
    where:  { slug: "host-rotations" },
    select: { id: true },
  });

  const data = {
    title:       "Host Rotations",
    description: "How the host coordinator sets up standing rotations — patterns, hosts, end dates, releasing one person, and resetting.",
    hubSlug:     "host-team",
    body:        { type: "rawHtml", html: ROTATIONS_BODY },
    relations:   ["host-schedule", "host-hub-team-management"],
  };

  if (existing) {
    await db.manualSection.update({ where: { slug: "host-rotations" }, data });
    console.log("  ✔ Updated manual section: host-rotations (v3)");
  } else {
    await db.manualSection.create({ data: { slug: "host-rotations", order: 8, ...data } });
    console.log("  ✔ Created manual section: host-rotations (v3)");
  }
}
