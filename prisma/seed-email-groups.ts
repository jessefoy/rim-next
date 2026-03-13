/**
 * One-time seed: assign group + groupLabel to existing email templates.
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   npx tsx prisma/seed-email-groups.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.emailTemplate.updateMany({
    where: { slug: { in: ["session-reminder", "first-time-attendee", "returning-after-absence"] } },
    data: { group: "registration", groupLabel: "Registration & Programs" },
  });

  await db.emailTemplate.updateMany({
    where: { slug: { in: ["host-role-assigned", "sub-request-posted", "sub-request-claimed", "missing-report-alert"] } },
    data: { group: "host", groupLabel: "Host Hub" },
  });

  console.log("Email template groups seeded.");
}

main().finally(() => db.$disconnect());
