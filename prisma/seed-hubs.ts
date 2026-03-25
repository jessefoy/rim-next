/**
 * Seed initial Hub records.
 * Run: set -a && source .env.local && set +a && npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-hubs.ts
 *
 * This only creates the Hub records. Jesse assigns HubMember rows manually via Prisma Studio.
 * Safe to run multiple times — uses upsert on slug.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Only the 4 active hubs that have linked tools. Additional hubs can be
// created via the admin UI at /admin/hubs when teams are ready to use them.
const hubs = [
  { slug: "host-team", name: "Hosting Hub",      type: "OPERATIONAL" as const, hasSchedule: true, status: "ACTIVE" as const },
  { slug: "courses",   name: "Course Hub",       type: "OPERATIONAL" as const, status: "ACTIVE" as const },
  { slug: "registrar", name: "Registration Hub", type: "OPERATIONAL" as const, status: "ACTIVE" as const, description: "Program registration management and participant support." },
  { slug: "support",   name: "Support Hub",  type: "OPERATIONAL" as const, status: "ACTIVE" as const, description: "Shared inbox for support@rootedinmindfulness.org." },
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
  // Seed app links for hubs that have tools
  const courseHub = await db.hub.findUnique({ where: { slug: "courses" } });
  if (courseHub) {
    const existing = await db.hubAppLink.findFirst({ where: { hubId: courseHub.id, label: "Course Manager" } });
    if (!existing) {
      await db.hubAppLink.create({
        data: { hubId: courseHub.id, label: "Course Manager", href: "/tools/learning", order: 0 },
      });
      console.log("  ✓ Course Hub → Course Manager app link");
    }
  }

  const hostTeamHub = await db.hub.findUnique({ where: { slug: "host-team" } });
  if (hostTeamHub) {
    const existing = await db.hubAppLink.findFirst({ where: { hubId: hostTeamHub.id, label: "Host Schedule" } });
    if (!existing) {
      await db.hubAppLink.create({
        data: { hubId: hostTeamHub.id, label: "Host Schedule", href: "/tools/schedule", order: 0 },
      });
      console.log("  ✓ Host Team → Host Schedule app link");
    }
  }

  const registrarHub = await db.hub.findUnique({ where: { slug: "registrar" } });
  if (registrarHub) {
    const existing = await db.hubAppLink.findFirst({ where: { hubId: registrarHub.id, label: "Program Manager" } });
    if (!existing) {
      await db.hubAppLink.create({
        data: { hubId: registrarHub.id, label: "Program Manager", href: "/tools/programs", order: 0 },
      });
      console.log("  ✓ Registrar Hub → Program Manager app link");
    }
  }

  const supportHub = await db.hub.findUnique({ where: { slug: "support" } });
  if (supportHub) {
    const existing = await db.hubAppLink.findFirst({ where: { hubId: supportHub.id, label: "Support Inbox" } });
    if (!existing) {
      await db.hubAppLink.create({
        data: { hubId: supportHub.id, label: "Support Inbox", href: "/tools/inbox", order: 0 },
      });
      console.log("  ✓ Support Hub → Support Inbox app link");
    }
    const existingSettings = await db.hubAppLink.findFirst({ where: { hubId: supportHub.id, label: "Inbox Settings" } });
    if (!existingSettings) {
      await db.hubAppLink.create({
        data: { hubId: supportHub.id, label: "Inbox Settings", href: "/tools/inbox/settings", order: 1 },
      });
      console.log("  ✓ Support Hub → Inbox Settings app link");
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
