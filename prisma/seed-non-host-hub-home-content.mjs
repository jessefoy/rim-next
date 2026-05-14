/**
 * seed-non-host-hub-home-content.mjs — placeholder welcome content for the
 * non-host operational hubs (courses, registrar, support).
 *
 * The host hub has its own substantive seed (seed-host-hub-home-content.mjs);
 * the other three hubs entered a session-115 inventory blank — empty
 * welcomeHeadline + welcomeBody, leaving the Hub Home screen sparse for any
 * coordinator who joins. This seed gives each hub a starter welcome message
 * in the same practice-grounded voice, so the surface reads as intentional
 * rather than abandoned.
 *
 * Storage: HTML strings (post-Tiptap-migration shape, matches what
 * `convert_hub_content_to_html` produces). Renderers detect HTML via
 * `isHtmlString` and route through the sanitize-html path.
 *
 * Idempotency: writes welcomeBody only when null. Never overwrites coordinator
 * edits. Skips homeContent entirely — that's a coordinator-authored block
 * ("Team directory" on the host hub) that each team can write when it has a
 * stable shape; no useful placeholder.
 *
 * Called from migrate.mjs behind a one-shot migration flag.
 */

const HUB_WELCOMES = {
  courses: `<h2>Welcome</h2>
<p>Writing dharma is slow, deliberate work. A line that lands cleanly is usually the result of many lines that didn't. The teaching team's job in this hub isn't to produce material on a deadline — it's to give the writing the attention the dharma deserves, and to sequence it into something members can move through without losing their footing.</p>
<p>What members see is the Course Manager: the courses they enrolled in, the lessons inside, the reflection questions, the option to take notes. What the team sees is everything upstream of that — drafts in progress, decisions about what to publish next, the conversation about how a series should hang together.</p>
<p>If you're new to the team, the most useful thing is to read what's already published — the existing series — and notice what works. The voice, the rhythm, what gets said and what's left unsaid. The hub itself fills in over time as the team grows.</p>`,

  registrar: `<h2>Welcome</h2>
<p>Registration is a threshold moment. Someone has decided to step in — to sit with us, to take a class, to come to a retreat. The form they fill out is the visible part. The invisible part is the moment of deciding, the questions they didn't quite ask, the fact that they're choosing this when they could be doing anything else.</p>
<p>The team's work in this hub is what happens around that threshold — answering questions before someone signs up, helping them switch when life changes, following up when something feels off, holding the practical container so the dharma can do its work. Most of it is small. The smallness is the point.</p>
<p>The Program Manager (in the sidebar) is the operational view of who has registered for what. This hub is where the team coordinates around that — conversations about edge cases, documents that capture how we handle recurring questions, decisions that need more than one person.</p>`,

  support: `<h2>Welcome</h2>
<p>Some questions don't fit anywhere else. Someone has a tech issue with the session room. Someone wants to know if a program is right for them. Someone is wrestling with their practice and isn't sure who to ask. The Support Hub is the team space for that — the open-purpose corner of the system, where the questions that don't have a clean home land.</p>
<p>There's no tool attached. The work happens in conversations, occasionally in documents that capture how we've handled something before. Be present to what comes in. Route it where it needs to go. Sometimes just acknowledging is the right response.</p>`,
};

export async function seedNonHostHubHomeContent(db) {
  const slugs = Object.keys(HUB_WELCOMES);
  let writtenCount = 0;
  let preservedCount = 0;
  let missingCount = 0;

  for (const slug of slugs) {
    const hub = await db.hub.findUnique({
      where: { slug },
      select: { id: true, welcomeBody: true },
    });
    if (!hub) {
      console.log(`  ⏭ Hub '${slug}' not found — skipping`);
      missingCount++;
      continue;
    }
    if (hub.welcomeBody) {
      console.log(`  ⏭ Hub '${slug}' already has welcomeBody — preserving coordinator edits`);
      preservedCount++;
      continue;
    }
    await db.hub.update({
      where: { id: hub.id },
      data:  { welcomeBody: HUB_WELCOMES[slug] },
    });
    console.log(`  ✔ Seeded welcomeBody for '${slug}'`);
    writtenCount++;
  }

  console.log(
    `  ✔ Non-host welcomes: ${writtenCount} written, ${preservedCount} preserved, ${missingCount} missing.`,
  );
}
