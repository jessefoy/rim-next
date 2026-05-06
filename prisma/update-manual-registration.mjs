/**
 * update-manual-registration.mjs — Surgical drift fix for registration.
 *
 * The original chapter (511 lines, extracted from the retired
 * ManualContent.tsx) is mostly conceptually accurate — registration
 * statuses, dana modes, automatic emails, common tasks. The drift is
 * primarily location: it points to /account/hub/registrar/programs,
 * but Program Manager moved to /tools/programs (session 73).
 *
 * Rather than re-paste the entire chapter, this update fetches the
 * current body, applies targeted string replacements, and writes it
 * back. Preserves accurate content; fixes paths and a couple of
 * small label drifts.
 *
 * Body is normalized to a plain HTML string on save (post-Tiptap
 * canonical format). Renderers handle both shapes via format
 * detection.
 *
 * Idempotent: replacements are safe to re-run.
 * Wired into migrate.mjs with a v1 flag.
 */

const REPLACEMENTS = [
  // Old registrar location → new tool location.
  ["/account/hub/registrar/programs", "/tools/programs"],
  // The actual button label is "Spot opened", not "↑ Spot open".
  ["&ldquo;↑ Spot open&rdquo;", "&ldquo;Spot opened&rdquo;"],
  ["\"↑ Spot open\"", "\"Spot opened\""],
  // Course Hub course editor → the Course Manager. Course Hub no longer
  // houses the editor; it moved to /tools/learning (session 76).
  ["the Course Hub course editor", "the Course Manager at /tools/learning"],
  ["Course Hub course editor", "Course Manager"],
];

function extractHtml(body) {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && body.type === "rawHtml" && typeof body.html === "string") {
    return body.html;
  }
  return null;
}

export async function updateManualRegistration(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "registration" },
    select: { body: true },
  });
  if (!existing?.body) {
    console.log("  ⚠ Manual section 'registration' has no body — skipping");
    return;
  }

  const currentHtml = extractHtml(existing.body);
  if (currentHtml === null) {
    console.log("  ⚠ Manual section 'registration' body has unexpected shape — skipping");
    return;
  }

  let updated = currentHtml;
  for (const [from, to] of REPLACEMENTS) {
    updated = updated.split(from).join(to);
  }

  if (updated === currentHtml) {
    console.log("  ⏭ Manual section 'registration' already current");
    return;
  }

  await db.manualSection.update({
    where: { slug: "registration" },
    data:  { body: updated },  // normalize to plain HTML string
  });
  console.log("  ✔ Updated manual section: registration");
}
