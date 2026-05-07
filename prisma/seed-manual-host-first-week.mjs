/**
 * seed-manual-host-first-week.mjs — "Your first week as a host" chapter.
 *
 * Audience: new hosts on the host team. Covers the first week:
 * what to do right after joining, how to prepare for the first session,
 * what the first session feels like, patterns in the first month,
 * and where to go with questions.
 *
 * Called from migrate.mjs. Upserts a ManualSection with a plain HTML
 * body (post-Tiptap canonical format). Idempotent: checked via
 * migration flag in migrate.mjs.
 */

const HOST_FIRST_WEEK_BODY = `<p>This chapter is for your first week on the host team. Read it once now, and come back to it as questions come up.</p>

<h2>Right after you join</h2>
<p>The role-assignment email pointed you here, to the host hub, and to the staff manual. Log in, click into the host hub, and read the Host Role Overview chapter alongside this one. Together they take about fifteen minutes.</p>
<p>If you can, spend a few minutes with the Session Room chapter before your first assignment. Knowing where the buttons are is much less important than knowing why they're there — but you'll feel more grounded if you've already seen them once.</p>

<h2>Before your first session</h2>
<p>Look up your first session in the Host Schedule — the program, the day, the time, who teaches it. Open the program's detail page and read the description; some sessions have specific contexts (an ongoing course, a one-off retreat, an open drop-in) that shape the welcome you offer.</p>
<p>A few practical preparations:</p>
<ul>
<li>Test your microphone and camera in your browser before the day. Use Chrome or Firefox on a wired connection if you can.</li>
<li>Plan to be at your computer ten minutes before your scheduled start time — the room opens twelve minutes before the session.</li>
<li>Remove obvious distractions from your space. The host's calm extends through the screen.</li>
</ul>
<p>If shadowing an experienced host first would help you settle in, ask the coordinator — there's no formal program, but most regular hosts are happy to be shadowed when their schedule allows.</p>

<h2>During and after</h2>
<p>Twelve minutes before your scheduled time, click into the session from the schedule. The room opens. Greet people warmly as they arrive, especially anyone new. The teacher will arrive on their own timing.</p>
<p>Your role during the session itself: hold the room, watch the chat, address technical issues if they come up, and stay quiet otherwise. The teacher leads. You support.</p>
<p>When the session ends, give participants a moment to say goodbye, then close the room. Take a minute to notice how it landed for you. If anything came up you want to flag — a participant who seemed off, something that felt unusual — share it in the team Conversations tab.</p>

<h2>The first month</h2>
<p>Two patterns emerge once you've hosted a few sessions:</p>
<ul>
<li><strong>Standing rotations.</strong> If you're hosting a recurring session regularly, the coordinator may add you to the standing rotation. The schedule then auto-assigns you each week.</li>
<li><strong>Sub-requests.</strong> If a date doesn't work, post a sub-request in the schedule. Other hosts on the team can claim it. This is normal and expected.</li>
</ul>
<p>You'll also start to recognize regulars. Some sessions have a small core community of repeat participants; others have constant flux. Both are part of the rhythm of RIM.</p>

<h2>When questions come up</h2>
<p>Practical questions about the schedule, controls, or team protocols — post them in the team Conversations tab, or reach out to your host coordinator directly.</p>
<p>Questions that feel personal or pastoral — about a participant, about how a session affected you, about something that needs a teacher's attention — Jesse is available, but most things land well with the coordinator first.</p>
<p>There's no expectation that you have it figured out. The team learns together.</p>`;

export async function seedManualHostFirstWeek(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-first-week" },
    select: { id: true },
  });

  const data = {
    title: "Your first week as a host",
    description:
      "What to do in your first week — joining the hub, preparing for your first session, and what to expect.",
    hubSlug: "host-team",
    body: HOST_FIRST_WEEK_BODY,
    relations: ["host-hub", "host-schedule", "host-session-room"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-first-week" },
      data,
    });
    console.log("  ✔ Updated manual section: host-first-week");
  } else {
    // Order 4 places it before the existing host chapters in DB ordering.
    // Display order within the host-team group is controlled by manualGroups.ts.
    await db.manualSection.create({
      data: { slug: "host-first-week", order: 4, ...data },
    });
    console.log("  ✔ Created manual section: host-first-week");
  }
}
