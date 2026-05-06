/**
 * update-manual-registration-rewrite.mjs — Option-B full rewrite of the
 * Registration chapter.
 *
 * Replaces the body wholesale with a fresh chapter built from the
 * actual registration UI inventory:
 *   - /tools/programs/[slug] (the registration list — VolunteerTable)
 *   - /programs/[slug]/register (the public registration form)
 *   - The /admin/members course-access surface
 *
 * The new chapter:
 *   - Walks the registration list as it actually is — stat bar,
 *     spot-opened alert, reminder section, filter pills, search,
 *     CSV export, expanded-row three-column layout (Contact /
 *     Responses / Actions + Notes), and the status-conditional action
 *     set on each row.
 *   - Lists each automatic email accurately and notes which are
 *     manually triggered.
 *   - Documents the Self-Service Edit Link (was in original — kept).
 *   - Notes that APPROVED is a legacy alias for Registered, not a
 *     separate usable status (the UI treats them the same).
 *   - Voice matches the host chapters: 8th-grade plain language,
 *     no model names, "the registrar" generically.
 *
 * Idempotent at the record level. Wired into migrate.mjs with a v1 flag.
 */

const REGISTRATION_BODY = `<p>This chapter is for the registrar. It covers the registration system end to end — what a member sees when they register, how the registration list works, the actions you can take on a row, the statuses, dana, course access, and the emails the system sends.</p>
<p>The registration tools live at <strong>/tools/programs</strong>. Clicking any program in that list opens its registration list — that's where most of your daily work happens. The Programs chapter covers the list and editor; this chapter covers everything that follows from a click on a program name.</p>
<h2>Member experience</h2>
<p>When a member or visitor registers, here's what they see.</p>
<p>They visit the program page and click <strong>Register</strong>, or go directly to <code>/programs/[slug]/register</code>. The form asks for name, email, and optionally phone. If they're signed in, name and email are pre-filled and locked.</p>
<p>If the program has custom questions — accessibility needs, dietary preferences, anything — those appear next.</p>
<p>If this is their first registration with RIM and they aren't signed in, a <strong>Community Agreements</strong> section appears. They check a box before they can submit.</p>
<p>If five or fewer spots remain, a "filling up" warning appears above the form.</p>
<p>They click <strong>Register</strong> (or <strong>Join Waitlist</strong> if the program is full). A confirmation email arrives within seconds. If waitlisted, the email says so and gives their queue position.</p>
<p>If the program has dana, the form moves to the dana step. They can complete it now or return later.</p>
<h3>Returning members</h3>
<p>When someone types an email address that belongs to an existing RIM account, the form looks them up. If a match is found, their name fields auto-fill from their account and lock. A "Welcome back, [Name]" message appears. Their registration is linked to their account, so it shows up in their My Programs history. If they've already agreed to the community agreements, that section is hidden.</p>
<p>This prevents name inconsistencies — the system uses the name on file, not whatever they type in a hurry. If a member says their name was locked at registration and the name is wrong, you can fix it directly in the registration list (the Edit button on their Responses), or they can update it themselves from their account.</p>
<h3>Community agreements</h3>
<p>Agreements appear only when the person isn't signed in <em>and</em> hasn't already agreed on a previous registration. They check a box once. After that, they're never asked again — the agreement is recorded permanently on their account. Members who are signed in have already passed through this threshold and don't see agreements.</p>
<h3>After registering</h3>
<p>The program page changes from <strong>Register</strong> to <strong>✓ You're registered</strong>. If calendar dates are set, links appear to add the event to Google Calendar or download an .ics file for Apple Calendar or Outlook.</p>
<p>Members see all their registrations at <strong>/account/programs</strong> (linked as "My Programs" in the navigation). Pending dana shows as a reminder card on their dashboard until it's completed.</p>
<h3>Self-cancellation</h3>
<p>Members can cancel their own spot from My Programs. Each active registration has a small <strong>Cancel registration</strong> link with a confirmation step. When they cancel, you receive a notification email at the registrar inbox. The waitlist does not auto-promote — you decide who gets the freed spot.</p>
<h2>The registration list</h2>
<p>When you click a program from /tools/programs, you arrive at its registration list. The header shows the program name and an <strong>Edit Program Settings →</strong> link that opens the full Program Editor.</p>
<p>Below the header, a few panels guide your attention.</p>
<h3>The stat bar</h3>
<p>A row of counts at the top:</p>
<ul>
<li><strong>Confirmed</strong> — registered participants.</li>
<li><strong>Waitlisted</strong> — only shown when there are some, highlighted in amber.</li>
<li><strong>Cancelled</strong> — only shown when there are some.</li>
<li><strong>Dana Pending</strong> — only shown when some are pending, highlighted in amber.</li>
<li><strong>Capacity bar</strong> — visible if capacity is set. Shows "X / Y" with a fill bar that turns yellow at 80% and red when full.</li>
</ul>
<h3>The "spot has opened" alert</h3>
<p>Appears when a confirmed seat is available <em>and</em> someone is on the waitlist — a cancellation has freed a gap. The alert reads: <em>"A spot has opened. N people are on the waitlist. Use the Promote button next to their name to confirm their spot."</em></p>
<h3>The reminder section</h3>
<p>Appears when a Reminder Date is set on the program. Shows the scheduled date, how many registrants have received the reminder ("Sent to X of Y"), and either a <strong>Send to Remaining N</strong> button or <strong>All sent ✓</strong>. A <strong>Show names</strong> toggle reveals who hasn't received yet, so you can decide whether to follow up individually instead.</p>
<h3>The toolbar</h3>
<p>Filter pills: <strong>All</strong> · <strong>Registered</strong> · <strong>Waitlisted</strong> · <strong>Cancelled</strong> (with counts). A search box for name or email. An <strong>↓ Export CSV</strong> link that downloads the full list.</p>
<h3>The table</h3>
<p>Each row shows the registrant's name, email, status, dana status, and registration date. Click a row to expand it. Waitlisted rows have an inline <strong>Promote</strong> button next to the status — you can promote without expanding.</p>
<h3>The expanded row</h3>
<p>Click any row and a panel opens below it with three columns.</p>
<p><strong>Contact</strong> — full name, email (clickable to open your mail client), phone (clickable on mobile), and the registration date.</p>
<p><strong>Responses</strong> — the participant's answers to custom questions. An <strong>Edit</strong> button opens an inline editor where you can correct any response directly. Useful when someone registered in a hurry and put something in the wrong field.</p>
<p><strong>Actions + Internal Notes</strong> — the actions available for that registrant, plus a notes editor below them. Notes are visible only to staff and never sent to the member.</p>
<h3>The actions</h3>
<p>The action buttons depend on the registration's status. Most actions ask for confirmation before they go through.</p>
<ul>
<li><strong>Send Dana Reminder</strong> — only when dana is pending. A gentle nudge with a link to complete the offering.</li>
<li><strong>Send Edit Request</strong> — only for active registrations with custom field responses. Asks for confirmation, then emails a secure self-service edit link valid for 7 days. The member can update their responses without an account.</li>
<li><strong>Send Reminder</strong> — only for confirmed registrations. Confirms before sending. After sending, a "Reminder sent [date]" badge appears next to the action.</li>
<li><strong>Resend Confirmation</strong> — only for confirmed registrations. Useful when someone says they never received the original.</li>
<li><strong>Promote to Registered</strong> — only for waitlisted. Promotes them to confirmed and sends an approval email automatically. If the program has dana, the email includes a link to complete it. (Same action as the inline Promote button on the row itself.)</li>
<li><strong>Cancel Registration</strong> — for any active registration. Confirms before cancelling. Frees the spot.</li>
<li><strong>Restore Registration</strong> — for cancelled registrations. Restores them to confirmed status.</li>
<li><strong>Delete Record</strong> — for cancelled registrations only. <em>Permanently deletes the record.</em> Confirms before deleting. Reserve for cleaning up accidental or duplicate registrations.</li>
</ul>
<h2>Status guide</h2>
<p>Every registration has a status. Here's what each one means.</p>
<ul>
<li><strong>Registered</strong> — confirmed spot. Set automatically when someone submits and capacity is available. This is the normal state. Counts toward capacity.</li>
<li><strong>Waitlisted</strong> — the program was full when they registered. They're in the queue, ordered by submission time. Promote manually to give them a spot. Dana isn't collected while waitlisted.</li>
<li><strong>Cancelled</strong> — cancelled by the member or by you. Doesn't count toward capacity. Can be restored.</li>
</ul>
<p>(The database also has an "Approved" status, kept from an earlier design. The UI treats it the same as Registered. You won't see it as a distinct option.)</p>
<h2>Dana</h2>
<p>Dana is the traditional practice of giving — offering what you can in support of the teachings and the center. For programs that use dana, the registration form includes a payment step via Stripe.</p>
<p>Each program has a <strong>Dana Mode</strong> set in the Program Editor:</p>
<ul>
<li><strong>None.</strong> No dana step. Most drop-in programs use this.</li>
<li><strong>Voluntary.</strong> A suggested amount is shown. The member can change it to any amount or skip it entirely.</li>
<li><strong>Base + Dana.</strong> A required base fee plus an optional voluntary dana on top.</li>
<li><strong>Fixed.</strong> A set price. Used for programs with a firm cost like a retreat with accommodation.</li>
</ul>
<p>The <strong>Dana</strong> column in the registration list shows where each person stands:</p>
<ul>
<li><strong>—</strong> — no dana expected for this program, or the registrant is on the waitlist (collected only after promotion).</li>
<li><strong>Pending</strong> — dana is expected but not yet completed. The member can return to <code>/programs/[slug]/register</code> to complete it. You can send a Dana Reminder from the row.</li>
<li><strong>Received</strong> — dana paid via Stripe. The amount is recorded.</li>
<li><strong>Waived</strong> — explicitly waived.</li>
</ul>
<p>When a member has pending dana, their dashboard shows a reminder card automatically until it's received. Dana is never a gate on participation. A person with Pending dana is fully registered and should be welcomed. The reminder is a gentle invitation, not a requirement.</p>
<h2>Automatic emails</h2>
<p>These go out automatically — you don't trigger them.</p>
<ul>
<li><strong>Confirmation</strong> (to registrant) — when someone registers. Includes program name, date, time, location, any custom confirmation message, and calendar links. If waitlisted, includes their queue position.</li>
<li><strong>Approval</strong> (to registrant) — when you promote from waitlist. Confirms their spot. If dana applies, includes a link to complete it.</li>
<li><strong>Cancellation notification</strong> (to registrar inbox) — when a member cancels their own registration. Includes a link to the program's registration list.</li>
<li><strong>Edit submission notification</strong> (to registrar inbox) — when a registrant uses their self-service edit link to submit changes.</li>
</ul>
<p>These are <strong>manually triggered</strong> — they don't send unless you click:</p>
<ul>
<li><strong>Reminder</strong> — sent via the Send Reminder action on a row, or in bulk via the "Send to Remaining" button in the reminder section.</li>
<li><strong>Self-service edit link</strong> — sent via the Send Edit Request action.</li>
<li><strong>Dana Reminder</strong> — sent via the Send Dana Reminder action.</li>
<li><strong>Resend Confirmation</strong> — sent via the Resend Confirmation action.</li>
</ul>
<p>Some email copy is editable without a code deploy. An admin can edit subjects and bodies of managed templates at <strong>/admin/emails</strong>. Each template has an Enabled toggle; if disabled, that email won't send.</p>
<h2>Course access</h2>
<p>Some programs include access to online materials hosted in the Members Area. When a program is linked to a series in the Course Manager (at <strong>/tools/learning</strong>), anyone who registers for that program automatically receives access. You don't need to do anything.</p>
<p>For situations where automatic access doesn't apply, you can grant or revoke course access manually from the member detail page (<strong>/admin/members/[id]</strong>) in the <strong>Course Access</strong> section.</p>
<h3>When to use manual grants</h3>
<ul>
<li><strong>Historical members</strong> — someone who participated before the course was linked to the program. Automatic access only applies to registrations made <em>after</em> the link was added.</li>
<li><strong>Exceptions</strong> — a member who couldn't attend but should still have access to the materials.</li>
<li><strong>One-off access</strong> — a course not tied to any program.</li>
</ul>
<h3>How to grant or revoke</h3>
<ol>
<li>Go to <strong>/admin/members</strong> and open the member's detail page.</li>
<li>Scroll to the <strong>Course Access</strong> section.</li>
<li>Each course is listed with its current status — <em>All Members</em>, <em>Via Registration</em>, <em>Manual Grant</em>, or <em>No Access</em>.</li>
<li>To grant access, click <strong>Grant Access</strong>. A confirmation step appears — read the note about any registration-based access already in place, then confirm.</li>
<li>To revoke a manual grant, click <strong>Revoke Access</strong> and confirm. This only removes the manual grant — if the member has registration-based access to the same course, that remains in effect.</li>
</ol>
<h2>Calendar links</h2>
<p>When a program has a Start Date &amp; Time set, registered members see two calendar links on the program page: Google Calendar and Apple Calendar / Outlook (downloaded as a .ics file). These also appear in the confirmation email.</p>
<p>For programs that meet more than once, a recurrence pattern can be set in the Program Editor's Schedule tab using four fields:</p>
<ul>
<li><strong>Recurrence</strong> — Daily, Weekly, or Monthly. Leave blank for a one-time event.</li>
<li><strong>Repeat every</strong> — interval. 1 = every week; 2 = every other week.</li>
<li><strong>On days</strong> — for Weekly programs, which days of the week the program meets.</li>
<li><strong>Number of occurrences</strong> — total count including the first. Leave blank for ongoing programs (weekly drop-ins). Fill in for fixed-length series — an 8-week course = 8.</li>
</ul>
<p>When recurrence is set, the .ics file includes all sessions — members download the whole course in one click. The Google Calendar link only adds the first session (a Google limitation, not ours) — it's labeled "first session only" so members understand.</p>
<p>For a retreat that runs as one continuous block (Friday evening through Sunday afternoon), leave Recurrence blank. Set Start Date &amp; Time to Friday evening and End Date &amp; Time to Sunday afternoon. The calendar entry spans the full retreat.</p>
<h2>A small note</h2>
<p>Most of your daily work happens in the registration list of one program at a time. The actions you'll use most: Promote (for waitlists), Cancel Registration (when needed), and the bulk reminder send. Everything else — editing responses, restoring cancellations, resending confirmations — is there for less-common situations.</p>
<p>If something on this page is confusing — a button you can't find, a status that doesn't match what you expected, a number that seems off — message Jesse. The registration list is one of the most-used pages in the system; we want it to feel reliable.</p>`;

export async function updateManualRegistrationRewrite(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "registration" },
    select: { id: true },
  });

  const data = {
    title: "Registration",
    description: "How registration works — member experience, the registration list at /tools/programs, statuses, dana, automatic emails, course access, and calendar links.",
    hubSlug: "registrar",
    body: REGISTRATION_BODY,
    relations: ["programs", "course-hub"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "registration" },
      data,
    });
    console.log("  ✔ Updated manual section: registration (option-B rewrite)");
  } else {
    await db.manualSection.create({
      data: { slug: "registration", order: 2, ...data },
    });
    console.log("  ✔ Created manual section: registration (option-B rewrite)");
  }
}
