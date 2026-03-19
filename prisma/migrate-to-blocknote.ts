/**
 * migrate-to-blocknote.ts
 *
 * One-time migration: converts all Tiptap JSON fields to BlockNote JSON.
 *
 * Conversion path: Tiptap JSON → HTML (via @tiptap/html) → BlockNote JSON
 * (via ServerBlockNoteEditor.tryParseHTMLToBlocks)
 *
 * Usage:
 *   # Dry run first — shows what would be converted without writing
 *   set -a && source .env.local && set +a
 *   npx tsx prisma/migrate-to-blocknote.ts --dry-run
 *
 *   # Live run
 *   set -a && source .env.local && set +a
 *   npx tsx prisma/migrate-to-blocknote.ts
 *
 * Safe to run multiple times — skips records that are already BlockNote JSON
 * or null. Only processes records with Tiptap JSON (object with { type: "doc" }).
 */

import { PrismaClient } from "@prisma/client";
import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { VerseQuote, PracticeSuggestion, Callout } from "../lib/tiptap-extensions";

const db = new PrismaClient({
  datasources: {
    db: { url: process.env.POSTGRES_URL_NON_POOLING },
  },
});

const DRY_RUN = process.argv.includes("--dry-run");

// ── Tiptap extensions ─────────────────────────────────────────────────────────

const contentExtensions = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  VerseQuote,
  PracticeSuggestion,
  Callout,
];

const formattedExtensions = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image,
];

// ── Format detection ──────────────────────────────────────────────────────────

function isTiptapJSON(json: any): boolean {
  return (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    json.type === "doc" &&
    Array.isArray(json.content)
  );
}

function isBlockNoteJSON(json: any): boolean {
  return (
    Array.isArray(json) &&
    json.length > 0 &&
    typeof json[0] === "object" &&
    json[0] !== null &&
    "id" in json[0] &&
    typeof json[0].type === "string"
  );
}

function isRawHtml(json: any): boolean {
  return (
    json !== null &&
    typeof json === "object" &&
    json.type === "rawHtml" &&
    typeof json.html === "string"
  );
}

// ── Conversion ────────────────────────────────────────────────────────────────

async function tiptapToBlockNote(
  json: any,
  useContentExtensions: boolean
): Promise<any[] | null> {
  try {
    const html = generateHTML(
      json,
      useContentExtensions ? contentExtensions : formattedExtensions
    );
    const { ServerBlockNoteEditor } = await import("@blocknote/server-util");
    const editor = ServerBlockNoteEditor.create();
    const blocks = await editor.tryParseHTMLToBlocks(html);
    return blocks.length > 0 ? blocks : null;
  } catch (e) {
    console.error("  ✗ Conversion failed:", e);
    return null;
  }
}

async function rawHtmlToBlockNote(html: string): Promise<any[] | null> {
  try {
    const { ServerBlockNoteEditor } = await import("@blocknote/server-util");
    const editor = ServerBlockNoteEditor.create();
    const blocks = await editor.tryParseHTMLToBlocks(html);
    return blocks.length > 0 ? blocks : null;
  } catch (e) {
    console.error("  ✗ rawHtml conversion failed:", e);
    return null;
  }
}

// ── Migration helpers ─────────────────────────────────────────────────────────

interface FieldMigrationResult {
  total: number;
  converted: number;
  skipped: number;
  failed: number;
}

