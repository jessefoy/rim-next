/**
 * update-manual-host-rotations-v5.mjs — Host Rotations chapter refresh.
 *
 * v5 (session 130 follow-up) — rewrites the chapter to match the
 * Scheduler's current behavior after Maria's beta test surfaced multiple
 * gaps between what the chapter promised and what was actually present:
 *
 *   - Row-level "End" button → "Reset [Day]" (programmatically day-named).
 *     The chapter now reads "Reset Monday" / "Reset Tuesday" etc. throughout.
 *   - "Release their dates" → "Remove from rotation" (semantic changed —
 *     the route now deletes the user's StandingAssignment, so the cron
 *     can't re-apply them. The chapter now describes the new behavior.)
 *   - Per-day vs per-program reset: a new section makes the distinction
 *     unambiguous so coordinators don't accidentally nuke all days when
 *     they meant to clear just one.
 *   - Cross-hub program-staffing view: new "View all roles →" link on
 *     every program card opens /tools/schedule/program/[slug]. New section
 *     introducing it.
 *   - Hubs as functional roles: a short framing paragraph for coordinators
 *     who work across multiple hubs (host-team, peer-led, AV, greeter)
 *     so they understand each hub holds its own rotation pool.
 *   - Per-session "Ask the team to cover" — clarifies this is the right
 *     exit for "I can't make ONE date" (vs. "Remove from rotation" which
 *     is "I'm leaving this rotation entirely").
 *
 * Body is a plain HTML string (canonical Tiptap format).
 * Idempotent via migrate.mjs flag update_manual_host_rotations_v5.
 */

