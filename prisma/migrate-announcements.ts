/**
 * One-time migration: HubAnnouncement → pinned HubConversationThread
 *
 * For each HubAnnouncement:
 *  - Create a HubConversationThread with isPinned: true
 *  - Archived announcements become ARCHIVED threads
 *
 * Run via: npx ts-node prisma/migrate-announcements.ts
 * After verifying, remove HubAnnouncement model from schema.prisma and run prisma db push.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const announcements = await db.hubAnnouncement.findMany({
    include: { hub: { select: { conversationCategories: true } } },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${announcements.length} announcements to migrate.`);

  let created = 0;
  for (const ann of announcements) {
    const category = ann.hub.conversationCategories[0] ?? "General";
    const isArchived = ann.status === "ARCHIVED";

    await db.hubConversationThread.create({
      data: {
        hubId:     ann.hubId,
        authorId:  ann.authorId,
        title:     ann.title,
        body:      ann.body,
        category,
        status:    isArchived ? "ARCHIVED" : "OPEN",
        isPinned:  true,
        pinnedAt:  ann.createdAt,
        createdAt: ann.createdAt,
      },
    });
    created++;
    console.log(`  Migrated: "${ann.title}" (${isArchived ? "ARCHIVED" : "OPEN"})`);
  }

  console.log(`\nDone. ${created} announcements migrated to pinned threads.`);
  console.log("Verify counts match, then remove HubAnnouncement model and run prisma db push.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
