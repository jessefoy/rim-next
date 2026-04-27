/**
 * seed-host-hub-onboarding-docs.mjs — Seed onboarding HubDocuments for host-team.
 *
 * Audience: a host volunteer who has just been added to the team and is
 * about to host their first session. Plain language, concrete steps,
 * reassuring tone. Aligned with RIM's design philosophy: clear seeing,
 * generosity toward overwhelmed users, calm interfaces.
 *
 * Called from migrate.mjs. Idempotent via migration flag.
 *
 * The documents are native (BlockNote JSON), authored by the first
 * coordinator of the host-team hub (or first ADMIN as fallback).
 */

let _id = 0;
const uid = () => `hub-doc-${++_id}`;

const t = (text) => ({ type: "text", text, styles: {} });
const b = (text) => ({ type: "text", text, styles: { bold: true } });
const i = (text) => ({ type: "text", text, styles: { italic: true } });

const p = (...parts) => ({
  id: uid(), type: "paragraph", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

const sp = () => ({ id: uid(), type: "paragraph", props: {}, content: [], children: [] });

const h = (level, text) => ({
  id: uid(), type: "heading", props: { level },
  content: [t(text)], children: [],
});

const li = (...parts) => ({
  id: uid(), type: "bulletListItem", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

const quote = (text) => ({
  id: uid(), type: "paragraph", props: { textAlignment: "left", textColor: "default", backgroundColor: "default" },
  content: [{ type: "text", text, styles: { italic: true } }],
  children: [],
});

const FIRST_TIME_HOSTING_BODY = [
  p("A practical walkthrough for your first session as a RIM host. You don't need to memorize anything here — keep this open in another tab while you host."),
  sp(),

  h(2, "A few minutes before the session"),
  sp(),
  p(b("1. Find your session."), " Open the Host Schedule. Your session should appear under the ", b("Mine"), " filter, with the date, time, and program name. If it doesn't appear there, double-check you're signed into the correct account."),
  sp(),
  p(b("2. Open the session room."), " From the schedule card, click into your session — or visit ", b("/session/[program-slug]"), " directly. You'll be prompted to allow camera and microphone access. Say yes. The room opens with your video on and audio muted by default."),
  sp(),
  p(b("3. Quick check."), " Confirm:"),
  li("Your name appears correctly on your video tile"),
  li("The microphone indicator moves when you speak"),
  li("You can see and hear yourself clearly"),
  sp(),
  p("If something looks off, refresh the page and try again. If it's still off, message the host coordinator before the session begins."),
  sp(),

  h(2, "When members arrive"),
  sp(),
  p(b("Welcoming."), " As people arrive, their tiles populate the room. The first minute or two is often quiet — that's normal. Some members join right at start time, others a few minutes early."),
  sp(),
  p(b("At session start time:")),
  li("Greet the group. A simple \"Welcome, everyone — glad to have you here\" is plenty."),
  li("If there are first-time attendees, you may want to welcome them by name. (You'll see a small new-member indicator on their tile.)"),
  li("Announce what you're about to do: a sit, a dharma reading, an open discussion."),
  sp(),
  p(b("A short welcome script you can adapt:")),
  sp(),
  quote("Welcome to [program name]. I'm [your name], and I'll be your host today. We'll begin with [meditation/reading/etc.]. The session is [length] long. If you need to step away, your camera and audio remain yours to control — feel free to do whatever you need."),
  sp(),

  h(2, "During the session"),
  sp(),
  p(b("You have host controls."), " As a host, you can:"),
  li(b("Mute participants"), " (individually or all at once) if there's background noise"),
  li(b("Step in"), " if a participant needs technical help"),
  li(b("End the session"), " when you're done"),
  sp(),
  p("These controls live in the session toolbar — you'll see icons that other members don't."),
  sp(),
  p(b("If someone joins with their microphone unmuted mid-meditation,"), " that's the most common moment of intervention. Click their tile and use \"Mute participant.\" It's gentle, no notification is sent."),
  sp(),
  p(b("If someone has technical trouble"), " (frozen video, no audio), they may write in chat asking for help. You can guide them to refresh — but you don't have to fix everyone's tech. \"Internet has its moods today\" is a perfectly good acknowledgment, and you can let it pass."),
  sp(),

  h(2, "When the session ends"),
  sp(),
  p(b("End cleanly.")),
  li("Acknowledge the closing — \"Thank you, everyone. Be well.\""),
  li("Pause a moment so people can say goodbye if they want to"),
  li("Click the ", b("End session"), " button. This closes the room for everyone."),
  sp(),
  p("If you forget, the room will eventually close on its own — but ending intentionally is gentler for everyone."),
  sp(),

  h(2, "If something goes wrong"),
  sp(),
  p(b("You can't get into the room."), " Refresh first. Then try a different browser (Chrome and Edge are most reliable on Mac, Edge or Chrome on Windows). If it's still not working, message the host coordinator and see if there's time to find a backup."),
  sp(),
  p(b("Audio breaks for everyone."), " Refresh once. If that fails, end the session and follow up with a short email explaining what happened. Members are forgiving."),
  sp(),
  p(b("You realize last-minute you can't make the session."), " Open the schedule, click your session, and use \"Ask the team to cover.\" If it's truly last-minute (less than 30 minutes), also reach out to the coordinator directly — that gives the best chance of finding someone fast."),
  sp(),

  h(2, "A reminder"),
  sp(),
  p("Your first time hosting won't be perfect. That's okay — it's also not what's expected. You're showing up to hold a space where people can practice together. The form matters less than the presence."),
  sp(),
  p("If something during your first session was confusing or the page got in your way, please tell the host coordinator. We want hosting to feel possible, not technical."),
  sp(),
  p("Welcome to the team."),
];

export async function seedHostHubOnboardingDocs(db) {
  // Find the host-team hub
  const hub = await db.hub.findUnique({
    where: { slug: "host-team" },
    select: { id: true },
  });
  if (!hub) {
    console.log("  ⚠ host-team hub not found — skipping onboarding docs seed");
    return;
  }

  // Find an author to attribute the document to.
  // Prefer the hub's first coordinator; fall back to any ADMIN user.
  let authorId = null;
  const coordinator = await db.hubMember.findFirst({
    where: { hubId: hub.id, isCoordinator: true, status: "ACTIVE" },
    select: { userId: true },
    orderBy: { joinedAt: "asc" },
  });
  if (coordinator) {
    authorId = coordinator.userId;
  } else {
    const admin = await db.user.findFirst({
      where: { roles: { has: "ADMIN" } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (admin) authorId = admin.id;
  }
  if (!authorId) {
    console.log("  ⚠ No coordinator or ADMIN user found — skipping onboarding docs seed");
    return;
  }

  // Idempotent by hub + label. Update body if exists; create otherwise.
  const docs = [
    {
      label: "Your First Time Hosting",
      description: "A practical walkthrough for your first session as a host. Open it in another tab while you host.",
      category: "Onboarding",
      body: FIRST_TIME_HOSTING_BODY,
    },
  ];

  // Ensure the "Onboarding" category exists on the hub.
  const existingHub = await db.hub.findUnique({
    where: { id: hub.id },
    select: { documentCategories: true },
  });
  const categories = existingHub?.documentCategories ?? [];
  if (!categories.includes("Onboarding")) {
    await db.hub.update({
      where: { id: hub.id },
      data: { documentCategories: { push: "Onboarding" } },
    });
  }

  let created = 0;
  let updated = 0;
  for (const d of docs) {
    const existing = await db.hubDocument.findFirst({
      where: { hubId: hub.id, label: d.label },
      select: { id: true },
    });
    if (existing) {
      await db.hubDocument.update({
        where: { id: existing.id },
        data: {
          description: d.description,
          category: d.category,
          body: d.body,
          isNative: true,
          fileType: "DOC",
          url: null,
        },
      });
      updated++;
    } else {
      await db.hubDocument.create({
        data: {
          hubId: hub.id,
          addedById: authorId,
          label: d.label,
          description: d.description,
          category: d.category,
          body: d.body,
          isNative: true,
          fileType: "DOC",
          url: null,
        },
      });
      created++;
    }
  }

  console.log(`  ✔ Host hub onboarding docs (${created} created, ${updated} updated)`);
}
