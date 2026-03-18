import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const pointers = [
    { slug: "course-hub", title: "Course Hub", order: 10 },
    { slug: "course-hub-series", title: "Managing Series", order: 11 },
    { slug: "course-hub-lessons", title: "Creating and Editing Lessons", order: 12 },
    { slug: "member-courses", title: "Courses — Member Experience", order: 13 },
    { slug: "teacher-profiles", title: "Teacher Profiles", order: 14 },
  ];

  for (const p of pointers) {
    await db.manualSection.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        hubSlug: p.slug.startsWith("course-hub") ? "courses" : null,
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "The authoritative documentation for this topic lives in the Volunteer Manual at " },
                { type: "text", marks: [{ type: "bold" }], text: "/manual" },
                { type: "text", text: ` — see the "${p.title}" section.` },
              ],
            },
          ],
        },
        order: p.order,
      },
      create: {
        slug: p.slug,
        title: p.title,
        hubSlug: p.slug.startsWith("course-hub") ? "courses" : null,
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "The authoritative documentation for this topic lives in the Volunteer Manual at " },
                { type: "text", marks: [{ type: "bold" }], text: "/manual" },
                { type: "text", text: ` — see the "${p.title}" section.` },
              ],
            },
          ],
        },
        relations: [],
        order: p.order,
      },
    });
    console.log(`Upserted: ${p.slug}`);
  }
}

main().then(() => db.$disconnect()).catch(console.error);
