/**
 * update-manual-conversations.mjs — Conversations chapter (new, system-wide).
 *
 * Audience: anyone in any hub who uses Conversations. Not tied to a
 * specific hub via hubSlug — Conversations work the same way in
 * host-team, courses, support, and registrar.
 *
 * Voice: 8th-grade reading level, plain language, supportive in tone,
 * no model names or system jargon. Same spirit as the host chapters.
 *
 * Body is a plain HTML string (post-Tiptap canonical format).
 * Idempotent at the record level. Wired into migrate.mjs with a v1 flag.
 */

const CONVERSATIONS_BODY = `<p>Conversations are how teams talk to each other inside their hub. They're like a quiet message board — threads of messages, replies under each thread, organized by category. Every hub has them, and they all work the same way.</p>
<p>This chapter explains how to use them. The flow is simple, so the chapter is short.</p>
<h2>Finding the conversations</h2>
<p>Open your hub. In the sidebar, click <strong>Conversations</strong>. You'll see all the threads in that hub — what's been talked about recently, what's still open, what the team is paying attention to.</p>
<p>Threads are sorted by recent activity. The thread that was just replied to is at the top.</p>
<h2>Reading a thread</h2>
<p>Click any thread to open it. You'll see:</p>
<ul>
<li>The thread's title.</li>
<li>The first message — what someone said when they started the thread.</li>
<li>All the replies, in order.</li>
<li>A reply box at the bottom for you to add to it.</li>
</ul>
<p>That's it. There's no special structure. It's a conversation.</p>
<h2>Starting a new thread</h2>
<p>From the Conversations page, click <strong>New thread</strong>. A small form opens.</p>
<p>Three things to fill in:</p>
<ul>
<li><strong>Title</strong> — a short line that says what the thread is about. Other people will see this in the list and decide whether to open it.</li>
<li><strong>Category</strong> — pick one. Categories are the bookshelves of your conversations. The list depends on the hub.</li>
<li><strong>Body</strong> — what you want to say. Use as much or as little space as you need. The text editor supports basic formatting if it helps.</li>
</ul>
<p>Click <strong>Post</strong>. Your thread appears in the list. Coordinators get an email letting them know there's a new thread.</p>
<h2>Replying</h2>
<p>Open the thread. Type into the reply box at the bottom. Click <strong>Post reply</strong>.</p>
<p>Your reply appears in the thread, and everyone who's already part of the conversation gets an email letting them know.</p>
<p>If you want to edit your own reply later, you can — your replies have an Edit option. Other people's replies aren't yours to edit.</p>
<h2>Reactions</h2>
<p>Below each thread and each reply, you'll see five small emoji: 👍 ❤️ 🙏 💡 😊.</p>
<p>Click one to add a reaction. Click again to take it back. Reactions show who reacted, so you can see who agreed, who appreciated, who liked.</p>
<p>Reactions are a quiet way to acknowledge a thread without writing a reply. Useful when you want to say "I read this and I'm with you" without adding to the conversation.</p>
<h2>Categories</h2>
<p>Each hub has its own list of categories — bookshelves for organizing conversations. Things like "General," "Logistics," "Practice questions," "Heads-up." Whatever the team has set up.</p>
<p>You can:</p>
<ul>
<li><strong>Filter the list.</strong> Above the threads, small category chips let you show only one category at a time. Useful when you're looking for something specific.</li>
<li><strong>Add a category.</strong> Any active member of the hub can add a new category if there's a gap.</li>
<li><strong>Rename a category.</strong> Same — any active member.</li>
</ul>
<p>Coordinators can also remove categories. When a category is removed, its threads move to the default "General" category so nothing gets lost.</p>
<p>The categories shape the conversation. If something doesn't fit anywhere, that's a sign a new category might help. Add one, and the team will pick it up.</p>
<h2>Pinning a thread</h2>
<p>Coordinators can pin threads to keep them at the top of the list. Pinned threads stay there until they're unpinned. This is for things the team should keep in mind — a current topic, an important heads-up, a question that needs everyone's attention.</p>
<p>If you're not a coordinator, pinning isn't yours to use. But if a thread feels like it should be pinned, send a quick message to your coordinator and let them decide.</p>
<h2>Emails — when you get them</h2>
<p>The system sends emails for two events:</p>
<ul>
<li><strong>A new thread is started</strong> — the hub's coordinators get an email so they know.</li>
<li><strong>A reply is added to a thread</strong> — everyone who's already participated in that thread gets an email so they don't miss the response.</li>
</ul>
<p>That's it. You don't get an email every time anything happens in the hub. You only hear about threads you've engaged with, plus new threads if you're a coordinator.</p>
<p>If you'd rather not receive these — say, during a break — your coordinator can mute communications for you. The Host Hub team management chapter explains how this works for the host team; the same flow exists in any hub.</p>
<h2>A small reminder</h2>
<p>Conversations are how the team thinks together. They're not meetings. They're not formal. A thread can be one sentence — <em>"FYI, the bell on Tuesday's session sounded weird, let me know if it does it again"</em> — and that's a real, useful contribution.</p>
<p>If something is on your mind that the team should know, start a thread. If a teammate posts and you want to support them, react. If something needs a real reply, reply. The space is yours to use.</p>`;

export async function updateManualConversations(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "conversations" },
    select: { id: true },
  });

  const data = {
    title: "Conversations",
    description: "How threads, replies, reactions, categories, and pinning work — the same way in every hub.",
    hubSlug: null,
    body: CONVERSATIONS_BODY,
    relations: ["host-hub", "host-hub-team-management"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "conversations" },
      data,
    });
    console.log("  ✔ Updated manual section: conversations");
  } else {
    // Order 4 places it among the system-wide chapters near the front
    // (before hub-specific chapters which start around order 5-6).
    await db.manualSection.create({
      data: { slug: "conversations", order: 4, ...data },
    });
    console.log("  ✔ Created manual section: conversations");
  }
}