async function migrateField<T extends { id: string }>(
  label: string,
  records: T[],
  getField: (r: T) => any,
  writeField: (id: string, converted: any) => Promise<void>,
  useContentExtensions = false
): Promise<FieldMigrationResult> {
  const result: FieldMigrationResult = {
    total: records.length,
    converted: 0,
    skipped: 0,
    failed: 0,
  };
  console.log(`\n  ${label} — ${records.length} records`);

  for (const record of records) {
    const field = getField(record);

    if (field === null || field === undefined) {
      result.skipped++;
      continue;
    }

    if (isBlockNoteJSON(field)) {
      result.skipped++;
      continue;
    }

    let converted: any[] | null = null;

    if (isRawHtml(field)) {
      converted = await rawHtmlToBlockNote(field.html);
    } else if (isTiptapJSON(field)) {
      converted = await tiptapToBlockNote(field, useContentExtensions);
    } else {
      console.log(`  ? ${record.id} — unknown format, skipping`);
      result.skipped++;
      continue;
    }

    if (!converted) {
      console.error(`  ✗ ${record.id} — conversion returned null`);
      result.failed++;
      continue;
    }

    // Ensure clean JSON (removes undefined values, NaN, etc.)
    const cleanConverted = JSON.parse(JSON.stringify(converted));

    if (DRY_RUN) {
      console.log(
        `  ✓ [DRY RUN] ${record.id} — would convert (${cleanConverted.length} blocks)`
      );
      result.converted++;
    } else {
      try {
        await writeField(record.id, cleanConverted);
        result.converted++;
      } catch (e) {
        console.error(`  ✗ ${record.id} — write failed:`, e);
        result.failed++;
      }
    }
  }

  console.log(
    `    → converted: ${result.converted}, skipped: ${result.skipped}, failed: ${result.failed}`
  );
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 BlockNote migration — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
  const allResults: FieldMigrationResult[] = [];

  // ── users.adminNotes ──
  {
    const records = await db.user.findMany({
      where: { adminNotes: { not: null } },
      select: { id: true, adminNotes: true },
    });
    allResults.push(
      await migrateField(
        "users.adminNotes",
        records,
        (r) => r.adminNotes,
        (id, val) =>
          db.user.update({ where: { id }, data: { adminNotes: val } }).then(() => {})
      )
    );
  }

  // ── hub_announcements.body ──
  {
    const records = await db.hubAnnouncement.findMany({
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "hub_announcements.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.hubAnnouncement.update({ where: { id }, data: { body: val } }).then(() => {})
      )
    );
  }

  // ── hub_conversation_threads.body ──
  {
    const records = await db.hubConversationThread.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "hub_conversation_threads.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.hubConversationThread
            .update({ where: { id }, data: { body: val } })
            .then(() => {})
      )
    );
  }

  // ── hub_conversation_replies.body ──
  {
    const records = await db.hubConversationReply.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "hub_conversation_replies.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.hubConversationReply
            .update({ where: { id }, data: { body: val } })
            .then(() => {})
      )
    );
  }

  // ── host_threads.body ──
  {
    const records = await db.hostThread.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "host_threads.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.hostThread.update({ where: { id }, data: { body: val } }).then(() => {})
      )
    );
  }

  // ── host_replies.body ──
  {
    const records = await db.hostReply.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "host_replies.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.hostReply.update({ where: { id }, data: { body: val } }).then(() => {})
      )
    );
  }

  // ── sub_requests.message ──
  {
    const records = await db.subRequest.findMany({
      where: { message: { not: null } },
      select: { id: true, message: true },
    });
    allResults.push(
      await migrateField(
        "sub_requests.message",
        records,
        (r) => r.message,
        (id, val) =>
          db.subRequest.update({ where: { id }, data: { message: val } }).then(() => {})
      )
    );
  }

  // ── sub_claims.message ──
  {
    const records = await db.subClaim.findMany({
      where: { message: { not: null } },
      select: { id: true, message: true },
    });
    allResults.push(
      await migrateField(
        "sub_claims.message",
        records,
        (r) => r.message,
        (id, val) =>
          db.subClaim.update({ where: { id }, data: { message: val } }).then(() => {})
      )
    );
  }

  // ── session_attendance.postSessionNote ──
  {
    const records = await db.sessionAttendance.findMany({
      where: { postSessionNote: { not: null } },
      select: { id: true, postSessionNote: true },
    });
    allResults.push(
      await migrateField(
        "session_attendance.postSessionNote",
        records,
        (r) => r.postSessionNote,
        (id, val) =>
          db.sessionAttendance
            .update({ where: { id }, data: { postSessionNote: val } })
            .then(() => {})
      )
    );
  }

  // ── session_reports.reflection ──
  {
    const records = await db.sessionReport.findMany({
      where: { reflection: { not: null } },
      select: { id: true, reflection: true },
    });
    allResults.push(
      await migrateField(
        "session_reports.reflection",
        records,
        (r) => r.reflection,
        (id, val) =>
          db.sessionReport
            .update({ where: { id }, data: { reflection: val } })
            .then(() => {})
      )
    );
  }

  // ── session_cohost_reports.reflection ──
  {
    const records = await db.sessionCoHostReport.findMany({
      where: { reflection: { not: null } },
      select: { id: true, reflection: true },
    });
    allResults.push(
      await migrateField(
        "session_cohost_reports.reflection",
        records,
        (r) => r.reflection,
        (id, val) =>
          db.sessionCoHostReport
            .update({ where: { id }, data: { reflection: val } })
            .then(() => {})
      )
    );
  }

  // ── support_notes.body ──
  {
    const records = await db.supportNote.findMany({
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "support_notes.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.supportNote.update({ where: { id }, data: { body: val } }).then(() => {})
      )
    );
  }

  // ── support_templates.body ──
  {
    const records = await db.supportTemplate.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "support_templates.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.supportTemplate
            .update({ where: { id }, data: { body: val } })
            .then(() => {})
      )
    );
  }

  // ── manual_sections.body — uses content extensions (includes tables) ──
  {
    const records = await db.manualSection.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true, slug: true },
    });
    allResults.push(
      await migrateField(
        "manual_sections.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.manualSection.update({ where: { id }, data: { body: val } }).then(() => {}),
        true // useContentExtensions
      )
    );
  }

  // ── lesson_notes.body ──
  {
    const records = await db.lessonNote.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "lesson_notes.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.lessonNote.update({ where: { id }, data: { body: val } }).then(() => {})
      )
    );
  }

  // ── reflection_questions.body ──
  {
    const records = await db.reflectionQuestion.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true },
    });
    allResults.push(
      await migrateField(
        "reflection_questions.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.reflectionQuestion
            .update({ where: { id }, data: { body: val } })
            .then(() => {})
      )
    );
  }

  // ── lessons.body — uses content extensions ──
  {
    const records = await db.lesson.findMany({
      where: { body: { not: null } },
      select: { id: true, body: true, slug: true },
    });
    allResults.push(
      await migrateField(
        "lessons.body",
        records,
        (r) => r.body,
        (id, val) =>
          db.lesson.update({ where: { id }, data: { body: val } }).then(() => {}),
        true // useContentExtensions
      )
    );
  }

  // ── courses.description ──
  {
    const records = await db.course.findMany({
      where: { description: { not: null } },
      select: { id: true, description: true },
    });
    allResults.push(
      await migrateField(
        "courses.description",
        records,
        (r) => r.description,
        (id, val) =>
          db.course.update({ where: { id }, data: { description: val } }).then(() => {})
      )
    );
  }

  // ── programs.description — uses content extensions ──
  {
    const records = await db.program.findMany({
      where: { description: { not: null } },
      select: { id: true, description: true },
    });
    allResults.push(
      await migrateField(
        "programs.description",
        records,
        (r) => r.description,
        (id, val) =>
          db.program.update({ where: { id }, data: { description: val } }).then(() => {}),
        true // useContentExtensions
      )
    );
  }

  // ── programs.specialNotes ──
  {
    const records = await db.program.findMany({
      where: { specialNotes: { not: null } },
      select: { id: true, specialNotes: true },
    });
    allResults.push(
      await migrateField(
        "programs.specialNotes",
        records,
        (r) => r.specialNotes,
        (id, val) =>
          db.program.update({ where: { id }, data: { specialNotes: val } }).then(() => {})
      )
    );
  }

  // ── programs.confirmationMessage ──
  {
    const records = await db.program.findMany({
      where: { confirmationMessage: { not: null } },
      select: { id: true, confirmationMessage: true },
    });
    allResults.push(
      await migrateField(
        "programs.confirmationMessage",
        records,
        (r) => r.confirmationMessage,
        (id, val) =>
          db.program
            .update({ where: { id }, data: { confirmationMessage: val } })
            .then(() => {})
      )
    );
  }

  // ── programs.reminderMessage ──
  {
    const records = await db.program.findMany({
      where: { reminderMessage: { not: null } },
      select: { id: true, reminderMessage: true },
    });
    allResults.push(
      await migrateField(
        "programs.reminderMessage",
        records,
        (r) => r.reminderMessage,
        (id, val) =>
          db.program
            .update({ where: { id }, data: { reminderMessage: val } })
            .then(() => {})
      )
    );
  }

  // ── registrations.notes ──
  {
    const records = await db.registration.findMany({
      where: { notes: { not: null } },
      select: { id: true, notes: true },
    });
    allResults.push(
      await migrateField(
        "registrations.notes",
        records,
        (r) => r.notes,
        (id, val) =>
          db.registration.update({ where: { id }, data: { notes: val } }).then(() => {})
      )
    );
  }

  // ── Summary ──
  const totals = allResults.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      converted: acc.converted + r.converted,
      skipped: acc.skipped + r.skipped,
      failed: acc.failed + r.failed,
    }),
    { total: 0, converted: 0, skipped: 0, failed: 0 }
  );

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${DRY_RUN ? "DRY RUN" : "MIGRATION"} COMPLETE`);
  console.log(`Total records scanned: ${totals.total}`);
  console.log(`Converted: ${totals.converted}`);
  console.log(`Skipped (null or already BlockNote): ${totals.skipped}`);
  console.log(`Failed: ${totals.failed}`);

  if (totals.failed > 0) {
    console.error(`\n⚠️  ${totals.failed} record(s) failed to convert. Check logs above.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`\nRe-run without --dry-run to apply changes.`);
  } else {
    console.log(`\n✅ Migration complete. All records converted.`);
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
