/**
 * update-manual-host-schedule.mjs — Refresh the host-schedule chapter.
 *
 * The existing chapter (~3,000 words) is already in the right voice —
 * plain language, host-friendly, no jargon. This update is lighter than
 * host-hub or host-hub-team-management:
 *
 *   1. Adds a new "The two tabs at the top" section explaining the
 *      Schedule | Rotations tab strip (session 98 — Standing Assignments).
 *   2. References "the host coordinator" generically rather than naming
 *      a specific person — keeps the chapter portable across role changes.
 *   3. Updates sidebar reference to "Host Schedule" (the actual app-link
 *      label).
 *
 * Body switches from BlockNote JSON to plain HTML string (post-Tiptap
 * canonical format). Renderers route via isHtmlString().
 *
 * Idempotent at the record level (update by slug). Wired into migrate.mjs
 * behind a one-time flag.
 */

const HOST_SCHEDULE_BODY = `<p>Welcome. The Host Schedule is where you see what's coming up — your own commitments, what the team needs help with, and what your teammates are hosting. Everything happens through this one page.</p>
<p>This guide is written so you can read it once and have a clear picture, or come back later and skim for a specific answer. Take your time.</p>
<h2>Getting there</h2>
<p>Sign in to your RIM account. From your dashboard, open the <strong>Host Hub</strong> and click <strong>Host Schedule</strong> in the left sidebar. The full address is <strong>/tools/schedule</strong> — useful if you want to bookmark it on your phone.</p>
<h2>The two tabs at the top</h2>
<p>Across the top of the page, just under the title, you'll see two tabs: <strong>Schedule</strong> and <strong>Rotations</strong>.</p>
<p><strong>Schedule</strong> is where most of the day-to-day happens — your sessions, the team's sessions, who needs help. This is the tab you'll use almost all the time.</p>
<p><strong>Rotations</strong> is for the coordinator. It's where the host coordinator sets up the recurring pattern of who hosts what — say, "Sarah takes the Tuesday morning sit through June." Once the rotations are set, the schedule fills in the actual sessions on its own. As a host, you don't need to use the Rotations tab. You'll just see your standing assignments appear in your schedule.</p>
<p>The rest of this chapter is about the Schedule tab.</p>
<h2>What you see when you arrive</h2>
<p>The page opens to the current month. Reading from the top:</p>
<ul>
<li><strong>The month name</strong> (e.g. "April 2026") with arrows on either side. Use the arrows to step backward or forward a month. A small <strong>This month</strong> button appears whenever you've navigated away from today, so you can always jump back.</li>
<li><strong>Filter pills</strong> — small rounded buttons that help you focus on what you care about. More on these below.</li>
<li><strong>Cards</strong> — each card is one upcoming session. Date and time, the program name and format, who's hosting (or whether nobody has signed up yet), and a button if there's something for you to do.</li>
<li><strong>"Earlier this month"</strong> — a quiet, collapsed section at the bottom. It holds the sessions that already happened. You can open it for reference, but you can't take action on past sessions.</li>
</ul>
<h2>The four buttons you might see</h2>
<p>There are really only four actions you'll ever take from this page. Each one is a clearly-labeled button on a session card.</p>
<h3>"Yes, I can host this"</h3>
<p>This appears on sessions that haven't been claimed by anyone yet. The card shows <strong>Needs a host</strong> in orange.</p>
<p>Click the button. A confirmation window opens, telling you exactly what you're committing to — the program, the date, the time. If you're sure, click <strong>Yes, I'll host this</strong>. If you change your mind, click <strong>Not yet</strong> — nothing happens.</p>
<p>Once confirmed, the team gets notified, the session moves to your column, and you'll see it under the <strong>Mine</strong> filter.</p>
<h3>"Yes, I can cover"</h3>
<p>This appears on sessions where another host has asked the team to cover for them — they have something come up and they need help. The card shows <strong>[Their name] needs help</strong> or <strong>Needs a sub</strong>.</p>
<p>It's the same flow as taking a session — click, confirm, done. Once you confirm, the original host gets an email letting them know you've stepped in. They can relax.</p>
<h3>"Ask the team to cover"</h3>
<p>This appears on your own sessions. You'll see it as a small text link at the bottom of any card you're hosting.</p>
<p>Click it when you can't make a session. A window opens. You can add a short note for the team if you want — something like "family event came up" or "feeling under the weather, no need to call back." Notes are optional. Once you click <strong>Send to the team</strong>, every other host on the team gets an email with a link that takes them straight to a confirmation for your session. One of them will likely step in.</p>
<p><strong>One important thing:</strong> until someone covers, you're still officially the host. If nobody picks it up, you're expected to host. Please plan accordingly — if it's urgent, also reach out to the host coordinator directly so they know.</p>
<h3>"Cancel my request"</h3>
<p>If you've asked for cover and your situation changes — your sister cancels her visit, your back feels better, your meeting moves — you can take it back. On a card where you've asked for cover, you'll see <strong>Cancel my request</strong> as a small link. Click it, confirm, and you're back to hosting that session normally. The team will know your request is closed.</p>
<p>This is here on purpose. Changing your mind is fine.</p>
<h2>Filter pills — focusing the page</h2>
<p>Across the top of the page, just below the month, are these pills:</p>
<ul>
<li><strong>All</strong> — every upcoming session this month, no filter applied. This is the default.</li>
<li><strong>Needs help</strong> — only sessions where help is needed. Open sessions, sessions where someone has asked for cover. The shortest path to "what can I do?"</li>
<li><strong>Mine</strong> — only sessions you're hosting. Useful for a quick check of your own commitments.</li>
<li><strong>My requests</strong> — only sessions where you've asked the team to cover. This pill only appears if you have an open request — otherwise it stays hidden.</li>
</ul>
<p>Pick one at a time. The number on each pill tells you how many sessions match.</p>
<h2>Looking at a teammate's schedule</h2>
<p>The <strong>Mine</strong> pill has a small downward arrow next to it. Click the arrow (not the pill itself) and a list of every host on the team appears. Pick anyone from the list, and the page switches to show <em>their</em> schedule — what they're hosting, what they need help with.</p>
<p>This is for awareness — you might want to see whether a teammate is overloaded or quiet, or check who's hosting the program you're attending. You can't <em>act on their behalf</em> (you can't ask the team to cover for someone else), but if they have an open cover request you'll see it and can step in just like you would from the regular view.</p>
<p>To switch back to your own view, click the arrow again and pick <strong>Mine</strong> from the top of the list.</p>
<h2>Emails — the one-tap path</h2>
<p>When a teammate asks the team to cover, you get an email. The email has a button — <strong>Cover this session →</strong> — that takes you directly to the schedule page with the cover-confirmation already open for the right session. One tap from your email to confirming you'll cover. You don't need to find the session manually or remember what day it was on.</p>
<p>Same idea applies if anyone sends you a link to claim a specific session — clicking it opens the confirmation directly. You always get a chance to confirm before anything is committed; the link doesn't sign you up by itself.</p>
<h2>"Earlier this month"</h2>
<p>As the month progresses, sessions that have happened don't clutter the top of the page. They get tucked into a small collapsed section at the bottom called <strong>Earlier this month</strong>.</p>
<p>Click the arrow to expand it. The cards inside are muted and have no buttons — you can't take action on something that's already passed. It's just there if you want to remember what happened, or check who hosted what.</p>
<p>This section only appears when you're viewing the current month. If you navigate to a past or future month, all sessions just appear in the regular flow.</p>
<h2>If something feels off</h2>
<p>None of the actions on this page are irreversible. Every confirmation can be cancelled before it happens. After the fact, you can ask the team to cover, cancel a request, or reach out to the host coordinator to fix things directly. Mistakes are fine.</p>
<p>If anything is confusing — a button you can't find, a label that doesn't make sense, a workflow that feels harder than it should be — tell the host coordinator. The page is meant to make hosting easy. If it doesn't, that's worth fixing.</p>
<h2>A small reminder</h2>
<p>Hosting is volunteer work. Your time is a real gift to the community. The page is designed so that saying yes is easy, asking for help is easy, and changing your mind doesn't feel like failure. None of those things should ever feel hard.</p>
<p>Welcome to the team.</p>`;

export async function updateManualHostSchedule(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-schedule" },
    select: { id: true },
  });

  const data = {
    title: "Host Schedule",
    description: "How to use the Host Schedule — claim sessions, ask the team to cover, step in for teammates.",
    hubSlug: "host-team",
    body: HOST_SCHEDULE_BODY,
    relations: ["host-hub", "host-hub-team-management", "programs"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-schedule" },
      data,
    });
    console.log("  ✔ Updated manual section: host-schedule");
  } else {
    // Order 7 mirrors the original chapter position; only used if a fresh
    // database has somehow missed the original seed run.
    await db.manualSection.create({
      data: { slug: "host-schedule", order: 7, ...data },
    });
    console.log("  ✔ Created manual section: host-schedule");
  }
}
