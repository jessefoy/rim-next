/**
 * One-time migration: Sanity programs + programCategories → Postgres
 *
 * Run with: npx tsx prisma/migrate-programs-from-sanity.ts
 *
 * Prerequisites:
 *   - .env.local loaded (POSTGRES_PRISMA_URL, SANITY_API_TOKEN, etc.)
 *   - `prisma db push` already run (Program + ProgramCategory models exist)
 *   - Registration.programId, SessionAttendance.programId already nulled out
 *   - ProgramCourse records already deleted
 *
 * Idempotent: safe to run multiple times (upserts by slug).
 *
 * ⚠️  Rich text fields (description, confirmationMessage, reminderMessage,
 *     specialNotes) are converted from Portable Text to minimal Tiptap JSON
 *     paragraphs. They WILL need manual cleanup in the Registrar Hub editor.
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@sanity/client";

const db = new PrismaClient();

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// ─── Portable Text → Tiptap JSON ────────────────────────────────────────────
// Converts Sanity block arrays to minimal Tiptap doc structure.
// Only handles basic blocks (paragraphs with bold/italic/underline/links).
// Custom block types (practiceCallout, verseQuote, etc.) are converted to
// labeled paragraphs. Manual editor cleanup required after migration.

interface SanityBlock {
  _type: string;
  _key?: string;
  style?: string;
  children?: Array<{
    _type: string;
    text?: string;
    marks?: string[];
    _key?: string;
  }>;
  markDefs?: Array<{
    _key: string;
    _type: string;
    href?: string;
  }>;
  listItem?: string;
  level?: number;
  // Custom block fields
  title?: string;
  content?: SanityBlock[];
  quote?: string;
  attribution?: string;
  text?: string;
}

function portableTextToTiptap(blocks: SanityBlock[] | null | undefined): object | null {
  if (!blocks || blocks.length === 0) return null;

  const content: object[] = [];

  for (const block of blocks) {
    if (block._type === "block") {
      const node = convertBlock(block);
      if (node) content.push(node);
    } else if (block._type === "practiceCallout") {
      // Convert to a labeled paragraph
      const label = block.title || "Practice Suggestion";
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: `[${label}]`, marks: [{ type: "bold" }] }],
      });
      if (block.content) {
        for (const child of block.content) {
          const node = convertBlock(child);
          if (node) content.push(node);
        }
      }
    } else if (block._type === "verseQuote") {
      if (block.quote) {
        content.push({
          type: "paragraph",
          content: [
            { type: "text", text: block.quote, marks: [{ type: "italic" }] },
          ],
        });
      }
      if (block.attribution) {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: `— ${block.attribution}` }],
        });
      }
    } else if (block._type === "bodyQuote") {
      if (block.quote) {
        content.push({
          type: "paragraph",
          content: [
            { type: "text", text: block.quote, marks: [{ type: "italic" }] },
          ],
        });
      }
      if (block.attribution) {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: `— ${block.attribution}` }],
        });
      }
    } else if (block._type === "calloutText") {
      if (block.text) {
        content.push({
          type: "paragraph",
          content: [
            { type: "text", text: block.text, marks: [{ type: "italic" }] },
          ],
        });
      }
    } else if (block._type === "image") {
      // Skip images — they'll need manual re-upload
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: "[Image — needs manual re-upload]", marks: [{ type: "bold" }] }],
      });
    }
  }

  if (content.length === 0) return null;

  return { type: "doc", content };
}

function convertBlock(block: SanityBlock): object | null {
  if (block._type !== "block") return null;
  if (!block.children || block.children.length === 0) return null;

  // Check if it's an empty block (just whitespace)
  const allEmpty = block.children.every(
    (c) => !c.text || c.text.trim() === ""
  );
  if (allEmpty) return null;

  // Map heading styles
  const style = block.style || "normal";
  let type = "paragraph";
  const attrs: Record<string, unknown> = {};

  if (style === "h2") {
    type = "heading";
    attrs.level = 2;
  } else if (style === "h3") {
    type = "heading";
    attrs.level = 3;
  } else if (style === "h4") {
    type = "heading";
    attrs.level = 4;
  }

  // Build mark definitions lookup
  const markDefs: Record<string, { _type: string; href?: string }> = {};
  if (block.markDefs) {
    for (const def of block.markDefs) {
      markDefs[def._key] = def;
    }
  }

  // Convert children to Tiptap inline content
  const inlineContent: object[] = [];
  for (const child of block.children) {
    if (child._type !== "span" || !child.text) continue;

    const marks: object[] = [];
    if (child.marks) {
      for (const mark of child.marks) {
        if (mark === "strong") marks.push({ type: "bold" });
        else if (mark === "em") marks.push({ type: "italic" });
        else if (mark === "underline") marks.push({ type: "underline" });
        else if (markDefs[mark]?._type === "link" && markDefs[mark]?.href) {
          marks.push({
            type: "link",
            attrs: { href: markDefs[mark].href, target: "_blank" },
          });
        }
      }
    }

    const node: Record<string, unknown> = { type: "text", text: child.text };
    if (marks.length > 0) node.marks = marks;
    inlineContent.push(node);
  }

  if (inlineContent.length === 0) return null;

  const result: Record<string, unknown> = { type, content: inlineContent };
  if (Object.keys(attrs).length > 0) result.attrs = attrs;
  return result;
}

// ─── Sanity image URL builder ────────────────────────────────────────────────

function sanityImageUrl(ref: string | undefined): string | null {
  if (!ref) return null;
  // ref format: image-{id}-{width}x{height}-{format}
  const parts = ref.split("-");
  if (parts.length < 4) return null;
  const [, id, dimensions, format] = parts;
  return `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${id}-${dimensions}.${format}`;
}

// ─── Day abbreviation mapping ────────────────────────────────────────────────

const daySlugToAbbr: Record<string, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Programs Migration: Sanity → Postgres ===\n");

  // ── 1. Fetch categories from Sanity ──────────────────────────────────────
  const sanityCategories = await sanity.fetch<
    Array<{ _id: string; name: string; slug: { current: string }; hideFromProgramsPage?: boolean }>
  >(`*[_type == "programCategories" && !(_id in path("drafts.**"))] { _id, name, slug, hideFromProgramsPage }`);

  console.log(`Fetched ${sanityCategories.length} categories from Sanity`);

  // Upsert categories
  for (const cat of sanityCategories) {
    await db.programCategory.upsert({
      where: { slug: cat.slug.current },
      create: {
        slug: cat.slug.current,
        name: cat.name,
        hideFromProgramsPage: cat.hideFromProgramsPage ?? false,
      },
      update: {
        name: cat.name,
        hideFromProgramsPage: cat.hideFromProgramsPage ?? false,
      },
    });
  }
  console.log(`✓ ${sanityCategories.length} categories upserted\n`);

  // Build slug → ProgramCategory.id lookup
  const allCategories = await db.programCategory.findMany();
  const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

  // ── 2. Fetch all programs from Sanity ────────────────────────────────────
  const sanityPrograms = await sanity.fetch<Array<Record<string, any>>>(
    `*[_type == "programs" && !(_id in path("drafts.**"))] {
      _id,
      name,
      slug,
      tagline,
      dateText,
      startDatetime,
      endDatetime,
      recurrenceFreq,
      recurrenceInterval,
      recurrenceDays,
      recurrenceCount,
      programFormat,
      venue,
      locationText,
      locationLink,
      zoomLink,
      meetHostAccount,
      calendarEventId,
      registrationEnabled,
      registrationClosed,
      registrationCapacity,
      registrationDeadline,
      registrationFields[] { _key, label, fieldType, required, options },
      confirmationMessage,
      reminderDate,
      reminderMessage,
      danaMode,
      suggestedDana,
      danaBaseAmount,
      danaFixedAmount,
      danaMessage,
      danaText,
      quote,
      quoteSource,
      programDescription[] {
        ...,
        _type == "practiceCallout" => { _type, _key, title, content[] { ... } },
        _type == "bodyQuote"       => { _type, _key, quote, attribution },
        _type == "verseQuote"      => { _type, _key, quote, attribution },
        _type == "calloutText"     => { _type, _key, text }
      },
      specialNotes,
      programCategory-> { slug },
      teacherFacilitators[]-> { name },
      dayOfWeek[]-> { name, slug },
      largeProgramImage { asset-> { _ref, url } },
      linkedCourses[]-> { slug },
      dashboardSpecialAnnouncement,
      dashboardEarlyArrivalMessage,
      removeFromProgramList,
      hideFromProgramPageList,
      sortOrder
    }`
  );

  console.log(`Fetched ${sanityPrograms.length} programs from Sanity`);

  // Build Sanity _id → slug mapping for later FK updates
  const sanityIdToSlug = new Map<string, string>();
  const richTextPrograms: string[] = [];

  let programCount = 0;
  let errorCount = 0;

  for (const p of sanityPrograms) {
    const slug = p.slug?.current;
    if (!slug) {
      console.error(`⚠ Skipping program "${p.name}" — no slug`);
      errorCount++;
      continue;
    }

    sanityIdToSlug.set(p._id, slug);

    // Track programs with rich text that needs review
    const hasRichText =
      p.programDescription?.length > 0 ||
      p.confirmationMessage?.length > 0 ||
      p.reminderMessage?.length > 0 ||
      p.specialNotes?.length > 0;
    if (hasRichText) richTextPrograms.push(slug);

    // Map dayOfWeek references to abbreviations
    const dayOfWeek: string[] = [];
    if (p.dayOfWeek && Array.isArray(p.dayOfWeek)) {
      for (const d of p.dayOfWeek) {
        const slug2 = d.slug?.current || d.slug;
        if (slug2 && daySlugToAbbr[slug2]) {
          dayOfWeek.push(daySlugToAbbr[slug2]);
        } else if (d.name) {
          // Fallback: derive from name
          const abbr = daySlugToAbbr[d.name.toLowerCase()];
          if (abbr) dayOfWeek.push(abbr);
        }
      }
    }

    // Map recurrenceDays (already abbreviations in Sanity)
    const recurrenceDays: string[] = p.recurrenceDays || [];

    // Map teacherFacilitators to plain text names
    const teacherFacilitators: string[] = [];
    if (p.teacherFacilitators && Array.isArray(p.teacherFacilitators)) {
      for (const t of p.teacherFacilitators) {
        if (t.name) teacherFacilitators.push(t.name);
      }
    }

    // Category lookup
    const categorySlug = p.programCategory?.slug?.current || p.programCategory?.slug;
    const categoryId = categorySlug ? categoryBySlug.get(categorySlug) ?? null : null;

    // Image URL
    const imageUrl = p.largeProgramImage?.asset?.url ||
      sanityImageUrl(p.largeProgramImage?.asset?._ref) ||
      null;

    // Convert rich text fields
    const description = portableTextToTiptap(p.programDescription);
    const confirmationMessage = portableTextToTiptap(p.confirmationMessage);
    const reminderMessage = portableTextToTiptap(p.reminderMessage);
    const specialNotes = portableTextToTiptap(p.specialNotes);

    // Registration fields — strip Sanity internal fields
    const registrationFields = p.registrationFields
      ? p.registrationFields.map((f: any) => ({
          label: f.label,
          fieldType: f.fieldType,
          required: f.required ?? false,
          options: f.options || [],
        }))
      : null;

    // Normalize recurrenceFreq to uppercase (Sanity uses lowercase)
    const recurrenceFreq = p.recurrenceFreq
      ? p.recurrenceFreq.toUpperCase()
      : null;

    try {
      await db.program.upsert({
        where: { slug },
        create: {
          slug,
          name: p.name,
          tagline: p.tagline || null,
          programImage: imageUrl,
          description: description ?? undefined,
          pullQuote: p.quote || null,
          pullQuoteSource: p.quoteSource || null,
          specialNotes: specialNotes ?? undefined,
          teacherFacilitators,
          categoryId,
          dateText: p.dateText || null,
          programFormat: p.programFormat || "in-person",
          venue: p.venue || "at-rim",
          locationText: p.locationText || null,
          locationLink: p.locationLink || null,
          zoomLink: p.zoomLink || null,
          meetHostAccount: p.meetHostAccount || null,
          calendarEventId: p.calendarEventId || null,
          startDatetime: p.startDatetime ? new Date(p.startDatetime) : null,
          endDatetime: p.endDatetime ? new Date(p.endDatetime) : null,
          recurrenceFreq,
          recurrenceInterval: p.recurrenceInterval ?? null,
          recurrenceDays,
          recurrenceCount: p.recurrenceCount ?? null,
          registrationEnabled: p.registrationEnabled ?? false,
          registrationClosed: p.registrationClosed ?? false,
          registrationCapacity: p.registrationCapacity ?? null,
          registrationDeadline: p.registrationDeadline
            ? new Date(p.registrationDeadline)
            : null,
          registrationFields: registrationFields ?? undefined,
          confirmationMessage: confirmationMessage ?? undefined,
          reminderDate: p.reminderDate ? new Date(p.reminderDate) : null,
          reminderMessage: reminderMessage ?? undefined,
          danaMode: p.danaMode || "none",
          suggestedDana: p.suggestedDana ?? null,
          danaBaseAmount: p.danaBaseAmount ?? null,
          danaFixedAmount: p.danaFixedAmount ?? null,
          danaMessage: p.danaMessage || null,
          danaText: p.danaText || null,
          specialAnnouncement: p.dashboardSpecialAnnouncement || null,
          earlyArrivalMessage: p.dashboardEarlyArrivalMessage || null,
          hideFromDashboard: p.removeFromProgramList ?? false,
          dayOfWeek,
          sortOrder: p.sortOrder ?? null,
          removeFromProgramList: p.removeFromProgramList ?? false,
          hideFromProgramPageList: p.hideFromProgramPageList ?? false,
        },
        update: {
          name: p.name,
          tagline: p.tagline || null,
          programImage: imageUrl,
          description: description ?? undefined,
          pullQuote: p.quote || null,
          pullQuoteSource: p.quoteSource || null,
          specialNotes: specialNotes ?? undefined,
          teacherFacilitators,
          categoryId,
          dateText: p.dateText || null,
          programFormat: p.programFormat || "in-person",
          venue: p.venue || "at-rim",
          locationText: p.locationText || null,
          locationLink: p.locationLink || null,
          zoomLink: p.zoomLink || null,
          meetHostAccount: p.meetHostAccount || null,
          calendarEventId: p.calendarEventId || null,
          startDatetime: p.startDatetime ? new Date(p.startDatetime) : null,
          endDatetime: p.endDatetime ? new Date(p.endDatetime) : null,
          recurrenceFreq,
          recurrenceInterval: p.recurrenceInterval ?? null,
          recurrenceDays,
          recurrenceCount: p.recurrenceCount ?? null,
          registrationEnabled: p.registrationEnabled ?? false,
          registrationClosed: p.registrationClosed ?? false,
          registrationCapacity: p.registrationCapacity ?? null,
          registrationDeadline: p.registrationDeadline
            ? new Date(p.registrationDeadline)
            : null,
          registrationFields: registrationFields ?? undefined,
          confirmationMessage: confirmationMessage ?? undefined,
          reminderDate: p.reminderDate ? new Date(p.reminderDate) : null,
          reminderMessage: reminderMessage ?? undefined,
          danaMode: p.danaMode || "none",
          suggestedDana: p.suggestedDana ?? null,
          danaBaseAmount: p.danaBaseAmount ?? null,
          danaFixedAmount: p.danaFixedAmount ?? null,
          danaMessage: p.danaMessage || null,
          danaText: p.danaText || null,
          specialAnnouncement: p.dashboardSpecialAnnouncement || null,
          earlyArrivalMessage: p.dashboardEarlyArrivalMessage || null,
          hideFromDashboard: p.removeFromProgramList ?? false,
          dayOfWeek,
          sortOrder: p.sortOrder ?? null,
          removeFromProgramList: p.removeFromProgramList ?? false,
          hideFromProgramPageList: p.hideFromProgramPageList ?? false,
        },
      });
      programCount++;
    } catch (err) {
      console.error(`✗ Error upserting program "${slug}":`, err);
      errorCount++;
    }
  }

  console.log(`✓ ${programCount} programs upserted (${errorCount} errors)\n`);

  // ── 3. Build slug → Postgres Program.id lookup ───────────────────────────
  const allPrograms = await db.program.findMany({ select: { id: true, slug: true } });
  const programBySlug = new Map(allPrograms.map((p) => [p.slug, p.id]));

  // ── 4. Update Registration.programId ─────────────────────────────────────
  // Match by programSlug (which is already stored on each registration)
  let regUpdated = 0;
  let regSkipped = 0;

  const registrations = await db.registration.findMany({
    where: { programId: null },
    select: { id: true, programSlug: true },
  });

  for (const reg of registrations) {
    const pgId = programBySlug.get(reg.programSlug);
    if (pgId) {
      await db.registration.update({
        where: { id: reg.id },
        data: { programId: pgId },
      });
      regUpdated++;
    } else {
      regSkipped++;
    }
  }
  console.log(
    `✓ Registration.programId: ${regUpdated} updated, ${regSkipped} skipped (no matching program)`
  );

  // ── 5. Recreate ProgramCourse records ────────────────────────────────────
  // linkedCourses in Sanity → ProgramCourse in Postgres
  let pcCreated = 0;
  let pcSkipped = 0;

  // Look up courses by slug
  const allCourses = await db.course.findMany({ select: { id: true, slug: true } });
  const courseBySlug = new Map(allCourses.map((c) => [c.slug, c.id]));

  for (const p of sanityPrograms) {
    const slug = p.slug?.current;
    if (!slug) continue;

    const pgProgramId = programBySlug.get(slug);
    if (!pgProgramId) continue;

    if (p.linkedCourses && Array.isArray(p.linkedCourses)) {
      for (const lc of p.linkedCourses) {
        const courseSlug = lc.slug?.current || lc.slug;
        if (!courseSlug) continue;

        const courseId = courseBySlug.get(courseSlug);
        if (!courseId) {
          console.warn(`  ⚠ Course "${courseSlug}" not found for program "${slug}" — skipping`);
          pcSkipped++;
          continue;
        }

        try {
          await db.programCourse.upsert({
            where: {
              programId_courseId: { programId: pgProgramId, courseId },
            },
            create: { programId: pgProgramId, courseId },
            update: {},
          });
          pcCreated++;
        } catch (err) {
          console.error(`  ✗ ProgramCourse error (${slug} → ${courseSlug}):`, err);
          pcSkipped++;
        }
      }
    }
  }
  console.log(
    `✓ ProgramCourse: ${pcCreated} created, ${pcSkipped} skipped`
  );

  // ── 6. Update SessionAttendance.programId ────────────────────────────────
  let saUpdated = 0;
  let saSkipped = 0;

  const attendances = await db.sessionAttendance.findMany({
    where: { programId: null },
    select: { id: true, programSlug: true },
  });

  for (const sa of attendances) {
    const pgId = programBySlug.get(sa.programSlug);
    if (pgId) {
      await db.sessionAttendance.update({
        where: { id: sa.id },
        data: { programId: pgId },
      });
      saUpdated++;
    } else {
      saSkipped++;
    }
  }
  console.log(
    `✓ SessionAttendance.programId: ${saUpdated} updated, ${saSkipped} skipped\n`
  );

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("=== Migration Summary ===");
  console.log(`  Categories:        ${sanityCategories.length} upserted`);
  console.log(`  Programs:          ${programCount} upserted, ${errorCount} errors`);
  console.log(`  Registrations:     ${regUpdated} linked, ${regSkipped} unmatched`);
  console.log(`  ProgramCourses:    ${pcCreated} created, ${pcSkipped} skipped`);
  console.log(`  SessionAttendance: ${saUpdated} linked, ${saSkipped} unmatched`);

  if (richTextPrograms.length > 0) {
    console.log(
      `\n⚠  ${richTextPrograms.length} programs have rich text content that needs manual review:`
    );
    for (const s of richTextPrograms) {
      console.log(`   - ${s}`);
    }
    console.log(
      "\n   Open each in the Registrar Hub editor (Phase 3b) and clean up formatting."
    );
  }

  console.log("\n✓ Done.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
