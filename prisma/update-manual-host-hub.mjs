/**
 * update-manual-host-hub.mjs — Rewrite the host-hub manual chapter.
 *
 * The original was extracted from a static HTML staff manual and has
 * drifted (mentions removed alerts module; misses Tasks, Documents,
 * LiveKit migration, Rotations).
 *
 * This rewrite is an orientation chapter for the average host volunteer
 * — written at an 8th-grade reading level, no jargon, no model names,
 * supportive in tone. The goal: someone new to the team can read this
 * once and have a clear picture of the hub.
 *
 * Body is stored as a plain HTML string (post-Tiptap-migration canonical
 * format). Renderers route it via isHtmlString() format detection.
 *
 * Idempotent at the record level (update by slug). Wired into migrate.mjs
 * behind a one-time flag.
 */

const HOST_HUB_BODY = `<p>The Host Community Hub is the home of RIM's host team. It's where you'll find your schedule, your teammates, the documents you need to do the work, and the tools that keep everything running. If you've just been added to the team, this chapter is here to help you get your bearings.</p>
<p>You don't need to remember everything here. The hub is a place you'll keep coming back to, and what you need will become familiar over time. Read this once, then ignore it until something specific is in question.</p>
<h2>What the host team does</h2>
<p>The host team opens RIM's online sessions and helps people feel welcomed and supported when they arrive. Most of RIM's online practice — drop-in sits, classes, retreats, dharma study — is held by a host who shows up a few minutes early, opens the room, and tends the space while the teacher teaches.</p>
<p>Hosting is a quiet kind of service. You don't need to be a meditation expert. You don't need to be a tech expert. You need to be willing to be present, to welcome people, and to keep the space steady. The team holds you while you do that.</p>
<h2>Who's on the team</h2>
<p>The team has a host coordinator — the person you go to with questions, scheduling problems, anything tricky that comes up in a session, or anything you're not sure about. You'll see who the coordinator is in the Members tab, with a small badge next to their name.</p>
<p>The rest of the team is a small group of hosts who tend RIM's regular online sessions on rotation. You'll see them in the hub.</p>
<p>Jesse is RIM's guiding teacher. He's available for things that need a teacher's attention — a participant in crisis, a complicated pastoral situation, anything that feels bigger than a host's role. For most things, the host coordinator is the right person to ask.</p>
<h2>What you'll find in the hub</h2>
<p>When you open the hub, you'll see a sidebar on the left and the main content in the middle. The sidebar lists everything in the hub.</p>
<p><strong>Home.</strong> A short welcome message from the coordinator and a quick look at the team's offerings this month — how many sessions are happening, who's hosting, who's available, and whether any sessions still need a host.</p>
<p><strong>Conversations.</strong> Where the team talks. Threads with replies, like a quiet message board. You can start a thread, reply, or react to a reply. Use it for questions, gratitudes, or anything the team should hear together.</p>
<p><strong>Documents.</strong> Reference material for hosting. The shelves are:</p>
<ul>
<li><em>Onboarding</em> — read these first if you're new</li>
<li><em>The Practice of Hosting</em> — the relational side of the work</li>
<li><em>Running a Session</em> — the practical steps</li>
<li><em>When Things Go Wrong</em> — what to do in disruptive moments</li>
<li><em>For Coordinators</em> — coordinator-only working materials</li>
</ul>
<p><strong>Members.</strong> Who's on the team, and whether they're active, paused, or away. The coordinator uses this to manage the team; you can use it to see who else is hosting.</p>
<p><strong>Schedule</strong> (under Tools). The page that shows when you're hosting, when the team needs help, and how to ask for cover when you can't make a session. This is where most of the day-to-day happens. You can bookmark it directly: <strong>/tools/schedule</strong>.</p>
<h2>Where to go for what</h2>
<p>A quick map for when you need something specific:</p>
<table>
<thead><tr><th>If you want to…</th><th>Open…</th></tr></thead>
<tbody>
<tr><td>See what you're hosting this week</td><td>Schedule</td></tr>
<tr><td>Know how to run your first session</td><td>Documents → <em>Onboarding</em></td></tr>
<tr><td>Ask the team to cover for you</td><td>Schedule (your session card has the link)</td></tr>
<tr><td>Read about the relational side of hosting</td><td>Documents → <em>Stewardship Practices</em></td></tr>
<tr><td>Figure out what to do during a disruption</td><td>Documents → <em>Disruption Response</em></td></tr>
<tr><td>Talk to the team about something</td><td>Conversations</td></tr>
<tr><td>Reach the host coordinator</td><td>Conversations, or message them directly</td></tr>
</tbody>
</table>
<h2>What you don't need to do</h2>
<p>You don't need to log into the hub every day. The schedule sends you reminders by email when something needs your attention. You can come into the hub when you want to, when something comes up, or when you're about to host.</p>
<p>You don't need to read every document at once. The most important ones are in <em>Onboarding</em>. The rest are there when you want them.</p>
<p>You don't need to know every part of the system. The hub will quietly do its job. You're here to host sessions and care for the people who arrive, not to maintain software.</p>
<h2>A small reminder</h2>
<p>You're new to a thing that takes some time to learn. That's expected. Mistakes are forgiven before they happen, and questions are welcome at any moment.</p>
<p>If something here doesn't make sense, or you can't find what you're looking for, or anything feels confusing — message the host coordinator. The hub is meant to make hosting easier, not harder. If it isn't doing that yet, that's worth fixing.</p>
<p>Welcome to the team.</p>`;

export async function updateManualHostHub(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-hub" },
    select: { id: true },
  });

  const data = {
    title: "Host Community Hub",
    description: "An orientation to the host hub — what's in it, who's on the team, and where to go for what.",
    hubSlug: "host-team",
    body: HOST_HUB_BODY,
    relations: ["volunteer-roles", "programs", "host-schedule", "host-hub-team-management"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-hub" },
      data,
    });
    console.log("  ✔ Updated manual section: host-hub");
  } else {
    // Order 6 mirrors the original chapter position; only used if a fresh
    // database has somehow missed the original seed run.
    await db.manualSection.create({
      data: { slug: "host-hub", order: 6, ...data },
    });
    console.log("  ✔ Created manual section: host-hub");
  }
}
