/**
 * seed-host-hub-home-content.mjs — placeholder content for the Host Hub home.
 *
 * Two fields on the `host-team` Hub:
 *   - welcomeBody → rendered as the "Welcome" block in the host view
 *   - homeContent → rendered as the "Team directory" block in the coordinator view
 *
 * Only writes if the field is currently null — never overwrites coordinator
 * edits. Called from migrate.mjs behind a migration flag.
 */

let _id = 0;
const uid = () => `hh-home-${++_id}`;

const t = (text) => ({ type: "text", text, styles: {} });
const b = (text) => ({ type: "text", text, styles: { bold: true } });

const p = (...parts) => ({
  id: uid(),
  type: "paragraph",
  props: {},
  content: parts.flat().map((part) => (typeof part === "string" ? t(part) : part)),
  children: [],
});

const sp = () => ({ id: uid(), type: "paragraph", props: {}, content: [], children: [] });

const h = (level, text) => ({
  id: uid(),
  type: "heading",
  props: { level },
  content: [t(text)],
  children: [],
});

const welcomeBody = [
  h(2, "Welcome to the Host team"),
  p(
    "Hosts are the people who open each session, settle it, hold the container, and send it off. You're the first face a newcomer sees and the last one a departing meditator remembers. Thank you for doing this work.",
  ),
  sp(),
  p(
    "This hub is your home base. The schedule tool shows your upcoming sessions. Conversations is where the team works out anything that comes up. Coordinators manage the team from here — if you need coverage, need to step back for a stretch, or need to raise something, this is where to do it.",
  ),
  sp(),
  p(
    "If you're new: take a look around. Read the pinned threads below. Scroll down to see who else is on the team. The ",
    b("If something goes wrong"),
    " block covers the common wrinkles.",
  ),
];

const homeContent = [
  h(2, "Team directory"),
  p(
    "This block is coordinator-authored prose. Rewrite it as the team changes. Replace these placeholder paragraphs with the real statements of who-does-what on your team, in your own words.",
  ),
  sp(),

  h(3, "Virtual Host Coordinator"),
  p(
    "Leads the Host team. Adds new hosts, handles pauses, manages coverage when things fall through, and keeps the hub working. Point person for anything the team as a whole needs to resolve.",
  ),
  sp(),

  h(3, "Host Managers"),
  p(
    "Hosts who also hold the HOST_MANAGER role. They can reassign sessions, claim sub requests on behalf of the team, and see diagnostic context the regular host view doesn't expose. Rotate into the role by coordinator decision.",
  ),
  sp(),

  h(3, "Hosts"),
  p(
    "The regular hosting roster. Each host takes a standing assignment or picks up individual sessions as schedules allow. When a host needs to step back temporarily, the coordinator pauses them rather than removing — they remain part of the team.",
  ),
  sp(),

  p(
    "When someone moves roles, joins, or steps back, update this block so the team directory reflects the current shape of things.",
  ),
];

export async function seedHostHubHomeContent(db) {
  const hub = await db.hub.findUnique({
    where: { slug: "host-team" },
    select: { id: true, welcomeBody: true, homeContent: true },
  });
  if (!hub) {
    console.log("  ⚠ Host Hub (host-team) not found — skipping home content seed.");
    return;
  }

  const updates = {};
  if (!hub.welcomeBody) updates.welcomeBody = welcomeBody;
  if (!hub.homeContent) updates.homeContent = homeContent;

  if (Object.keys(updates).length === 0) {
    console.log("  ⏭ Host Hub home content already present — skipping.");
    return;
  }

  await db.hub.update({ where: { id: hub.id }, data: updates });
  console.log(
    `  ✔ Seeded Host Hub home content: ${Object.keys(updates).join(", ")}.`,
  );
}
