import { readFile } from "node:fs/promises";

// Restore only text authored by the withdrawn review, preserving editor storage
// shape and unrelated edits. Empty replacements are reconstructed in the payload
// from the saved pre-review public page, never matched as empty strings.
export function restoreReviewText(value, fix) {
  if (typeof value === "string") {
    if (!fix.before) throw new Error("Rollback cannot match an empty string");
    if (fix.trimFollowingSpaces) {
      return value.split(fix.before).map((part, i) => i ? part.replace(/^ +/, "") : part).join(fix.after);
    }
    return value.replaceAll(fix.before, fix.after);
  }
  if (Array.isArray(value)) return value.map(v => restoreReviewText(v, fix));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreReviewText(v, fix)]));
  }
  return value;
}

export async function revertNewcomerReview(db) {
  const flag = "revert_newcomer_review_2026_09_26_v1";
  const rows = await db.$queryRawUnsafe('SELECT name FROM "_migration_flags"');
  const applied = new Set(rows.map(row => row.name));
  if (applied.has(flag)) return;
  const groups = JSON.parse(await readFile(new URL("./revert-newcomer-copy-2026-09-26.json", import.meta.url), "utf8"));
  await db.$transaction(async tx => {
    for (const group of groups) {
      if (!group.flags.some(name => applied.has(name))) continue;
      for (const fix of group.fixes) {
        const program = await tx.program.findUnique({ where: { slug: fix.slug } });
        if (!program) throw new Error(`Rollback program missing: ${fix.slug}`);
        const data = {};
        for (const field of fix.fields) {
          const next = restoreReviewText(program[field], fix);
          if (JSON.stringify(next) !== JSON.stringify(program[field])) data[field] = next;
        }
        if (!Object.keys(data).length) {
          console.log(`  Rollback text unchanged (already original or edited): ${fix.slug}`);
          continue;
        }
        const result = await tx.program.updateMany({ where: { id: program.id, updatedAt: program.updatedAt }, data });
        if (!result.count) throw new Error(`Concurrent edit during rollback: ${fix.slug}`);
        console.log(`  Restored pre-review text: ${fix.slug} (${Object.keys(data).join(", ")}).`);
      }
    }

    if (applied.has("newcomer_integration_2026_09_26_v1") || applied.has("newcomer_integration_2026_09_26_v2")) {
      const study = await tx.program.findUnique({ where: { slug: "essential-dharma-study" }, include: { category: true } });
      if (study?.registrationEnabled && study.category?.name === "Community Groups" && study.category.kind === "COMMUNITY_GROUP") {
        // Original category is established by seed-programs and the saved page.
        const original = await tx.programCategory.findUnique({ where: { slug: "drop-ins" } });
        if (!original || original.kind !== "DROP_IN") throw new Error("Original study category missing");
        const result = await tx.program.updateMany({ where: { id: study.id, updatedAt: study.updatedAt }, data: { categoryId: original.id } });
        if (!result.count) throw new Error("Concurrent study edit during rollback");
        console.log("  Restored Essential Dharma Study's pre-review category.");
      }
      const retreat = await tx.program.findUnique({ where: { slug: "awakening-to-the-beauty-of-this-moment" }, include: { programTeachers: true } });
      if (retreat && !retreat.programTeachers.length && JSON.stringify(retreat.teacherFacilitators) === JSON.stringify(["Pam Miller", "Amy Gardner"])) {
        const result = await tx.program.updateMany({ where: { id: retreat.id, updatedAt: retreat.updatedAt }, data: { teacherFacilitators: [] } });
        if (!result.count) throw new Error("Concurrent facilitator edit during rollback");
        console.log("  Removed facilitator field filled by the review.");
      }
    }

    if (applied.has("newcomer_followup_2026_09_26_v1")) {
      const retreat = await tx.program.findUnique({ where: { slug: "awakening-to-the-beauty-of-this-moment" } });
      if (retreat?.danaMode === "voluntary" && retreat.suggestedDana === 175 && retreat.danaFixedAmount === null && retreat.danaBaseAmount === null) {
        const result = await tx.program.updateMany({ where: { id: retreat.id, updatedAt: retreat.updatedAt }, data: { danaMode: "fixed", danaFixedAmount: 175, suggestedDana: null } });
        if (!result.count) throw new Error("Concurrent retreat edit during rollback");
        console.log("  Restored retreat's pre-review fixed $175 setting.");
      }
    }

    if (applied.has("newcomer_copy_2026_09_26_v1")) {
      const insertedBio = "Jesse Foy is the founding teacher of Rooted in Mindfulness. He came to this work through more than fifteen years of mindfulness-based work in medicine. His training includes Mindfulness-Based Stress Reduction at UMass Medical School and study of Buddhism and contemplative psychology at Naropa University. At RIM, he teaches meditation and the practice of care in daily life.";
      const result = await tx.teacherProfile.updateMany({ where: { slug: "jesse-foy", isPublic: true, user: { firstName: "Jesse", lastName: "Foy" }, bio: insertedBio }, data: { bio: null } });
      console.log(`  Removed review-added teacher introduction: ${result.count}.`);
    }
    await tx.$executeRawUnsafe('INSERT INTO "_migration_flags" (name) VALUES ($1)', flag);
  }, { timeout: 60000 });
}
