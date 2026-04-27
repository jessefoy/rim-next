/**
 * One-time seed: create the managed EmailTemplate records.
 * Run with: set -a && source .env.local && set +a && node prisma/seed-email-templates.js
 *
 * All seeded templates are wired up to current code paths and seeded
 * with enabled: true.
 *
 * Bodies are markdown — rendered to HTML by marked at send time.
 * Slugs are permanent identifiers — never rename.
 */

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const TEMPLATES = [
  // ── 1. Host role assigned ────────────────────────────────────────────────────
  {
    slug: "host-role-assigned",
    name: "Host Role Assigned",
    description: "Sent when a member is granted the HOST or HOST_MANAGER role.",
    enabled: true,
    group: "04-hosts",
    groupLabel: "Host Team",
    subject: "You've been added as a session host — Rooted In Mindfulness",
    variables: ["firstName", "hostAreaUrl", "manualUrl"],
    body: `Hi {{firstName}},

You've been added as a **session host** for Rooted In Mindfulness. Thank you for taking this on.

As a host, you'll be assigned to specific sessions and will open the virtual space for participants. Your assignments, sub requests, and host conversations all live in the Host Hub.

**[Go to your Host Hub →]({{hostAreaUrl}})**

If anything is unclear, the Staff Manual has a chapter on the host role with step-by-step guidance.

**[Read the Staff Manual →]({{manualUrl}})**

Welcome to the team. Reach out any time if you have questions.

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 2. Sub request posted ────────────────────────────────────────────────────
  {
    slug: "sub-request-posted",
    name: "Sub Request Posted",
    description: "Sent to all hosts when a host posts a sub request.",
    enabled: true,
    group: "04-hosts",
    groupLabel: "Host Team",
    subject: "Sub needed: {{programName}}{{sessionDate}}",
    variables: ["firstName", "requesterName", "programName", "sessionDate", "message", "hubUrl", "coverUrl"],
    body: `Hi {{firstName}},

**{{requesterName}}** needs a sub for **{{programName}}**{{sessionDate}}.

{{message}}

**[Cover this session →]({{coverUrl}})**

Or [view the full schedule]({{hubUrl}}) to see other ways to help.

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 3. Sub request claimed ───────────────────────────────────────────────────
  {
    slug: "sub-request-claimed",
    name: "Sub Request Claimed",
    description: "Sent to the requesting host when another host claims their sub.",
    enabled: true,
    group: "04-hosts",
    groupLabel: "Host Team",
    subject: "Sub covered: {{programName}}{{sessionDate}}",
    variables: ["firstName", "claimerName", "programName", "sessionDate", "message", "hubUrl"],
    body: `Hi {{firstName}},

Your sub request for **{{programName}}**{{sessionDate}} has been covered — **{{claimerName}}** will take the session.

{{message}}

**[View Sub Board →]({{hubUrl}})**

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 4. Session reminder ──────────────────────────────────────────────────────
  {
    slug: "session-reminder",
    name: "Session Reminder",
    description: "Pre-session reminder sent by the nightly cron to registered participants.",
    enabled: true,
    group: "03-sessions",
    groupLabel: "Session Reminders",
    subject: "A reminder — {{programTitle}}",
    variables: ["firstName", "programTitle", "dateText", "locationText", "reminderMessage", "dashboardUrl"],
    body: `Hi {{firstName}},

This is a friendly reminder about **{{programTitle}}**, coming up soon. We look forward to practicing together.

{{dateText}}
{{locationText}}

{{reminderMessage}}

Your session link and full details are on your dashboard.

**[Go to my dashboard →]({{dashboardUrl}})**

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 5. Registration confirmation / waitlist ──────────────────────────────────
  // Sent when a member registers for a program. Two paths via {{#if isWaitlisted}}.
  {
    slug: "registration-confirmation",
    name: "Registration Confirmation",
    description: "Sent when a member registers for a program (confirmed or waitlisted).",
    enabled: true,
    group: "02-registrations",
    groupLabel: "Registrations",
    subject: "{{#if isWaitlisted}}You're on the waitlist — {{programTitle}}{{else}}You're registered — {{programTitle}}{{/if}}",
    variables: [
      "firstName", "programTitle", "programUrl",
      "isWaitlisted", "waitlistPosition",
      "dateText", "locationText",
      "confirmationMessageHtml",
      "googleCalendarUrl", "icsUrl",
    ],
    body: `Hi {{firstName}},

{{#if isWaitlisted}}
You're on the waitlist for **{{programTitle}}**.{{#if waitlistPosition}} You're currently **#{{waitlistPosition}}** in line.{{/if}}

If a spot opens up, we'll email you right away.
{{else}}
You're registered for **{{programTitle}}**. We look forward to practicing together.

{{#if dateText}}📅 {{dateText}}{{/if}}
{{#if locationText}}📍 {{locationText}}{{/if}}

{{#if confirmationMessageHtml}}
{{confirmationMessageHtml}}
{{/if}}

{{#if googleCalendarUrl}}
**Add to calendar:** [Google Calendar]({{googleCalendarUrl}}){{#if icsUrl}} · [Apple / Outlook (.ics)]({{icsUrl}}){{/if}}
{{/if}}
{{/if}}

**[View Program Details →]({{programUrl}})**

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 6. Waitlist approval ─────────────────────────────────────────────────────
  // Sent when a registrar promotes someone from WAITLISTED → APPROVED.
  // Conditional dana section via {{#if hasDana}}.
  {
    slug: "waitlist-approval",
    name: "Waitlist Approval",
    description: "Sent when a registrar promotes a waitlisted member to confirmed.",
    enabled: true,
    group: "02-registrations",
    groupLabel: "Registrations",
    subject: "Your spot is confirmed — {{programTitle}}",
    variables: ["firstName", "programTitle", "programUrl", "hasDana"],
    body: `## Your spot is confirmed

Hi {{firstName}},

Good news — a spot has opened up and you've been confirmed for **{{programTitle}}**. We look forward to practicing together.

**[View Program Details →]({{programUrl}})**

{{#if hasDana}}
---

This program includes a dana (generosity) practice. When you're ready, you can make your offering from the program page.

**[Complete Dana Offering →]({{programUrl}})**
{{/if}}

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
  },

  // ── 7. Registration cancelled (internal — registrar) ─────────────────────────
  // Recipient is REGISTRAR_EMAIL, not the registrant.
  {
    slug: "registration-cancelled-internal",
    name: "Registration Cancelled (internal)",
    description: "Sent to the registrar when a registration is cancelled.",
    enabled: true,
    group: "02-registrations",
    groupLabel: "Registrations",
    subject: "Registration cancelled — {{registrantName}} ({{programTitle}})",
    variables: ["registrantName", "registrantEmail", "programTitle", "volunteerUrl"],
    body: `## Registration Cancelled

A registration has been cancelled for **{{programTitle}}**.

> **Name:** {{registrantName}}
> **Email:** {{registrantEmail}}

If there are waitlisted members, you may want to offer the spot to the next person.

**[View Registrations →]({{volunteerUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
  },

  // ── 8. Responses updated (internal — registrar) ──────────────────────────────
  // Recipient is REGISTRAR_EMAIL, not the registrant.
  {
    slug: "responses-updated-internal",
    name: "Responses Updated (internal)",
    description: "Sent to the registrar when a registrant submits their self-service response update.",
    enabled: true,
    group: "02-registrations",
    groupLabel: "Registrations",
    subject: "{{registrantName}} updated their responses — {{programTitle}}",
    variables: ["registrantName", "programTitle", "volunteerUrl"],
    body: `## Responses Updated

**{{registrantName}}** has updated their registration responses for **{{programTitle}}**.

**[View Registration →]({{volunteerUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
  },

  // ── 9. Edit request ──────────────────────────────────────────────────────────
  // Sent by a registrar to invite a registrant to update their own responses.
  {
    slug: "edit-request",
    name: "Self-Service Edit Request",
    description: "Sent when a registrar invites a registrant to update their own responses. The link contains a single-use 7-day token.",
    enabled: true,
    group: "02-registrations",
    groupLabel: "Registrations",
    subject: "Update your responses — {{programTitle}}",
    variables: ["firstName", "programTitle", "editUrl"],
    body: `## Update your responses

Hi {{firstName}},

Your registrar has invited you to review and update your registration responses for **{{programTitle}}**. Click below to open your pre-filled form.

**[Update My Responses →]({{editUrl}})**

This link is unique to you and expires in 7 days. It can only be used once.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
  },

  // ── 10. Dana reminder ────────────────────────────────────────────────────────
  // Sent by a registrar to a member whose donationStatus is PENDING.
  {
    slug: "dana-reminder",
    name: "Dana Reminder",
    description: "Gentle reminder sent to a member whose dana offering is still pending.",
    enabled: true,
    group: "02-registrations",
    groupLabel: "Registrations",
    subject: "A gentle reminder — your dana for {{programTitle}}",
    variables: ["firstName", "programTitle", "registerUrl"],
    body: `## A gentle reminder

Hi {{firstName}},

Just a gentle note that your dana offering for **{{programTitle}}** is still pending. Whenever you feel moved to, you can complete it here:

**[Complete Your Dana Offering →]({{registerUrl}})**

*Dana is entirely optional — please only complete it if and when it feels right for you. Your participation is what matters most.*

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
  },

  // ── 11. Registrar role assigned ──────────────────────────────────────────────
  // Sent to a member when they are granted the REGISTRAR role.
  {
    slug: "registrar-role-assigned",
    name: "Registrar Role Assigned",
    description: "Sent to a member when they are granted the REGISTRAR role.",
    enabled: true,
    group: "05-hubs",
    groupLabel: "Hubs & Onboarding",
    subject: "You've been added as a registrar — Rooted In Mindfulness",
    variables: ["firstName", "dashboardUrl", "manualUrl"],
    body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

You've been added as a **registrar** for Rooted In Mindfulness. This means you can now view and manage program registrations — approve and cancel spots, promote people from the waitlist, send reminders, and export attendee lists.

Two things to bookmark: your **Registrations dashboard** where you'll do your day-to-day work, and the **Staff Manual** — a plain-English guide to every part of the system. Start with the manual if anything is unclear.

**[Go to Registrations →]({{dashboardUrl}})**

**[Read the Staff Manual →]({{manualUrl}})**

If you have any questions, reply to this email or reach out directly. Welcome to the team.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
  },

  // ── 12. Hub conversation: new thread ─────────────────────────────────────────
  // Sent to hub coordinators when a new conversation thread is created.
  {
    slug: "hub-conv-new-thread",
    name: "Hub Conversation: New Thread",
    description: "Sent to hub coordinators when a new conversation thread is created.",
    enabled: true,
    group: "05-hubs",
    groupLabel: "Hubs & Onboarding",
    subject: "New conversation in {{hubName}}: {{threadTitle}}",
    variables: ["firstName", "authorName", "hubName", "threadTitle", "threadUrl"],
    body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

**{{authorName}}** started a new conversation in {{hubName}}: *{{threadTitle}}*

**[Read Thread →]({{threadUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
  },

  // ── 13. Hub conversation: new reply ──────────────────────────────────────────
  // Sent to thread participants when a new reply is posted.
  {
    slug: "hub-conv-new-reply",
    name: "Hub Conversation: New Reply",
    description: "Sent to thread participants when a new reply is posted.",
    enabled: true,
    group: "05-hubs",
    groupLabel: "Hubs & Onboarding",
    subject: "New reply in {{hubName}}: {{threadTitle}}",
    variables: ["firstName", "replierName", "hubName", "threadTitle", "threadUrl"],
    body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

**{{replierName}}** replied to *{{threadTitle}}* in {{hubName}}.

**[Read Thread →]({{threadUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
  },

  // ── 14. Hub welcome ──────────────────────────────────────────────────────────
  // Sent when a member is added to a hub.
  {
    slug: "hub-welcome",
    name: "Hub Welcome",
    description: "Sent when a member is added to a hub (by a coordinator or via syncHubMembership).",
    enabled: true,
    group: "05-hubs",
    groupLabel: "Hubs & Onboarding",
    subject: "Welcome to {{hubName}}",
    variables: ["firstName", "hubName", "hubUrl"],
    body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

You've been added to **{{hubName}}**. This is a shared space for your team to stay connected, share updates, and coordinate together.

**[Visit {{hubName}} →]({{hubUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
  },

  // ── 15. Volunteer interest (internal) ────────────────────────────────────────
  // Sent to the team inbox when a member submits the volunteer interest form.
  {
    slug: "volunteer-interest-internal",
    name: "Volunteer Interest Submission (internal)",
    description: "Sent to the team inbox when a member submits the volunteer interest form at /volunteerism/volunteer.",
    enabled: true,
    group: "07-forms",
    groupLabel: "Public Forms",
    subject: "New volunteer interest submission",
    variables: ["firstName", "lastName", "email", "phone", "interests"],
    body: `## New volunteer interest

> **Name:** {{firstName}} {{lastName}}
> **Email:** {{email}}{{#if phone}}
> **Phone:** {{phone}}{{/if}}

### Interests and talents

{{interests}}

---
Submitted via /volunteerism/volunteer`,
  },

  // ── 16. Kalyana Mitta application (internal) ────────────────────────────────
  // Sent to the team inbox when a member submits the Kalyana Mitta group application.
  {
    slug: "kalyana-application-internal",
    name: "Kalyana Mitta Application (internal)",
    description: "Sent to the team inbox when a member applies to start a Kalyana Mitta group at /kalyana-mitta/kalyana-mitta-group-application.",
    enabled: true,
    group: "07-forms",
    groupLabel: "Public Forms",
    subject: "New Kalyana Mitta Group Application",
    variables: ["firstName", "lastName", "email", "idea"],
    body: `## New Kalyana Mitta Group Application

> **Name:** {{firstName}} {{lastName}}
> **Email:** {{email}}

### Group idea

{{idea}}

---
Submitted via /kalyana-mitta/kalyana-mitta-group-application`,
  },

  // ── 17. Support notification ─────────────────────────────────────────────────
  // Sent to the assigned user when a support thread has activity (new reply,
  // new note, or assignment). Deduped + alert-creation logic lives in
  // lib/supportNotify.ts; this template just renders the email body.
  {
    slug: "support-notification",
    name: "Support Notification",
    description: "Sent to a support team member when a thread is assigned to them, gets a new reply, or gets a new internal note. Same email used for all three event types — alert-creation and dedup happen in lib/supportNotify.ts.",
    enabled: true,
    group: "06-support",
    groupLabel: "Support Inbox",
    helpText:
      "Important — keeps the support team in the loop.\n\n" +
      "Sent to a support team member when a thread has activity: thread assigned to them, a new reply from a member, or a new internal note from a teammate. The same template is used for all three event types — the {{message}} variable carries the event-specific text, built in lib/supportNotify.ts.\n\n" +
      "If disabled, the support team will still see in-app alerts at /tools/inbox, but they won't receive email notifications. Most people rely on email to know when there's a new reply, so disabling will likely slow response times.\n\n" +
      "The {{message}} variable contains text like \"New reply from Sarah on 'Question about registration'\" — it's required for the email to make sense. Don't remove it.",
    subject: "[RIM Support] {{threadSubject}}",
    variables: ["firstName", "message", "threadUrl"],
    body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

{{message}}

**[View this thread →]({{threadUrl}})**

---
Rooted In Mindfulness Support`,
  },

  // ── 18. Magic link — new user ────────────────────────────────────────────────
  // ⚠️ CRITICAL — required for sign-up. If this template is disabled or
  // missing, NextAuth fails new-account creation. The send call uses
  // throwOnFailure:true so the user sees "Please try again" rather than
  // a silent failure.
  {
    slug: "magic-link-new-user",
    name: "Magic Link — New User",
    description: "⚠️ CRITICAL: required for sign-up. Sent by NextAuth when a first-time visitor enters their email. Disabling this template breaks new-account creation.",
    enabled: true,
    group: "01-auth",
    groupLabel: "Sign-in & Authentication",
    helpText:
      "⚠️ CRITICAL — required for new-account sign-up.\n\n" +
      "Sent automatically by NextAuth when a first-time visitor enters their email address. If this template is disabled, OR if the {{url}} variable is removed from the body, sign-up breaks immediately for everyone — new visitors can't complete account creation.\n\n" +
      "SAFE to edit: subject line, greeting, body copy, link/button label.\n\n" +
      "DO NOT: disable the \"Enabled\" toggle, remove or rename {{url}}, or remove the link/button entirely.\n\n" +
      "If sign-up appears broken: confirm this template is Enabled and the body still contains {{url}}.",
    subject: "Welcome to Rooted In Mindfulness — your link to join",
    variables: ["url"],
    body: `## You're joining the community

We're glad you're here.

Click the button below to complete your account and step into the Rooted In Mindfulness community. This link is for you only and expires in 24 hours.

**[Complete my account →]({{url}})**

If you didn't request this link, you can safely ignore this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
  },

  // ── 20. New program needs host ──────────────────────────────────────────────
  // Sent to all active host-team members when a new virtual/hybrid program
  // is created. Lets the team and the coordinator know there's a new program
  // that may need host coverage going forward.
  {
    slug: "new-program-needs-host",
    name: "New Program Needs a Host",
    description: "Sent to active host-team members when a new virtual or hybrid program is created. Heads-up that a new program may need host coverage on its upcoming sessions.",
    enabled: true,
    group: "04-hosts",
    groupLabel: "Host Team",
    subject: "New program added: {{programName}}",
    variables: ["firstName", "programName", "programFormat", "scheduleUrl"],
    body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

A new program has just been added: **{{programName}}** ({{programFormat}}).

If you'd like to host one of its upcoming sessions, you can take it from the Host Schedule.

**[View the schedule →]({{scheduleUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
  },

  // ── 19. Magic link — returning user ──────────────────────────────────────────
  // ⚠️ CRITICAL — required for sign-in. Same warning as above.
  {
    slug: "magic-link-returning",
    name: "Magic Link — Returning User",
    description: "⚠️ CRITICAL: required for sign-in. Sent by NextAuth when an existing member enters their email. Disabling this template breaks sign-in.",
    enabled: true,
    group: "01-auth",
    groupLabel: "Sign-in & Authentication",
    helpText:
      "⚠️ CRITICAL — required for member sign-in.\n\n" +
      "Sent automatically by NextAuth when an existing member enters their email address. If this template is disabled, OR if the {{url}} variable is removed from the body, sign-in breaks immediately for everyone — members can't access their accounts.\n\n" +
      "SAFE to edit: subject line, greeting, body copy, link/button label.\n\n" +
      "DO NOT: disable the \"Enabled\" toggle, remove or rename {{url}}, or remove the link/button entirely.\n\n" +
      "If sign-in appears broken: confirm this template is Enabled and the body still contains {{url}}.",
    subject: "Your sign-in link — Rooted In Mindfulness",
    variables: ["url"],
    body: `## Your sign-in link

Click the button below to sign in to your account. This link expires in 24 hours.

**[Sign in →]({{url}})**

If you didn't request this link, you can safely ignore this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
  },
];

async function main() {
  console.log("Seeding email templates…");
  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const existing = await db.emailTemplate.findUnique({ where: { slug: t.slug } });
    if (existing) {
      console.log(`  skip  ${t.slug} (already exists)`);
      skipped++;
      continue;
    }
    await db.emailTemplate.create({ data: t });
    console.log(`  ✓     ${t.slug}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
