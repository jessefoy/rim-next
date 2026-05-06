/**
 * update-manual-host-rotations.mjs — Host Rotations chapter (new).
 *
 * Coordinator-facing. Walks through the Rotations tab in /tools/schedule:
 * what a rotation is, how the page is organized (program cards, day
 * rows, occurrence columns), the four patterns (Same / Alternate /
 * Pair / Custom), the 5th-week host, ending a rotation, and what
 * happens behind the scenes when you save.
 *
 * Voice: 8th-grade reading level, plain language, supportive in tone,
 * no model names or system jargon. Does not name the coordinator.
 *
 * Body is a plain HTML string (post-Tiptap canonical format).
 * Idempotent at the record level. Wired into migrate.mjs with a v1 flag.
 */

const ROTATIONS_BODY = `<p>The Rotations tab is where you set up the standing pattern of who hosts what — say, "Sarah hosts the Tuesday morning sit through the end of June." Once a rotation is set, the system fills in the actual sessions on the schedule for you. You don't have to assign each week one at a time.</p>
<p>This chapter walks through what's there and how to use it. Take your time. Rotations look complex at first, but the page is organized to make the choices small and clear.</p>
<h2>What a rotation is</h2>
<p>A rotation is a rule, not a single assignment. It says: "for this program on this day, here's who hosts each occurrence of the month." The system reads the rotation and creates the actual session assignments on the schedule, automatically, going forward.</p>
<p>You can set up rotations for as many programs and days as the team needs. The schedule fills in around them. When something changes — someone's availability, a program's pattern — you come back here and update the rotation. The schedule catches up.</p>
<h2>How the page is organized</h2>
<p>When you open the Rotations tab, you'll see a card for each recurring program — Awakening The Heart, the morning sit, the dharma study, and so on. Each card has a small grid:</p>
<ul>
<li><strong>Rows</strong> are the days of the week the program runs on.</li>
<li><strong>Columns</strong> are the occurrences of the month — 1st, 2nd, 3rd, 4th, and 5th.</li>
<li><strong>Cells</strong> show whose name is assigned for that day-and-occurrence.</li>
</ul>
<p>For example, if a program runs every Tuesday and Thursday, the card has two rows: Tuesday and Thursday. Each row has cells for the 1st through 5th Tuesday (or Thursday) of the month. If a cell is empty, no one is assigned for that occurrence yet.</p>
<p>To the right of each row is an <strong>Edit</strong> button. Click it to set up the rotation for that day, or to change one that's already there.</p>
<h2>Setting up a rotation</h2>
<p>Click <strong>Edit</strong> on the row you want. A small form opens.</p>
<p>The form asks four things:</p>
<ol>
<li><strong>What's the pattern?</strong> Same, Alternate, Pair, or Custom — explained below.</li>
<li><strong>Who fills each slot?</strong> Pick a host from the team for each slot the pattern uses.</li>
<li><strong>Is there a 5th-week host?</strong> Optional. Some months have a 5th occurrence; you can pick a different host for that, or leave it blank.</li>
<li><strong>When does the rotation end?</strong> Optional. Leave blank for "no end date" — it just keeps going. Set a date if the rotation should stop on a known day, say if a host is committed only through June.</li>
</ol>
<p>Click <strong>Save</strong>. The system checks for any sessions already on the schedule that conflict with the new rotation. If there are conflicts, a small window appears showing them so you can decide — keep the existing ones, or replace them with the rotation's pattern. If there are no conflicts, the rotation saves and you're done.</p>
<h2>The four patterns</h2>
<p>Each pattern is a different way of saying who hosts which occurrences. Pick the one that matches the rhythm the team has agreed to.</p>
<p><strong>Same.</strong> The same person hosts every week. One name, every occurrence. Useful for a program with one steady host.</p>
<blockquote><p>Sarah every week of the month.</p></blockquote>
<p><strong>Alternate.</strong> Two people split the month, taking turns. One hosts the odd weeks (1st and 3rd); the other hosts the even weeks (2nd and 4th). Useful for a program with two co-hosts who alternate.</p>
<blockquote><p>Sarah on the 1st and 3rd; Jordan on the 2nd and 4th.</p></blockquote>
<p><strong>Pair.</strong> Two people split the month in halves. One hosts the first half (1st and 2nd weeks); the other hosts the second half (3rd and 4th weeks). Useful when each host wants a stretch of consecutive sessions.</p>
<blockquote><p>Sarah for the 1st and 2nd; Jordan for the 3rd and 4th.</p></blockquote>
<p><strong>Custom.</strong> You pick each occurrence individually. Use this when none of the above fits — three or four people sharing irregularly, a special seasonal pattern, anything bespoke.</p>
<h2>The 5th week</h2>
<p>Most months have four weeks; some have five. The 5th-week field handles the rare 5th occurrence. You can:</p>
<ul>
<li>Leave it blank — the 5th week stays unassigned, and the team can claim it from the schedule.</li>
<li>Pick a specific person — they host the 5th week whenever it comes up.</li>
<li>Pick a person who's not on the regular rotation — useful for "this person fills in occasionally."</li>
</ul>
<h2>Ending a rotation</h2>
<p>When a host's situation changes — they step back from a regular slot, they move, the team shifts — you can end the rotation without affecting past sessions.</p>
<p>Open the row, set an <strong>end date</strong>, and save. The rotation stops on that date. Sessions before the end date stay scheduled as they were. Sessions after the end date go back to unassigned and can be claimed by the team or replaced with a new rotation.</p>
<p>If you want to replace one rotation with another — say, a new host taking over a regular slot — open the row, change the hosts, and save. The conflict window will show what's about to change. Confirm and the new pattern takes over.</p>
<h2>What happens behind the scenes</h2>
<p>When you save a rotation, the system creates the session assignments on the schedule going forward. By default, it fills in through the end of the year. You don't need to think about this — it just happens.</p>
<p>Once a day, the system also checks the rotation against the schedule and fills in any sessions that aren't yet covered, in case the calendar has rolled forward into a new week. This means a rotation set up today will keep filling in sessions a week from now, a month from now, all the way to the end of the year.</p>
<p>When the system creates new assignments, the assigned host gets a notification so they know.</p>
<h2>When to come back</h2>
<p>A few times a year, or whenever a real change happens:</p>
<ul>
<li>A host's availability changes for the foreseeable future.</li>
<li>A new host is ready for a regular slot.</li>
<li>A program's recurring schedule changes.</li>
<li>A host steps back from a regular assignment.</li>
<li>The team has decided to rebalance the rotation.</li>
</ul>
<p>For week-by-week changes (someone can't make next Tuesday), the host handles it through the Schedule tab — request a sub, claim the cover, normal flow. You don't need to touch the rotation for one-off coverage.</p>
<h2>A small note</h2>
<p>Rotations are powerful but quiet. When they're set up well, the schedule fills in on its own and the team doesn't have to think about it. When something needs to change, this page is where you come — make the change, save, and the schedule catches up.</p>
<p>If something feels off — a rotation that won't save, a pattern you can't quite express, a conflict window that's confusing — message Jesse and we'll work it out together.</p>`;

export async function updateManualHostRotations(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-rotations" },
    select: { id: true },
  });

  const data = {
    title: "Host Rotations",
    description: "How the host coordinator sets up standing rotations — patterns, hosts, end dates, and what happens when you save.",
    hubSlug: "host-team",
    body: ROTATIONS_BODY,
    relations: ["host-schedule", "host-hub-team-management"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-rotations" },
      data,
    });
    console.log("  ✔ Updated manual section: host-rotations");
  } else {
    // Order 8 places it just after host-schedule (order 7).
    await db.manualSection.create({
      data: { slug: "host-rotations", order: 8, ...data },
    });
    console.log("  ✔ Created manual section: host-rotations");
  }
}
