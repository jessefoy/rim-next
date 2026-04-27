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
