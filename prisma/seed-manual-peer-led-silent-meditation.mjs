/**
 * seed-manual-peer-led-silent-meditation.mjs — manual chapter for the
 * Peer-Led Silent Meditation hub.
 *
 * Audience: members of the peer-led-silent-meditation hub. Covers what
 * the hub is for, how to claim a session, what happens when you facilitate,
 * what the Facilitator pill + bell-friendly audio mean in the room, and how
 * to handle being unable to make a session you claimed.
 *
 * Called from migrate.mjs. Upserts a ManualSection with a plain HTML body.
 * Idempotent: checked via migration flag in migrate.mjs.
 */

const PEER_LED_SILENT_MEDITATION_BODY = `<p>This chapter is for members of the Peer-Led Silent Meditation hub — the team that holds Good Morning and Good Evening Silent Meditation. Read it once when you join, and come back as questions come up.</p>

<h2>What this hub is</h2>
<p>The Peer-Led Silent Meditation hub is the home for RIM's morning and evening silent meditation offerings. Unlike the host team — where a coordinator assigns hosts to sessions and one team supports many programs — this hub is built on rotation. Members of the hub take turns leading sessions. The act of claiming a session is what makes you the facilitator for that day; when you're not signed up, you're simply another sangha member sitting alongside everyone else.</p>
<p>The structure is intentional. Silent meditation isn't taught — it's held. Anyone in the hub who knows the form can hold it. The rotation reflects that anyone in this community of practice can step into the seat for a session.</p>

<h2>How you join the hub</h2>
<p>Someone — usually the hub coordinator, sometimes Jesse — invites you. Once you're added, you'll see the hub in your account sidebar at <strong>Peer-Led Silent Meditation</strong>. Read this chapter and the Hub Home welcome content, then introduce yourself in the hub Conversations area so other facilitators know you're in the rotation.</p>
<p>You don't have to claim a session right away. Take a week or two to settle in, read what's there, and see how other facilitators talk about their sessions. When you're ready, claim one.</p>

<h2>Claiming a session</h2>
<p>From your hub home, click the <strong>Host Schedule</strong> link. You'll see a calendar showing the upcoming Good Morning and Good Evening sessions. Sessions that are already claimed show the assigned facilitator's name; sessions that are open show a claim button.</p>
<p>Pick a session you can comfortably hold — meaning you'll be awake, present, and at your computer twenty-two minutes before the start time. Click claim. The system writes your name to the session and the schedule updates immediately. Other facilitators see who's leading; you see your commitment confirmed.</p>
<p>If you're new, start with one session. Don't fill a whole week before you've held even one. The rhythm of leading a sit is something you learn by doing it once.</p>

<h2>What happens when you lead a session</h2>
<p>Twenty-two minutes before the scheduled start time, the session room opens. You're the assigned facilitator, so you can enter early — your dashboard will show a teal &ldquo;Open early as host&rdquo; row with an Enter as host button at the right moment.</p>
<p>When you enter the room, three things will be true that signal the system recognizes you as the facilitator for this session:</p>
<ul>
<li><strong>Your tile shows two pills</strong>: a <strong>Host</strong> pill (teal) because you're the assigned host of this session, and a <strong>Facilitator</strong> pill (warm gold) because the hub treats its assignees as facilitators.</li>
<li><strong>Your audio is on the bell-friendly profile</strong>: ringing bells, singing bowls, and other practice sounds pass through with their full character rather than being suppressed as background noise. This is what makes it possible to lead a sit from your computer — the bell sound the sangha hears is the bell sound you struck.</li>
<li><strong>Your End button reads &ldquo;End&rdquo;</strong> instead of &ldquo;Leave&rdquo;, because you have the authority to close the session for everyone when it ends.</li>
</ul>
<p>From there, you hold the space. The form is yours: a settling, a sit, a closing, however you've come to lead it. The platform stays out of your way.</p>

<h2>When you can't make a session you claimed</h2>
<p>If something comes up and you can't lead a session you've already claimed, request a sub. From the Host Schedule, find the session, and use the &ldquo;Request a sub&rdquo; affordance. This sends a message to the other facilitators in the hub. Whoever's available claims it; you're released.</p>
<p>Try to request subs as early as you can. Other facilitators have lives too — a request twelve hours out is easier to honor than a request twelve minutes out. If nothing comes up by the time the session is due, write briefly in the hub Conversations area so the hub knows what happened and someone can step in.</p>
<p>You can also unclaim a session you've signed up for but no longer want, as long as you do it before the day of the session. After that, the sub-request flow is the right path because it makes the gap visible to others.</p>

<h2>About the role itself</h2>
<p>The Facilitator pill isn't a title in the dharma sense — it's the system's way of saying &ldquo;this person is leading this session right now.&rdquo; You're not asked to teach, give a dharma talk, or answer questions about practice. You're asked to open the room, hold the form, and close it. That's enough. The depth of the sit comes from the sangha sitting together; your role is to make that possible.</p>
<p>If a participant asks something that's outside the form — a question about practice, a question about RIM — point them gently toward the appropriate person or place. Jesse and the guiding teachers hold those conversations.</p>

<h2>If something goes wrong</h2>
<p>If you can't get into the room, can't get your audio working, or something in the session room isn't behaving as expected, the Conversations area in this hub is the first place to ask. Other facilitators have probably hit the same thing and can point you to the fix.</p>
<p>For platform issues that other facilitators can't help with, the coordinator of this hub is the escalation path. For dharma-form questions — &ldquo;is this the way we open the sit?&rdquo; — Jesse or the guiding teachers are the right people.</p>

<h2>Where to read more</h2>
<p>The Session Room chapter (under the host team's section of the manual, but it applies to anyone running a session room) covers the room itself in detail — what every button does, how to mute someone if they're causing disruption, how to handle late arrivals, how to end the session. Worth reading before you lead your first sit.</p>`;

export async function seedManualPeerLedSilentMeditation(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "peer-led-silent-meditation" },
  });

  const data = {
    title: "The Peer-Led Silent Meditation hub",
    description:
      "How the hub works, how to claim a session, what happens when you facilitate, and how to handle a missed shift.",
    hubSlug: "peer-led-silent-meditation",
    body: PEER_LED_SILENT_MEDITATION_BODY,
    relations: ["host-session-room"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "peer-led-silent-meditation" },
      data,
    });
    console.log("  ✔ Updated manual section: peer-led-silent-meditation");
  } else {
    await db.manualSection.create({
      data: { slug: "peer-led-silent-meditation", order: 5, ...data },
    });
    console.log("  ✔ Created manual section: peer-led-silent-meditation");
  }
}
