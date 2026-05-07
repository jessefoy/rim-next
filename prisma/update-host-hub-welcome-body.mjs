/**
 * update-host-hub-welcome-body.mjs — Final welcome body for the host-team hub.
 *
 * Written by Jesse (session 106 T3). Sets the welcomeBody field on the
 * host-team Hub record unconditionally — replaces any placeholder content
 * with the authoritative coordinator welcome.
 *
 * Wired into migrate.mjs behind update_host_hub_welcome_body_v1.
 */

const WELCOME_BODY = `<p>Welcome to the Host Hub.</p>
<p>This is where the host team works together. You'll find your upcoming sessions in the <a href="/tools/schedule">Host Schedule</a>, guidance for the role in the <a href="/admin/manual">Staff Manual</a>, and ongoing team conversations under <a href="/account/hub/host-team/conversations">Conversations</a>.</p>
<p>Hosting is practical work and a practice of sangha. The steady presence you bring to a session matters as much as the buttons you press, and the team is here to support each other in both.</p>
<p>Questions? Post them in Conversations, or reach out to your host coordinator.</p>`;

export async function updateHostHubWelcomeBody(db) {
  const hub = await db.hub.findUnique({
    where: { slug: "host-team" },
    select: { id: true },
  });
  if (!hub) {
    console.log("  ⚠ Host Hub (host-team) not found — skipping welcome body update.");
    return;
  }
  await db.hub.update({
    where: { id: hub.id },
    data: { welcomeBody: WELCOME_BODY },
  });
  console.log("  ✔ Updated host-team Hub welcomeBody.");
}
