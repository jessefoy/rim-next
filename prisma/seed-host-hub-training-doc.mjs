/**
 * seed-host-hub-training-doc.mjs — Training session hub document for host-team.
 *
 * Seeds a single HubDocument ("Training Session — May 2026") in the new
 * "Training" category. Sent to hosts in advance; kept as a reference
 * document through the cutover period.
 *
 * Idempotent at the record level (upsert by hub + label). Wired into
 * migrate.mjs behind a migration flag.
 */

const TRAINING_DOC = `<p>This document covers the May training session — what we're doing, what you should look at beforehand, what the session itself will feel like, and what comes after. Keep it here as a reference through the cutover period.</p>
<h2>What's changing</h2>
<p>RIM is moving from Zoom to a purpose-built session room that lives inside the site. It works like Zoom — video, audio, chat, mute controls — but it's designed for how we host: host controls built in, the host schedule and team tools in the same place, no separate app to install or account to manage.</p>
<p>The Zoom subscription renews on June 17. We need to be fully running on the new system before that date so we can cancel and not pay another year.</p>
<h2>Before the training session</h2>
<p>Please read these chapters in the Staff Manual. The training session assumes you've had a first look; we won't be reading them aloud together.</p>
<ul>
<li><a href="/admin/manual/host-first-week">Your first week as a host</a> — orientation to the hub, the tools, and what to expect in your first month. If you're new, this is the starting point. If you're experienced, it shows you what we're telling new hosts.</li>
<li><a href="/admin/manual/host-hub">The Host Hub</a> — what's in the hub and how to move around it.</li>
<li><a href="/admin/manual/host-schedule">The Host Schedule</a> — how to read your assignments, request a sub, and (for coordinators) how to manage the Rotations tab.</li>
<li><a href="/admin/manual/host-session-room">The Session Room</a> — how the session room works, what each control does, and what to do when something goes wrong.</li>
</ul>
<p>Read for orientation, not memorization. The point is that none of the controls in the training session should feel completely unfamiliar.</p>
<h2>What the training session will cover</h2>
<p>We'll spend most of the time in a live session room, working through what actually happens during a session.</p>
<p>The agenda, roughly:</p>
<ol>
<li><strong>Setup check.</strong> Everyone opens the session room. We verify audio prompts, camera, and basic navigation — the stuff that trips people up the first time, when they can afford to work through it.</li>
<li><strong>Host controls.</strong> We practice Mute, Mute All, and End for All. Not talking about them — actually pressing the buttons and seeing what happens. The coordinator will walk through when each one applies.</li>
<li><strong>Step in as Host.</strong> One host steps out and back in as host. There's a brief reconnect — normal and expected. We practice it once so no one is surprised by it in a live session.</li>
<li><strong>Per-participant mute.</strong> Practice muting one participant from the participants panel while leaving everyone else unmuted.</li>
<li><strong>Sub requests.</strong> If time allows, we'll walk through requesting and claiming a sub in the Host Schedule tool.</li>
</ol>
<p>The training is mostly doing, not watching. Come ready to interact with the controls.</p>
<h2>After the training session</h2>
<p>There will be a brief period — a week or two — for first solo sessions before we go fully live. The coordinator will pair newer hosts with experienced ones for the first one or two sessions, so no one hosts solo without someone available to reach.</p>
<p>Then a final Zoom session, and after that, all sessions run on the new system. The Zoom cancellation happens before June 17.</p>
<h2>Cutover dates</h2>
<table>
<tbody>
<tr><td>Maria's onboarding</td><td>[TBD]</td></tr>
<tr><td>Pilot session (Jesse + Maria + one volunteer host)</td><td>[TBD]</td></tr>
<tr><td>Full team training</td><td>[TBD]</td></tr>
<tr><td>First solo sessions</td><td>1–2 weeks after training</td></tr>
<tr><td>Final Zoom session</td><td>[TBD]</td></tr>
<tr><td>Zoom cancellation deadline</td><td>June 17, 2026</td></tr>
</tbody>
</table>
<p>Jesse will fill in the [TBD] dates and update this document. The sequencing is fixed; the specific dates are not yet.</p>
<h2>Questions</h2>
<p>Post them in <a href="/account/hub/host-team/conversations">Conversations</a>, or message the host coordinator directly. You don't need to wait until the training session — if something is unclear right now, ask now.</p>`;

export async function seedHostHubTrainingDoc(db) {
  const hub = await db.hub.findUnique({
    where: { slug: "host-team" },
    select: { id: true, documentCategories: true },
  });
  if (!hub) {
    console.log("  ⚠ host-team hub not found — skipping training doc seed");
    return;
  }

  // Find an author. Prefer the hub's first coordinator; fall back to first ADMIN.
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
    console.log("  ⚠ No coordinator or ADMIN user found — skipping training doc seed");
    return;
  }

  // Add "Training" category if not present, preserving existing order.
  const existing = hub.documentCategories ?? [];
  if (!existing.includes("Training")) {
    await db.hub.update({
      where: { id: hub.id },
      data: { documentCategories: { set: [...existing, "Training"] } },
    });
  }

  const label = "Training Session — May 2026";
  const found = await db.hubDocument.findFirst({
    where: { hubId: hub.id, label },
    select: { id: true },
  });

  if (found) {
    await db.hubDocument.update({
      where: { id: found.id },
      data: {
        description: "What's changing, what to read beforehand, what we'll do together, and the cutover timeline.",
        category: "Training",
        body: TRAINING_DOC,
        isNative: true,
        fileType: "DOC",
        url: null,
      },
    });
    console.log("  ✔ Training doc updated (host-team hub)");
  } else {
    await db.hubDocument.create({
      data: {
        hubId: hub.id,
        addedById: authorId,
        label,
        description: "What's changing, what to read beforehand, what we'll do together, and the cutover timeline.",
        category: "Training",
        body: TRAINING_DOC,
        isNative: true,
        fileType: "DOC",
        url: null,
      },
    });
    console.log("  ✔ Training doc created (host-team hub)");
  }
}