const ROTATIONS_BODY = `<p>The Rotations tab is where you set up the standing pattern of who hosts what — say, "Sarah hosts the Tuesday morning sit through the end of June." Once a rotation is set, the system fills in the actual sessions on the schedule for you. You don't have to assign each week one at a time.</p>
<p>This chapter walks through what's there and how to use it. Rotations look complex at first, but the page is organized to make the choices small and clear.</p>
<p>The Rotations tab is available to hub coordinators, HOST_MANAGER, and ADMIN.</p>
<h2>Hubs are functional roles</h2>
<p>Before diving in, the framing that makes the rest of this make sense: <strong>each hub is a functional role</strong> for the programs it covers.</p>
<ul>
<li><strong>Host Team</strong> (and peer-led hubs like Silent Meditation) hold the live session — they run the room, hold dharma authority.</li>
<li><strong>Audio Visual</strong> handles the AV slot for in-person and hybrid sessions.</li>
<li><strong>Greeter</strong> is open sign-up — people choose individual dates to be present at the door.</li>
</ul>
<p>A single program can be staffed by several hubs at once. For an in-person hybrid Saturday Sit: Host Team holds the room, Audio Visual covers the tech, Greeter signs people up to welcome arrivals. Each hub keeps its own rotations independently. When you're on the Rotations tab, <strong>you're working in one hub at a time</strong> — whichever hub the sidebar shows you're in.</p>
<p>If you want to see one program's whole staffing picture — every hub that covers it, in one view — use the cross-hub staffing view described later in this chapter.</p>
<h2>What a rotation is</h2>
<p>A rotation is a rule, not a single assignment. It says: "for this program on this day, here's who hosts each occurrence of the month." The system reads the rotation and creates the actual session assignments on the schedule, automatically, going forward.</p>
<p>You can set up rotations for as many programs and days as the team needs. The schedule fills in around them. When something changes — someone's availability, a program's pattern — you come back here and update the rotation. The schedule catches up.</p>
<h2>How the page is organized</h2>
<p>When you open the Rotations tab, you'll see a card for each recurring program. Each card has a small grid:</p>
<ul>
<li><strong>Rows</strong> are the days of the week the program runs on. A program that runs every weekday gets five rows; a program that runs only on Wednesdays gets one.</li>
<li><strong>Columns</strong> are the occurrences of the month — 1st, 2nd, 3rd, 4th, and 5th.</li>
<li><strong>Cells</strong> show whose name is assigned for that day-and-occurrence.</li>
</ul>
<p>Each row's right side has action buttons that depend on whether a rotation already exists for that day:</p>
<ul>
<li>If no one is assigned: <strong>Set up</strong> — the row is empty and waiting.</li>
<li>If a rotation is in place: <strong>Edit</strong> (change the pattern, change hosts, add an end date) and <strong>Reset [Day]</strong> (clear that day's rotation — see "Resetting one day's rotation" below).</li>
</ul>
<p>At the top right of each program card you'll also see a <strong>View all roles →</strong> link that opens the cross-hub staffing view for that program.</p>
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
<h2>Two reset levels — by day, and by whole program</h2>
<p>Resetting a rotation comes in two sizes, and the distinction matters for multi-day programs. Both preserve past sessions — only the upcoming ones are touched.</p>
<h3>Reset one day's rotation</h3>
<p>On each row, the right-side red button is named for the day — <strong>Reset Monday</strong>, <strong>Reset Tuesday</strong>, etc. Clicking it opens a manage panel scoped to that one day.</p>
<p>The panel offers three options:</p>
<ul>
<li><strong>Remove one person from this rotation</strong> — for shared rotations where one host needs to step back but the others should keep their pattern. Each host appears with a <strong>Remove from rotation</strong> button. Clicking it deletes that person's slots in this day's rotation and clears their upcoming dates on that day. The rotation continues for everyone else. The removed person gets an email letting them know.</li>
<li><strong>End on a specific date</strong> — sessions up to that date stay on the schedule; sessions after are quietly cleared. No email. Use when you know in advance when the rotation is winding down.</li>
<li><strong>Reset this day's rotation</strong> — deletes the day's rule entirely and clears upcoming sessions on that day from hosts' schedules. Each affected host is emailed. Other days for this program are untouched.</li>
</ul>
<p>The key word in every option is "this day" — Tuesday, Wednesday, whichever row's panel you opened. Other days of the same program stay as they were.</p>
<h3>Reset all days for a program</h3>
<p>If a program's entire rotation structure needs to be rebuilt — every day, every host — a <strong>Reset rotations</strong> button at the bottom of each program card does the whole program at once. The confirmation spells out the scope: every rotation rule for this program in this hub, every upcoming session this program has in this hub. Other hubs scheduling this program are unaffected. Past sessions stay in the historical record.</p>
<p>This is the "tear down and start fresh" path. For most coordinator work, the per-day reset is the right tool.</p>
<h2>"I can't make ONE specific date" — that's a sub-request, not a reset</h2>
<p>When a host just needs one specific session covered — they have a doctor's appointment next Tuesday but they're still in the rotation in general — that's <strong>not</strong> a job for any of the Reset actions. It's a per-session sub-request.</p>
<p>The host opens the Schedule tab, finds the row for the one date they can't make, and clicks <strong>Ask the team to cover</strong>. That sends an email to the team and the rotation stays untouched. See the <a href="/admin/manual/host-schedule">Host Schedule chapter</a> for the full flow.</p>
<p>The two exits are distinct on purpose:</p>
<ul>
<li><strong>One date</strong> → "Ask the team to cover" on that session's row in the Schedule tab.</li>
<li><strong>Whole rotation</strong> → "Remove from rotation" in the manage panel here.</li>
</ul>
<p>If a host is leaving the rotation completely, "Remove from rotation" is right. If they just can't make next Tuesday, sub-request is right.</p>
<h2>The cross-hub staffing view</h2>
<p>Each program card has a <strong>View all roles →</strong> link in its header. It opens a read-only page showing every hub that covers this program — Host Team, AV, Greeter — in one place.</p>
<p>For each hub:</p>
<ul>
<li><strong>Single-slot hubs</strong> (Host, AV, Peer-Led) show a per-day table with hosts and the pattern they're on.</li>
<li><strong>Multi-claim hubs</strong> (Greeter) show the next four upcoming sessions with current signup counts.</li>
<li>Each section has an <strong>Edit in [hub] →</strong> link that deep-links to that hub's Rotations tab if you want to actually make changes there.</li>
</ul>
<p>This is the view to use when planning a week and you want to see the whole staffing picture for one program — not just one hub at a time.</p>
<h2>What happens behind the scenes</h2>
<p>When you save a rotation, the system creates session assignments going forward through the end of the year. Once a day, it also checks whether any new sessions need filling and fills them. When new assignments are created, the host gets a notification email with a button that opens the Schedule on the month containing their first upcoming session — so they land on rows they're actually hosting, not a blank current-month view.</p>
<h2>When to come back</h2>
<ul>
<li>A host's availability changes for the foreseeable future.</li>
<li>A new host is ready for a regular slot.</li>
<li>A program's recurring schedule changes.</li>
<li>A host steps back from one day of the rotation, or leaves the rotation entirely.</li>
<li>The team has decided to rebalance.</li>
</ul>
<p>For one-off coverage changes — someone can't make next Tuesday — the host handles it through the Schedule tab (request a sub, claim cover). You don't need to touch the rotation for a single week.</p>
<p>If something feels off — a rotation that won't save, a conflict window that's confusing — message Jesse and we'll work it out together.</p>`;

export async function updateManualHostRotationsV5(db) {
  const existing = await db.manualSection.findUnique({
    where:  { slug: "host-rotations" },
    select: { id: true },
  });

  const data = {
    title:       "Host Rotations",
    description: "How the host coordinator sets up standing rotations — patterns, hosts, per-day Reset, removing one person, ending gracefully, the cross-hub staffing view.",
    hubSlug:     "host-team",
    body:        { type: "rawHtml", html: ROTATIONS_BODY },
    relations:   ["host-schedule", "host-hub-team-management"],
  };

  if (existing) {
    await db.manualSection.update({ where: { slug: "host-rotations" }, data });
    console.log("  ✔ Updated manual section: host-rotations (v5)");
  } else {
    await db.manualSection.create({ data: { slug: "host-rotations", order: 8, ...data } });
    console.log("  ✔ Created manual section: host-rotations (v5)");
  }
}
