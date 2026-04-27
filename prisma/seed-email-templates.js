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
