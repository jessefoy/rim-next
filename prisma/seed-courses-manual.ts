/**
 * seed-courses-manual.ts
 * Seeds ManualSection records for the Courses / Learning System.
 * Uses upsert on slug — safe to run multiple times.
 *
 * Run: set -a && source .env.local && set +a &&
 *      npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-courses-manual.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL,
    },
  },
});

function p(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function h2(text: string) {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

function h3(text: string) {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] };
}

function ul(items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
    })),
  };
}

function ol(items: string[]) {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
    })),
  };
}

function doc(...nodes: object[]) {
  return { type: "doc", content: nodes };
}

const sections = [
  // ── course-hub ────────────────────────────────────────────────────────────
  {
    slug: "course-hub",
    title: "Course Hub",
    hubSlug: "courses",
    order: 10,
    relations: ["course-hub-series", "course-hub-lessons", "member-courses", "teacher-profiles"],
    body: doc(
      h2("What this is"),
      p("The Course Hub is where Teachers create and manage the learning materials on the RIM website — audio recordings, readings, video talks, and structured series of lessons. It lives at /account/hub/courses and is accessible to members with the Teacher role."),
      p("Everything in the course system is organized in two layers: Series (called Courses in the database) and Lessons. A series is a container — it has a title, a description, and an ordered list of lessons. A lesson is a single piece of content — it can hold audio, video, text, or any combination."),

      h2("Who uses this"),
      p("Teachers — anyone with the Teacher role assigned by an Admin. Teachers can create, edit, and manage any series or lesson in the system. There are no per-teacher ownership restrictions: all Teachers share access to the full library."),

      h2("What's in the hub"),
      ul([
        "Series tab — lists all series; create new or edit existing ones",
        "Lessons tab — lists all lessons in the library; create new or edit existing ones",
        "Each series has its own editor where you add, reorder, and group its lessons",
        "Each lesson has its own editor for content, audio/video files, teacher credits, and release settings",
      ]),

      h2("Access levels"),
      p("Each series has an access level that controls who can see it on the member-facing website:"),
      ul([
        "All Members — any logged-in member can see and enroll",
        "Registration Required — member must have registered for a linked program to get access; or an Admin can grant access manually",
        "Role Required — only members with a specific role (e.g. Teacher) can see it",
      ]),
      p("Access level is set on the series, not on individual lessons. Lessons inherit their access through whichever series they belong to."),

      h2("Linking a series to a program"),
      p("When you link a series to a program, anyone who registers for that program automatically gets access to that series. No manual work needed — the access is granted at the moment of registration."),
      p("To link: open the series editor, scroll to the Linked Programs section, and search for the program by name. You can link one series to multiple programs."),

      h2("Things to know"),
      ul([
        "A lesson can appear in multiple series — the same recording can be part of a beginner series and an advanced series",
        "Lesson slugs are permanent once published — changing a slug breaks links that members may have bookmarked",
        "The series 'sort order' controls the order they appear on the courses browse page (/courses)",
        "Inactive series are hidden from the member-facing website but remain fully editable in the hub",
        "Drip scheduling: a series can be set to release lessons on a delay — each lesson is available a set number of days after the previous one",
      ])
    ),
  },

  // ── course-hub-series ─────────────────────────────────────────────────────
  {
    slug: "course-hub-series",
    title: "Managing Series",
    hubSlug: "courses",
    order: 11,
    relations: ["course-hub", "course-hub-lessons"],
    body: doc(
      h2("What this is"),
      p("This section covers how to create and edit a series — the container that organizes a group of lessons. Series live at /account/hub/courses/courses/[slug] in the editor."),

      h2("Creating a series"),
      ol([
        "Go to the Course Hub and click the Series tab",
        "Click New Series",
        "Fill in the title and slug — the slug is the URL path (e.g. 'introduction-to-loving-kindness')",
        "Choose an access level (All Members is the most common for open series)",
        "Add a subheading and description if you have them — these appear on the member-facing series page",
        "Save the series, then add lessons",
      ]),

      h2("The series editor"),
      p("Once a series is created, the editor shows:"),
      ul([
        "Title, slug, subheading — the basic identity of the series",
        "Description — a rich-text editor for the series overview; this appears at the top of the series page",
        "Access level and required roles — who can see this series",
        "Active toggle — inactive series are hidden from members",
        "Drip settings — optional; controls whether lessons release on a delay",
        "Linked Programs — link to programs so registration grants access automatically",
        "Lesson list — add, reorder, and group the lessons in this series",
      ]),

      h2("Managing lessons in a series"),
      p("The lesson list at the bottom of the series editor is where you build the sequence:"),
      ul([
        "Search for existing lessons by title and add them",
        "Drag rows to reorder",
        "Add section dividers to group lessons under headings (e.g. 'Week 1 — Foundations')",
        "Click the trash icon to remove a lesson from this series (it stays in the library; it's just removed from this series)",
      ]),

      h2("Section dividers"),
      p("Section dividers are grouping headings that appear in the lesson list on the member-facing page. They don't link to anything — they're just labels. You can add them between lessons, name them anything, and drag them to reorder like any other row."),
      p("Tip: Use section dividers for multi-week programs — 'Week 1', 'Week 2' — or for thematic groupings like 'Guided Practices' and 'Talks'."),

      h2("Drip scheduling"),
      p("If you turn on drip scheduling, lessons are released on a delay after the member enrolls or after the program they registered for starts. Set the interval in days — for example, 7 means each lesson is available a week after the previous one."),
      p("Each lesson can also have its own release delay override, set in the lesson editor. The per-lesson delay is calculated from the series start, not from the previous lesson."),

      h2("Things to know"),
      ul([
        "Slug is permanent once members have accessed the series — changing it breaks bookmarks and lesson links",
        "You can link a series to multiple programs; access is cumulative",
        "The sort order field controls the position of this series on the public /courses browse page",
        "Inactive series are fully editable — toggle Active off while you're building, then on when ready",
      ])
    ),
  },

  // ── course-hub-lessons ────────────────────────────────────────────────────
  {
    slug: "course-hub-lessons",
    title: "Creating and Editing Lessons",
    hubSlug: "courses",
    order: 12,
    relations: ["course-hub", "course-hub-series"],
    body: doc(
      h2("What this is"),
      p("A lesson is a single piece of content — an audio recording, a video talk, a reading, or a combination. Lessons are the building blocks of series. They live in a shared library and can appear in multiple series at once."),
      p("The lesson editor is at /account/hub/courses/lessons/[slug]."),

      h2("Creating a lesson"),
      ol([
        "Go to the Course Hub and click the Lessons tab",
        "Click New Lesson",
        "Fill in the internal title (for your reference) and the display title (what members see)",
        "Choose a slug — the URL path for this lesson (e.g. 'body-scan-30-min')",
        "Save, then add content",
      ]),

      h2("The lesson editor"),
      p("The lesson editor has several sections:"),
      ul([
        "Internal title — your reference name; used in admin lists and search; not shown to members",
        "Display title — what members see on the lesson page",
        "Slug — the permanent URL path",
        "Access level — All Members (anyone logged in) or Registration Required",
        "Hero image — optional header image with alt text",
        "Header quote — an optional pull quote that appears at the top of the lesson page",
        "Audio — paste a URL to the audio file (hosted in Vercel Blob via the upload button, or external)",
        "Video — paste a URL to the video (Vimeo, YouTube, or a direct URL)",
        "Body — the main content area (rich text editor with custom blocks)",
        "Resources — links to PDFs, handouts, or external materials",
        "Teachers — credit one or more teachers; their names link to teacher profile pages",
        "Release delay — days after series start before this lesson is visible (for drip series)",
      ]),

      h2("The content editor"),
      p("The body field uses a rich text editor that supports:"),
      ul([
        "Standard prose: bold, italic, underline, links, headings",
        "Lists: bulleted and numbered",
        "Tables",
        "Text alignment: left, center, right",
        "Custom blocks: Verse Quote (for poem or text in a special style), Practice Callout (teal box for guided practice instructions), Callout Text (larger serif emphasis)",
      ]),
      p("Custom blocks are available from the toolbar in the content editor. They're designed for specific types of teaching content — use them when the visual treatment helps the member understand the material."),

      h2("Audio and video"),
      p("You can upload audio files directly using the Upload button in the lesson editor. Files are stored in Vercel Blob (a CDN) and the URL is automatically filled in. Maximum file size is 500 MB."),
      p("For video, paste a Vimeo or YouTube embed URL, or a direct video file URL. The lesson page will render it as an embedded player."),
      p("A lesson can have both audio and video — the page shows both players. It can also have neither — some lessons are text-only."),

      h2("Teacher credits"),
      p("You can credit one or more teachers on a lesson. Their names link to teacher profile pages on the website. Teachers must exist in the Teacher Profiles system before they can be credited (see the Teacher Profiles manual section)."),

      h2("Things to know"),
      ul([
        "Lesson slugs are permanent — once a lesson is published, do not change the slug",
        "A lesson can be in multiple series — adding it to one series doesn't remove it from others",
        "Removing a lesson from a series doesn't delete the lesson — it stays in the library",
        "Deleting a lesson removes it from all series — there's no undo; be sure before deleting",
        "The internal title is what appears in search when you're adding lessons to a series — use something descriptive",
      ])
    ),
  },

  // ── member-courses ────────────────────────────────────────────────────────
  {
    slug: "member-courses",
    title: "Courses — Member Experience",
    hubSlug: null,
    order: 13,
    relations: ["course-hub", "registration-management"],
    body: doc(
      h2("What this is"),
      p("This section describes what members see and experience when they access courses on the RIM website — from browsing to working through a series."),

      h2("Browsing courses"),
      p("Members can browse available courses at /courses. This page shows all active series that are set to 'All Members' or that the member has access to through registration. Series are grouped by category and show the teacher names, lesson count, and enrollment status."),
      p("Non-logged-in visitors can also see this page, but they'll be prompted to log in before enrolling."),

      h2("Enrolling"),
      p("When a member clicks into a series, they see the series page (/course/[slug]). If the series is open to all members, there's an Enroll button. Clicking it enrolls them immediately — no registration form, no dana step."),
      p("If the series requires registration, the member must register for the linked program first. Access is granted automatically when they register. The series page shows 'Access granted via registration in [Program Name]'."),

      h2("The series page"),
      p("The series page shows:"),
      ul([
        "Series title, description, and teacher credits",
        "A list of all lessons in order, grouped by section dividers if any",
        "Each lesson shows a media-type icon (audio, video, or text) and its title",
        "For enrolled members: a Continue button pointing to the next unfinished lesson",
        "Progress indicator showing how many lessons are complete",
      ]),

      h2("The lesson page"),
      p("Each lesson has its own page at /lessons/[slug]. The page shows:"),
      ul([
        "The lesson title and any header quote",
        "Audio player (if the lesson has audio)",
        "Video player (if the lesson has video)",
        "The lesson body — text, images, custom blocks",
        "Resources (if any) — links to PDFs, handouts",
        "Teacher credit with a link to the teacher profile",
        "Mark Complete button — members can mark each lesson done; this tracks progress",
        "Navigation to the previous and next lessons in the series",
      ]),

      h2("Progress tracking"),
      p("When a member clicks Mark Complete on a lesson, their progress is recorded. The series page shows how many lessons they've completed out of the total. The dashboard shows in-progress series with a Continue link."),
      p("Progress is per-member and per-lesson. If a lesson appears in two series, marking it complete in one marks it complete in both."),

      h2("My courses page"),
      p("Members can see all their enrolled series at /account/courses (linked as 'My Courses' in the navigation). This page shows enrollment date, progress, and a Continue link for each series they're enrolled in."),

      h2("Things to know"),
      ul([
        "Members can only see series they have access to — there's no 'peek inside' for restricted series",
        "Lesson pages are also access-controlled — a direct link to a lesson requires access to a series that contains that lesson",
        "Google Meet links are on the dashboard, not on lesson or series pages — this is intentional",
        "Members are not automatically unenrolled from a series if their program registration is cancelled — access is additive, not revoked",
      ])
    ),
  },

  // ── teacher-profiles ──────────────────────────────────────────────────────
  {
    slug: "teacher-profiles",
    title: "Teacher Profiles",
    hubSlug: null,
    order: 14,
    relations: ["course-hub", "course-hub-lessons"],
    body: doc(
      h2("What this is"),
      p("Teacher profiles are the staff pages for teachers credited on lessons. Each teacher has a slug, a name, and optionally a bio, photo, and links. Teacher profile pages are public — they appear on the website even without logging in."),
      p("Teachers must be added to the system before they can be credited on a lesson."),

      h2("Where to manage teachers"),
      p("Teacher profiles are managed at /admin/teachers (Admin access required). From this page you can create, edit, and activate or deactivate teacher profiles."),

      h2("Creating a teacher profile"),
      ol([
        "Go to /admin/teachers",
        "Click New Teacher",
        "Enter the teacher's name and slug (URL path, e.g. 'josephine-lee')",
        "Optionally add a bio, photo URL, and any links (personal website, etc.)",
        "Toggle Active on when the profile is ready to be public",
        "Save",
      ]),
      p("Once created, the teacher can be credited on lessons by any Teacher in the Course Hub."),

      h2("What appears on the profile page"),
      p("Teacher profile pages live at /teachers/[slug]. They show the teacher's name, photo, bio, links, and a list of their lessons on the RIM website."),

      h2("Things to know"),
      ul([
        "Teacher slugs are permanent — changing a slug breaks any links to that teacher's profile page",
        "Inactive teachers are hidden from the public website but still appear in the lesson editor's teacher search",
        "A person can have a Teacher role (access to the Course Hub) without having a teacher profile — the role controls staff access, the profile controls public credit",
        "Teacher profiles are separate from User accounts — linking them is not required but can be done manually in the database",
      ])
    ),
  },
];

async function main() {
  console.log("Seeding courses manual sections…");

  for (const section of sections) {
    const result = await db.manualSection.upsert({
      where: { slug: section.slug },
      create: {
        slug: section.slug,
        title: section.title,
        hubSlug: section.hubSlug,
        order: section.order,
        relations: section.relations,
        body: section.body,
      },
      update: {
        title: section.title,
        hubSlug: section.hubSlug,
        order: section.order,
        relations: section.relations,
        body: section.body,
      },
    });
    console.log(`  ✓ ${result.slug} — "${result.title}"`);
  }

  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
