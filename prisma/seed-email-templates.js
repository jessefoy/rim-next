/**
 * One-time seed: create the 7 managed EmailTemplate records.
 * Run with: set -a && source .env.local && set +a && node prisma/seed-email-templates.js
 *
 * All templates start with enabled: false.
 * Bodies are markdown — rendered to HTML by marked at send time.
 * Slugs are permanent identifiers — never rename.
 */

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const TEMPLATES = [
  // ── 1. First-time attendee welcome ──────────────────────────────────────────
  {
    slug: "first-time-attendee",
    name: "First-Time Attendee Welcome",
    description: "Sent after a member's first recorded session attendance.",
    subject: "Welcome to your first session at Rooted In Mindfulness, {{firstName}}",
    variables: ["firstName", "programName", "sessionDate"],
    body: `Hi {{firstName}},

It was wonderful to have you with us{{#if sessionDate}} on {{sessionDate}}{{/if}} for **{{programName}}**. Welcome to Rooted In Mindfulness.

We hope you felt at home. Please know you're always welcome to return — we sit together regularly, and there's always a place for you here.

With warmth,
The RIM Host Team

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 2. Returning after absence ───────────────────────────────────────────────
  {
    slug: "returning-after-absence",
    name: "Returning After Absence",
    description: "Sent when a member attends a session after a 6+ week gap.",
    subject: "Good to have you back, {{firstName}}",
    variables: ["firstName", "programName", "sessionDate"],
    body: `Hi {{firstName}},

It was lovely to have you back with us for **{{programName}}**. We're glad you're here.

However long the gap, there's always a seat for you in this community.

With warmth,
The RIM Host Team

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 3. Host role assigned ────────────────────────────────────────────────────
  {
    slug: "host-role-assigned",
    name: "Host Role Assigned",
    description: "Sent when a member is granted the HOST or HOST_MANAGER role.",
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

  // ── 4. Missing session report alert ─────────────────────────────────────────
  {
    slug: "missing-report-alert",
    name: "Missing Session Report",
    description: "Nightly cron alert to coordinators when no post-session report was filed.",
    subject: "No session report filed — {{programName}}, {{sessionDateDisplay}}",
    variables: ["programName", "sessionDateDisplay", "assignedHostName", "detailUrl"],
    body: `Just a heads up — no post-session report was submitted for **{{programName}}** tonight ({{sessionDateDisplay}}).

If everything went smoothly and nothing needs follow-up, no action is needed. If you'd like to follow up with {{assignedHostName}}, their report link is below.

**[View session in coordinator history →]({{detailUrl}})**

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 5. Sub request posted ────────────────────────────────────────────────────
  {
    slug: "sub-request-posted",
    name: "Sub Request Posted",
    description: "Sent to all hosts when a host posts a sub request.",
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

  // ── 6. Sub request claimed ───────────────────────────────────────────────────
  {
    slug: "sub-request-claimed",
    name: "Sub Request Claimed",
    description: "Sent to the requesting host when another host claims their sub.",
    subject: "Sub covered: {{programName}}{{sessionDate}}",
    variables: ["firstName", "claimerName", "programName", "sessionDate", "message", "hubUrl"],
    body: `Hi {{firstName}},

Your sub request for **{{programName}}**{{sessionDate}} has been covered — **{{claimerName}}** will take the session.

{{message}}

**[View Sub Board →]({{hubUrl}})**

---
Rooted In Mindfulness · rootedinmindfulness.org`,
  },

  // ── 7. Session reminder ──────────────────────────────────────────────────────
  {
    slug: "session-reminder",
    name: "Session Reminder",
    description: "Pre-session reminder sent by the nightly cron to registered participants.",
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
