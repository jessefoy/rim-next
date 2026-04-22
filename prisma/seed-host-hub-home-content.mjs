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
  h(2, "Welcome"),
  p(
    "Hosting is part of practice. The technical work of opening a session — letting people in, getting the sound working, watching the time — and the relational work of holding a container for others to settle are not two different things. They arrive together. The care we give to the microphone is the same care we give to the newcomer who appears on screen for the first time.",
  ),
  sp(),
  p(
    "This isn't a task we volunteer for on top of our practice. It is practice. Showing up for other people to sit with — attending to what they need to arrive, stay, and leave — asks exactly the kind of clear, unhurried attention the cushion asks for. When the two feel continuous rather than separate, the work gets lighter.",
  ),
  sp(),
  p(
    "This hub is the team's home base. Your schedule, conversations with the rest of the team, coverage when you need it, and the people you're doing this alongside are all here. If you're new, read the pinned threads, scroll down to see who else is on the team, and don't hesitate to raise anything in conversations — a coordinator will see it.",
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
