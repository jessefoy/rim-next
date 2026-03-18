import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.emailTemplate.upsert({
    where: { slug: "drip-lesson-available" },
    create: {
      slug: "drip-lesson-available",
      name: "Drip — New Lesson Available",
      description: "Sent when a new lesson becomes available in a drip-enabled series.",
      subject: "New lesson available: {{lessonTitle}}",
      body: `Hi {{memberFirstName}},

A new lesson in **{{seriesTitle}}** is ready for you.

**{{lessonTitle}}**

[Go to lesson →]({{lessonUrl}})

Take your time. It's here whenever you're ready.`,
      enabled: true,
      variables: ["memberFirstName", "lessonTitle", "seriesTitle", "lessonUrl"],
      group: "learning",
      groupLabel: "Learning System",
    },
    update: {},
  });
  console.log("Drip email template seeded.");
}

main().catch(console.error).finally(() => db.$disconnect());
