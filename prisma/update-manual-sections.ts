/**
 * One-time: update teacher-related ManualSection records.
 * Run: npx tsx prisma/update-manual-sections.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING } },
});

async function main() {
  const teacherProfilesBody = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Teacher profiles let you designate any member as a teacher so they can be credited on lessons and series, and optionally appear on the public Teachers page.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Step 1 — Designate someone as a teacher" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Go to Admin → Members → find the member → scroll to Teacher Attribution. Check the Teacher checkbox and save changes. This marks them as available in the lesson editor picker.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Step 2 — Fill out the teacher profile (optional)" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Once the Teacher checkbox is checked, a Public Teacher Profile section appears below. Fill in any combination of: Bio (short description), Photo URL (direct image link), Slug (URL segment, e.g. jesse-foy creates /teachers/jesse-foy), and the Show on public Teachers page checkbox. Click Save teacher profile to save.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Step 3 — Assign them to lessons" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "In the Lesson Editor, use the Teachers section to search by name and add them to a lesson. Only members with the Teacher checkbox enabled appear in search results.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "How teachers appear on the site" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Lesson page: teacher name listed below the lesson content, linked to /teachers/[slug] if the profile is public. Series page: Taught by [name] byline below the series title. /teachers: public listing of all profiles with Show on public Teachers page enabled.",
          },
        ],
      },
    ],
  };

  await db.manualSection.update({
    where: { slug: "teacher-profiles" },
    data: { body: teacherProfilesBody },
  });
  console.log("Updated teacher-profiles");

  const existing = await db.manualSection.findUnique({
    where: { slug: "course-hub-lessons" },
    select: { body: true },
  });

  const bodyObj = existing?.body as any;
  if (bodyObj && bodyObj.type === "rawHtml") {
    const teacherNote =
      "<h3>Teachers section</h3><p>The <strong>Teachers</strong> section lets you attribute one or more teachers to this lesson. Search by name — only members who have been marked as teachers (Admin → Members → Teacher Attribution checkbox) appear in results. Multiple teachers are supported and display in order on the lesson page and series byline. To add a new teacher, first enable the Teacher checkbox on their member profile.</p>";

    // Remove any existing teachers section then append fresh
    const cleaned = bodyObj.html.replace(/<h3>Teachers section<\/h3>[\s\S]*?<\/p>/, "");
    await db.manualSection.update({
      where: { slug: "course-hub-lessons" },
      data: { body: { type: "rawHtml", html: cleaned + "\n" + teacherNote } },
    });
    console.log("Updated course-hub-lessons");
  } else {
    console.log("course-hub-lessons is not rawHtml — skipped");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
