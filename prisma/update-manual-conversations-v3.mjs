/**
 * update-manual-conversations-v3.mjs — Conversations chapter update.
 *
 * Appends a new section to the v2 chapter body explaining document
 * conversations — threads that live on a specific document page rather
 * than in the main Conversations feed. Also adds an Activity section.
 *
 * Session 114 (2026-05-14).
 */

export async function updateManualConversationsV3(db) {
  const existing = await db.manualSection.findUnique({ where: { slug: "conversations" } });

  const addendum = `<h2>Conversations on documents</h2>
<p>Some conversations belong next to a specific document, not in the general Conversations feed. When you open a document in the hub, scroll down past the document itself and you'll find a <strong>Conversations</strong> section at the bottom. It works exactly like a hub conversation — title, message, notify members — but the thread is attached to that document and only appears there.</p>
<p>If you're asking "Is this policy still current?" or "Can someone explain section 3?", a document conversation is the right place — it keeps the question next to the thing being discussed.</p>
<p>Clicking a document conversation thread takes you to the same thread detail page as any other conversation. The back link at the top will say <strong>← Back to [document name]</strong> so you can return to context.</p>
<p>Document conversations don't appear in the main Conversations feed. If you want to see everything — hub conversations and document conversations together — go to the <strong>Activity</strong> page.</p>
<h2>The Activity page</h2>
<p>The <strong>Activity</strong> link in the sidebar (above Conversations) shows everything that has happened in the hub in a single list, newest first: documents added or updated, conversations started, replies posted — across all surfaces. Use it when you want the full picture of what's been happening.</p>
<p>Four filter buttons let you narrow the view: <strong>All</strong>, <strong>Documents</strong>, <strong>Conversations</strong>, or <strong>Mine</strong> (just your own activity).</p>`;

  const currentBody = typeof existing?.body === "string" ? existing.body : "";

  // Only append if the addendum isn't already present
  if (currentBody.includes("Conversations on documents")) {
    return;
  }

  const newBody = currentBody + "\n" + addendum;

  if (existing) {
    await db.manualSection.update({
      where: { slug: "conversations" },
      data: { body: newBody },
    });
  }
}
