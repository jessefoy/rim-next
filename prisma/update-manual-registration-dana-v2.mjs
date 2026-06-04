/**
 * update-manual-registration-dana-v2.mjs — session 136.
 *
 * Targeted update of the Registration manual chapter for the
 * "completion follows the dana choice" rework. Rather than reproduce the
 * whole chapter body, this applies surgical string replacements to the stored
 * body so it reflects: confirmation timing (after the dana choice, not at
 * submit), the "I'm not donating at this time" decline, the held/discarded
 * behavior for required-payment programs, the "No dana" roster label, and the
 * new support@ new-registration notice.
 *
 * Idempotent: each replace is a no-op once the OLD text is gone. Flag-guarded
 * in migrate.mjs so it runs once regardless.
 */

const REPLACEMENTS = [
  // 1. The Register click + dana step — was "confirmation within seconds" + "complete now or later".
  [
    `<p>They click <strong>Register</strong> (or <strong>Join Waitlist</strong> if the program is full). A confirmation email arrives within seconds. If waitlisted, the email says so and gives their queue position.</p>
<p>If the program has dana, the form moves to the dana step. They can complete it now or return later.</p>`,
    `<p>They click <strong>Register</strong> (or <strong>Join Waitlist</strong> if the program is full). What happens next depends on the program's dana:</p>
<ul>
<li><strong>No dana (free programs).</strong> They're registered immediately and the confirmation email arrives within seconds.</li>
<li><strong>Voluntary dana.</strong> They're registered right away, but the form first invites a dana offering. They can give, or choose <strong>"I'm not donating at this time."</strong> Either choice completes the registration and sends the confirmation — so the confirmation lands <em>after</em> they've made the dana decision, not before. If they simply close the tab without choosing, they're still registered; the system sends their confirmation within a day and records the dana as "No dana."</li>
<li><strong>Required payment (a base fee or a fixed price).</strong> The registration isn't final until they pay. Their spot is held while they're at checkout, but they won't appear on your list, won't get a confirmation, and (if they're new) won't have an account until the payment goes through. If they abandon checkout, it's as though they never registered — the held spot releases itself.</li>
</ul>
<p>If waitlisted, the confirmation email says so and gives their queue position.</p>`,
  ],
  // 2. Registered status wording.
  [
    `<li><strong>Registered</strong> — confirmed spot. Set automatically when someone submits and capacity is available. This is the normal state. Counts toward capacity.</li>`,
    `<li><strong>Registered</strong> — confirmed spot. For a free or voluntary-dana program this is set the moment they submit; for a program that requires payment, it's set when the payment clears (before that the registration is held and invisible). This is the normal state. Counts toward capacity.</li>`,
  ],
  // 3. Add a note after the status list about held registrations never appearing.
  [
    `<p>(The database also has an "Approved" status, kept from an earlier design. The UI treats it the same as Registered. You won't see it as a distinct option.)</p>`,
    `<p>You'll never see a <em>held</em> (unpaid, required-payment) registration on your list — it appears only once payment completes, and an abandoned checkout leaves no trace. Your list always reflects real, settled registrations.</p>
<p>(The database also has an "Approved" status, kept from an earlier design. The UI treats it the same as Registered. You won't see it as a distinct option.)</p>`,
  ],
  // 4. Voluntary dana mode description.
  [
    `<li><strong>Voluntary.</strong> A suggested amount is shown. The member can change it to any amount or skip it entirely.</li>`,
    `<li><strong>Voluntary.</strong> A suggested amount is shown. The member can give any amount, or choose "I'm not donating at this time." The dana is genuinely optional — the registration is complete either way, and the confirmation is sent once they've decided.</li>`,
  ],
  // 5. Dana column values — Pending wording + "Waived" → "No dana".
  [
    `<li><strong>Pending</strong> — dana is expected but not yet completed. The member can return to <code>/programs/[slug]/register</code> to complete it. You can send a Dana Reminder from the row.</li>
<li><strong>Received</strong> — dana paid via Stripe. The amount is recorded.</li>
<li><strong>Waived</strong> — explicitly waived.</li>`,
    `<li><strong>Pending</strong> — a voluntary dana the member hasn't acted on yet. You can send a Dana Reminder from the row.</li>
<li><strong>Received</strong> — dana paid via Stripe. The amount is recorded.</li>
<li><strong>No dana</strong> — the member chose "I'm not donating at this time" on a voluntary program, or the program has no dana practice. (Shown as "No dana" on the list — the same as the older "waived" state.)</li>`,
  ],
  // 6. Confirmation email timing.
  [
    `<li><strong>Confirmation</strong> (to registrant) — when someone registers. Includes program name, date, time, location, any custom confirmation message, and calendar links. If waitlisted, includes their queue position.</li>`,
    `<li><strong>Confirmation</strong> (to registrant) — when a registration is completed (for a voluntary-dana program, that's after they give or decline; for a paid program, after payment). Includes program name, date, time, location, any custom confirmation message, and calendar links. If waitlisted, includes their queue position.</li>
<li><strong>New-registration notice</strong> (to the support inbox) — every time a registration is completed, support@rootedinmindfulness.org gets a note with the person's name and email, the program, the dana status, and a direct link to that program's registration list. A heads-up so the team can watch for questions. It fires only for real, completed registrations — never for an abandoned checkout.</li>`,
  ],
];

export async function updateManualRegistrationDanaV2(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "registration" },
    select: { id: true, body: true },
  });
  if (!existing) {
    console.log("  ⏭ registration manual section not found — skipping dana-v2 update");
    return;
  }

  let body = existing.body;
  let applied = 0;
  for (const [oldText, newText] of REPLACEMENTS) {
    if (body.includes(oldText)) {
      body = body.replace(oldText, newText);
      applied++;
    }
  }

  if (body !== existing.body) {
    await db.manualSection.update({
      where: { slug: "registration" },
      data: { body },
    });
    console.log(`  ✔ Updated manual section: registration (dana flow v2 — ${applied}/${REPLACEMENTS.length} replacements)`);
  } else {
    console.log("  ⏭ registration manual section already current (dana flow v2)");
  }
}
