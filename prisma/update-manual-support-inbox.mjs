/**
 * update-manual-support-inbox.mjs — Targeted drift fixes for the
 * Support Inbox chapter.
 *
 * The original chapter (extracted from the now-retired ManualContent.tsx)
 * had three claims that don't match the current app:
 *
 *   1. Location: "Your Hubs → Support → Inbox" — the inbox was extracted
 *      to /tools/inbox in session 73.
 *   2. Status name: "Resolved" — the actual enum label is "Closed."
 *   3. Auto-sync: "syncs every 5 minutes automatically" — the
 *      support-sync cron is no longer scheduled in vercel.json. Sync
 *      runs only when a user clicks the Sync button (with a 30-second
 *      cooldown per user).
 *
 * Body is plain HTML string (post-Tiptap canonical format).
 * Idempotent at the record level. Wired into migrate.mjs with a v1 flag.
 *
 * This is a targeted "remove what's wrong" pass. A full rewrite in the
 * voice of the host chapters is a future focused session.
 */

const SUPPORT_INBOX_BODY = `<p>The Support Inbox is a shared email client for <code>support@rootedinmindfulness.org</code>. The support team can read incoming messages, reply, add internal notes, assign threads to teammates, and use templates — all without leaving the website.</p>
<h2>Where it lives</h2>
<p>The Support Inbox is at <strong>/tools/inbox</strong>. It also appears as the Support Inbox app link on the Support Hub home, and as a "Tools" entry in the Support Hub sidebar.</p>
<p>Two roles can access the inbox:</p>
<ul>
<li><strong>SUPPORT</strong> — can read threads, reply, add notes, assign threads, and manage their own signature and notification preferences.</li>
<li><strong>ADMIN</strong> — everything SUPPORT can do, plus: connect or disconnect Gmail, set the default assignee, manage email templates, re-match unlinked threads, and permanently delete threads.</li>
</ul>
<h2>Thread status</h2>
<p>Every thread has a status that tracks where it is in the workflow:</p>
<ul>
<li><strong>Open</strong> — new or unhandled.</li>
<li><strong>Claimed</strong> — a teammate has taken ownership.</li>
<li><strong>Waiting</strong> — waiting on a response from the sender.</li>
<li><strong>Closed</strong> — the conversation is complete.</li>
</ul>
<h2>The layout</h2>
<p>The inbox is a three-column layout: thread list on the left, message timeline in the center, and a context sidebar on the right.</p>
<table>
<thead><tr><th>Column</th><th>What it shows</th></tr></thead>
<tbody>
<tr><td>Thread list (left)</td><td>All threads, filterable by Active, Mine, Closed, All, or Trash. Includes search and a manual Sync button (30-second cooldown between uses).</td></tr>
<tr><td>Message timeline (center)</td><td>All messages and notes in the selected thread, in order. Reply composer anchored at the bottom.</td></tr>
<tr><td>Sidebar (right)</td><td>Thread status, assignment, member context (if matched), registration history, contact history (other threads from the same person), and action buttons.</td></tr>
</tbody>
</table>
<p><strong>Filters.</strong> Pill buttons above the thread list. "Active" shows Open + Claimed + Waiting. "Mine" shows threads assigned to you. "Trash" shows soft-deleted threads.</p>
<p><strong>Member matching.</strong> When a thread arrives, the system checks whether the sender's email matches a community member. If it does, the sidebar shows their name, roles, and recent registrations. If the match is wrong or missing, an admin can re-match threads from the Settings page.</p>
<h2>Syncing with Gmail</h2>
<p>The inbox syncs with Gmail when you click the <strong>Sync</strong> button at the top of the thread list. There's a 30-second cooldown per user between manual syncs to keep load reasonable. New messages and threads appear after the sync completes.</p>
<p>Syncing requires that an admin has connected the support Gmail account on the Settings page. If Gmail isn't connected, the Sync button won't work — connect it first.</p>
<h2>Replying and composing</h2>
<p>Click the reply prompt at the bottom of the message timeline to open the reply composer. Type your response in the rich text editor, optionally attach files (up to 25 MB total), and click <strong>Send Reply</strong>.</p>
<p>Your <strong>email signature</strong> (configured in Settings) is automatically appended to every outbound reply. It includes your name, role, and a tagline.</p>
<p>To compose a brand-new email (not a reply), click <strong>New Email</strong> above the search field. Enter a recipient email or search for a member, add a subject, and compose.</p>
<p>Both the reply and compose forms include a <strong>Use Template</strong> button that lets you quickly insert a pre-written response.</p>
<h2>Internal notes</h2>
<p>Internal notes are private messages visible only to the support team. They are <strong>never sent to the customer</strong>. Use them to coordinate with teammates, document decisions, or flag things for follow-up.</p>
<p>Click <strong>Add Note</strong> in the sidebar to open the note composer. Type your note and click <strong>Save Note</strong>. Notes appear in the timeline alongside messages, styled distinctly so they're easy to spot.</p>
<p>When you add a note to a thread that's assigned to someone else, they'll receive a notification (if they have email notifications enabled).</p>
<h2>Templates</h2>
<p>Email templates are reusable response snippets. Only admins can create and manage templates; all support team members can use them.</p>
<p>To manage templates, an admin goes to <strong>Settings → Email Templates</strong>. Each template has a name, an optional subject line, and a rich text body.</p>
<p>To use a template, click <strong>Use Template</strong> in the reply or compose footer, then pick from the dropdown. The template body replaces the current editor content. If the template has a subject and you're composing a new email, it pre-fills the subject too.</p>
<h2>Settings</h2>
<p>The Settings page has personal preferences and (for admins) configuration for the team.</p>
<table>
<thead><tr><th>Setting</th><th>Who can change it</th><th>What it does</th></tr></thead>
<tbody>
<tr><td>Gmail Connection</td><td>Admin</td><td>Connect or disconnect the support Gmail account. Required before the inbox can sync.</td></tr>
<tr><td>Default Assignee</td><td>Admin</td><td>New threads are automatically assigned to this person. Can be set to "Unassigned" for manual triage.</td></tr>
<tr><td>Email Templates</td><td>Admin</td><td>Create, edit, and delete reusable response templates.</td></tr>
<tr><td>Re-match Members</td><td>Admin</td><td>Manually re-runs member matching on threads with no linked member. Useful after importing new members or correcting email addresses.</td></tr>
<tr><td>My Signature</td><td>Everyone</td><td>Your name, role, and tagline appended to outbound replies.</td></tr>
<tr><td>Email Notifications</td><td>Everyone</td><td>Toggle whether you receive email alerts when threads are assigned to you or when notes are added to your threads.</td></tr>
</tbody>
</table>`;

export async function updateManualSupportInbox(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "support-inbox" },
    select: { id: true },
  });

  const data = {
    title: "Support Inbox",
    description: "How the shared email client at /tools/inbox works — threads, replies, notes, templates, settings.",
    hubSlug: "support",
    body: SUPPORT_INBOX_BODY,
    relations: ["volunteer-roles"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "support-inbox" },
      data,
    });
    console.log("  ✔ Updated manual section: support-inbox");
  } else {
    await db.manualSection.create({
      data: { slug: "support-inbox", order: 11, ...data },
    });
    console.log("  ✔ Created manual section: support-inbox");
  }
}
