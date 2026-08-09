/**
 * One-time seed: add helpText and sanityNote to the 7 managed EmailTemplate records.
 * Run with: set -a && source .env.local && set +a && node prisma/seed-email-help-text.js
 */

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const HELP = [
  {
    slug: "first-time-attendee",
    helpText:
      "Sent to a member after their first recorded attendance at any RIM session. Keep the tone warm and welcoming — this may be someone's first impression of the community.",
    sanityNote:
      "{{programName}} comes from the program record in the Program Manager. To change it, edit the program there.",
  },
  {
    slug: "returning-after-absence",
    helpText:
      "Sent when a member attends after a 6+ week gap. Keep it brief and gentle — just a warm acknowledgment that they're back.",
    sanityNote:
      "{{programName}} comes from the program record in the Program Manager. To change it, edit the program there.",
  },
  {
    slug: "host-role-assigned",
    helpText:
      "Sent when someone is granted the HOST or HOST_MANAGER role. The hub URL and manual URL are generated automatically — no need to include them manually in the body.",
    sanityNote: null,
  },
  {
    slug: "missing-report-alert",
    helpText:
      "Nightly alert sent to coordinators when no post-session report was filed. Recipients are coordinators, not the host themselves. Sent by the cron job around 10 PM CT.",
    sanityNote:
      "{{programName}} comes from the program record in the Program Manager. To change it, edit the program there.",
  },
  {
    slug: "sub-request-posted",
    helpText:
      "Sent to all active hosts when a sub request is posted. {{message}} is the optional note the requesting host adds when submitting the request — it may be blank.",
    sanityNote:
      "{{programName}} comes from the program record in the Program Manager. To change it, edit the program there.",
  },
  {
    slug: "sub-request-claimed",
    helpText:
      "Sent to the requesting host when another host claims their sub. {{message}} is the optional note the claiming host adds — it may be blank.",
    sanityNote:
      "{{programName}} comes from the program record in the Program Manager. To change it, edit the program there.",
  },
  {
    slug: "session-reminder",
    helpText:
      "Pre-session reminder sent by the nightly cron to all registered participants. Sent 24 hours before each session. {{reminderMessage}} is a Portable Text field on the program — it renders as formatted HTML in the email.",
    sanityNote:
      "{{programTitle}}, {{dateText}}, {{locationText}}, and {{reminderMessage}} all come from the program record. To change them, edit the program in the Program Manager.",
  },
];

async function main() {
  console.log("Seeding email template help text…");
  for (const h of HELP) {
    await db.emailTemplate.update({
      where: { slug: h.slug },
      data: { helpText: h.helpText, sanityNote: h.sanityNote },
    });
    console.log(`  ✓  ${h.slug}`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
