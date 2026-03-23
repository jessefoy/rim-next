/**
 * Seed initial Hub records.
 * Run: set -a && source .env.local && set +a && npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-hubs.ts
 *
 * This only creates the Hub records. Jesse assigns HubMember rows manually via Prisma Studio.
 * Safe to run multiple times — uses upsert on slug.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const hubs = [
  { slug: "host-team",              name: "Host Team",              type: "OPERATIONAL" as const, hasSchedule: true, status: "ACTIVE" as const },
  { slug: "people-team",            name: "People Team",            type: "OPERATIONAL" as const },
  { slug: "newsletter",             name: "Newsletter",             type: "OPERATIONAL" as const },
  { slug: "greeter",                name: "Greeter Team",           type: "OPERATIONAL" as const },
  { slug: "av-team",                name: "AV Team",                type: "OPERATIONAL" as const },
  { slug: "housekeeping",           name: "Housekeeping",           type: "OPERATIONAL" as const },
  { slug: "plant-care",             name: "Plant Care",             type: "OPERATIONAL" as const },
  { slug: "sangha-care",            name: "Sangha Care",            type: "OPERATIONAL" as const },
  { slug: "km-support",             name: "KM Support",             type: "OPERATIONAL" as const },
  { slug: "silent-meditation",      name: "Silent Meditation",      type: "OPERATIONAL" as const },
  { slug: "volunteer-coordination", name: "Volunteer Coordination", type: "OPERATIONAL" as const },
  { slug: "board",                  name: "Board",                  type: "GOVERNANCE"  as const },
  { slug: "teacher-council",        name: "Teacher Council",        type: "GOVERNANCE"  as const },
  { slug: "courses",                 name: "Course Hub",             type: "OPERATIONAL" as const, status: "ACTIVE" as const },
  { slug: "registrar",              name: "Registrar Hub",          type: "OPERATIONAL" as const, status: "ACTIVE" as const, description: "Program registration management and participant support." },
  { slug: "support",                name: "Support Inbox",          type: "OPERATIONAL" as const, status: "ACTIVE" as const, description: "Shared inbox for support@rootedinmindfulness.org." },
];

async function main() {
  console.log("Seeding hubs…");
  for (const hub of hubs) {
    await db.hub.upsert({
      where:  { slug: hub.slug },
      update: { name: hub.name, type: hub.type, hasSchedule: hub.hasSchedule ?? false, ...(hub.status ? { status: hub.status } : {}), ...(hub.description ? { description: hub.description } : {}) },
      create: { slug: hub.slug, name: hub.name, type: hub.type, hasSchedule: hub.hasSchedule ?? false, ...(hub.status ? { status: hub.status } : {}), ...(hub.description ? { description: hub.description } : {}) },
    });
    console.log(`  ✓ ${hub.name}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
