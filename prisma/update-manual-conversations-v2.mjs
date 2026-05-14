/**
 * update-manual-conversations-v2.mjs — Conversations chapter rewrite.
 *
 * Replaces v1 to match the session 113 redesign:
 *   - Notification subscription model (subscribers receive every reply)
 *   - Follow / Unfollow toggle in the thread header
 *   - "Also notify someone new" picker on the compose form and replies
 *   - Archive → Trash three-stage delete (members archive; senior leadership
 *     review and permanently delete from trash)
 *
 * Voice: 8th-grade reading level, plain language, supportive in tone.
 * Body is a plain HTML string. Idempotent at the record level.
 * Wired into migrate.mjs with a v2 flag.
 */

const CONVERSATIONS_BODY = `<p>Conversations are how teams talk to each other inside their hub. They're like a quiet message board — threads of messages, replies under each thread, organized by category. Every hub has them, and they all work the same way.</p>
<p>This chapter explains how to use them.</p>
<h2>Finding the conversations</h2>
<p>Open your hub. In the sidebar, click <strong>Conversations</strong>. You'll see all the threads in that hub — what's been talked about recently, what's still open, what the team is paying attention to.</p>
<p>Threads are sorted by recent activity. The thread that was just replied to is at the top.</p>
<h2>Reading a thread</h2>
<p>Click any thread to open it. You'll see:</p>
<ul>
<li>The thread's title.</li>
<li>The first message — what someone said when they started the thread.</li>
<li>All the replies, in order.</li>
<li>A reply box at the bottom where you can add your own.</li>
</ul>
<h2>Starting a new thread</h2>
<p>Click <strong>+ New topic</strong> in the upper right. Pick a category (or add a new one if none fit), give the thread a title, and write the first message. Click <strong>Post topic</strong> when you're ready.</p>
<p>Right below the message box, there's a small panel called <strong>Notify team members</strong>. Coordinators of this hub are notified automatically — you don't need to add them. The panel is for adding anyone else who should see this thread. Check their names. If you don't add anyone, that's fine; only coordinators will know.</p>
<h2>Replying</h2>
<p>Type into the reply box at the bottom of the thread. Click <strong>Post reply</strong>.</p>
<p>Reacting to a reply is fast — hover or tap the reply, click the smiley icon, pick an emoji. Reactions are a low-pressure way to say "I saw this" or "I appreciate that" without typing.</p>
<h2>Who gets notified</h2>
<p>Each thread has a list of people called <em>subscribers</em>. Anyone on this list receives an email every time there's a new reply. Here's who's on the list:</p>
<ul>
<li><strong>The person who started the thread.</strong></li>
<li><strong>The hub's coordinators.</strong></li>
<li><strong>Anyone the author added</strong> using the Notify panel.</li>
<li><strong>Anyone who has replied to the thread.</strong> Replying signs you up automatically.</li>
<li><strong>Anyone who chose to follow the thread</strong> using the Follow button.</li>
</ul>
<p>You don't get an email every time anything happens in the hub. You only hear about threads you're subscribed to.</p>
<h3>The Follow button</h3>
<p>Open any thread. Near the top, next to the reply count, there's a small <strong>Follow</strong> pill. Click it to start receiving emails for every reply. Click again — it now says <strong>Following ✓</strong> — to stop receiving them.</p>
<p>This is useful when there's a conversation you want to keep an eye on but haven't replied to. It's also useful in reverse — if a thread you're subscribed to is getting noisy and you'd rather step back, click Following to turn it off.</p>
<h3>Adding someone new on a reply</h3>
<p>If you're replying and there's a teammate who should see this conversation but isn't already subscribed, click <strong>+ Notify someone new…</strong> below the reply box. A picker appears with the rest of the hub. Check their names; they'll be added as subscribers. They'll receive this reply and every future reply.</p>
<p>You don't have to pick anyone for normal replies — the existing subscribers always get the email. Use this only when you want to bring someone new into the conversation.</p>
<h2>Categories</h2>
<p>Categories help organize threads by topic. The hub starts with a small set; any hub member can add a new category from the filter bar. Coordinators can rename or delete categories — deleting reassigns the threads in that category to General.</p>
<h2>Pinning a thread</h2>
<p>Coordinators can pin a thread to the top of the list. Use this for announcements or things people should see when they open the hub. Pinned threads have a small pin icon next to the title and stay at the top until unpinned.</p>
<h2>Archiving and deleting</h2>
<p>Conversations have a deliberate two-step removal flow so nothing important disappears by accident.</p>
<p><strong>Step 1: Archive.</strong> When a thread has run its course — a question was answered, a decision was reached — the author or a coordinator can archive it. From the <strong>…</strong> menu, choose <strong>Archive thread</strong>. Archived threads stop accepting replies but stay visible under the <strong>Archived</strong> tab. Anyone can still read them. They can be unarchived from the same menu if conversation needs to resume.</p>
<p><strong>Step 2: Delete.</strong> If an archived thread should be removed entirely, the author or a coordinator can click <strong>Delete</strong> from the same menu. The thread vanishes from everyone's view. It doesn't disappear forever, though — it goes to the hub's Trash, where senior leadership (Admins, Guiding Teachers, and hub coordinators) can either restore it or permanently delete it. This second step gives leadership a chance to review removals before they're irreversible.</p>
<p>Members never see the Trash. They see a thread, archive it, optionally delete it, and that's it. Leadership handles the rest.</p>
<h2>A small reminder</h2>
<p>Conversations are how the team thinks together. They're not meetings. They're not formal. A thread can be one sentence — <em>"FYI, the bell on Tuesday's session sounded weird, let me know if it does it again"</em> — and that's a real, useful contribution.</p>
<p>If something is on your mind that the team should know, start a thread. If a teammate posts and you want to support them, react. If something needs a real reply, reply. The space is yours to use.</p>`;

export async function updateManualConversationsV2(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "conversations" },
    select: { id: true },
  });

  const data = {
    title: "Conversations",
    description: "How threads, replies, subscriptions, archiving, and the trash flow work — the same way in every hub.",
    hubSlug: null,
    body: CONVERSATIONS_BODY,
    relations: ["host-hub", "host-hub-team-management"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "conversations" },
      data,
    });
    console.log("  ✔ Updated manual section: conversations (v2)");
  } else {
    await db.manualSection.create({
      data: { slug: "conversations", order: 4, ...data },
    });
    console.log("  ✔ Created manual section: conversations (v2)");
  }
}
