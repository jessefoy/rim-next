# When a reviewer finding describes a pattern, audit the codebase — don't just patch the cited line

When the reviewer sub-agent flags a class of bug (not a single local mistake), the fix is not closed until the same pattern has been grepped across the codebase and addressed everywhere it lives.

## The session-130 trigger

The reviewer flagged "SubRequest FK is Restrict; the cancel-OPEN-then-delete pattern will FK-violate on any non-OPEN SubRequest" in the heal migration and the program-transfer PUT handler. I fixed those two and shipped. Within the hour, Jesse hit `HTTP 500` on `/api/host/programs/[slug]/clear-rotations` — the *exact same* FK-Restrict bug in a pre-existing production route I hadn't touched in the slice.

A 30-second `grep` for `subRequest.updateMany` would have surfaced four routes with the same shape: `clear-rotations`, `release-host`, `assignments/[id]` DELETE, `assignments/reassign`. All four had the latent bug. None of them were in the slice's diff, so my mental model was "this isn't my code, not in scope." That mental model was wrong.

## The rule

When reading a reviewer finding, ask:

- Is this a **local bug** — wrong condition, off-by-one, typo? Patch the cited line. Done.
- Is this a **pattern** — a class of error rooted in a misunderstanding of an invariant (FK behavior, transaction boundaries, timezone semantics)? **Grep the codebase for the pattern before closing the finding.** Every callsite of the same shape needs the same fix, even if it's not in the slice's diff.

If you're not sure which kind it is, default to the pattern reading. The cost of an extra `grep` is small. The cost of shipping a latent bug to production because you read "fix this" as "fix this site" is the next outage.

## How to know it's a pattern

Signals that a finding is a pattern, not a local bug:

- The reviewer uses generic language: "any SubRequest of any status," "any locale string Safari can't parse," "any concurrent coordinator."
- The mechanism is a constraint or invariant that holds globally (FK behavior, transaction atomicity, time-zone handling, race conditions).
- The cited code looks like canonical patterns that probably exist elsewhere (e.g., "cancel-OPEN-then-delete" is a recognizable Prisma idiom).

When any of those signals are present, the audit is part of the fix.

## What the audit looks like

Pick a grep query that catches the pattern:

```bash
# FK-Restrict cancel-then-delete pattern
grep -rn "subRequest.updateMany" --include="*.ts" app/

# Locale-string parsing through new Date()
grep -rn "new Date(.*toLocaleString" --include="*.ts" --include="*.tsx" .

# Stale Map/closure in useEffect without deps
grep -rn "useEffect.*\[\]\)" --include="*.tsx" components/
```

For each result, ask: does this code have the bug? If yes, apply the same fix. If no, document why it's safe so the next person doesn't have to rederive it.

## Why this matters for RIM specifically

RIM has long-running production data and a small group of coordinators who notice when things break. Latent bugs surface as operational anxiety — "the reset doesn't work," "the email said the wrong thing" — and erode trust in the tool. Catching pattern-bugs at code-review time (cheap) instead of at coordinator-test time (expensive) directly serves the Dharma-rooted principle that clear-seeing tools require clear-seeing implementation.

## Related: the user's described failure beats screenshot context as the framing signal

Two over-corrections in session 130 came from the same misread. Jesse sent screenshots showing UI on a hub I'd recently touched. In both cases I led with what the screenshot showed (the hub, the surface) and made a structural inference ("this UI shouldn't exist on multi-claim hubs," "the Rotations tab on greeter is conceptually wrong"). The user's actual report was narrower: *the action I clicked failed to do the thing it promised.* Two different bugs.

**Rule:** when a user reports a bug with a screenshot:

1. Read what they literally say happened, in their words. That's the framing.
2. Look at the screenshot for supporting evidence — what specifically was shown, what state was the page in, what they clicked.
3. Resist the urge to make structural inferences from the screenshot's context ("you're on the X hub, so the problem must be that X hubs shouldn't…"). The screenshot tells you *where* the failure happened, not *what's structurally wrong*.

If the structural read is correct, it'll survive the click-by-click investigation. If it's wrong, you've added work, removed access, and the actual bug is still unfixed.

The two over-corrections in session 130 traced to this:
- Screenshot of Greeter's Rotations tab with "Set up" button → I assumed multi-claim hubs shouldn't have Rotations at all → hid the tab. Wrong. Actual bug was missing `hubSlug` in client POST.
- Screenshot of Greeter's empty Rotations grid → similar over-read.

Both surfaced because I anchored on the screenshot's context (hub identity) instead of the described failure (action didn't work). Worth defaulting to "the literal click that failed" as the smallest-possible-unit-of-investigation before generalizing.

## Related: "dead code" claims need verification — these searches lie (session 134)

During the session-134 site audit, two removal candidates were flagged "dead" by a sub-agent and were actually live. Before deleting code/CSS as unused, verify usage beyond the obvious grep — these four things evade it:

- **Prisma relation `include`s.** A model read via `include: { teachers: … }` never shows up in a `db.lessonTeacher.*` grep. `LessonTeacher` was called "write-only, drop it" but is read through the relation and *displayed* on the lesson page (a "Teachers" section). Grep the relation field name, not just `db.<model>.`.
- **Raw SQL with `@@map` names.** `MigrationFlag` (`_migration_flags`) and any table touched by `prisma/migrate.mjs` are accessed by the snake_case table name, not the Prisma model name.
- **Template-literal paths/classes.** `/api/host/assignments/reassign` and `/api/lessons/[slug]/questions` were called "orphan routes"; both are fetched via `` `${apiBase}/…` `` / `` `/api/lessons/${slug}/questions` ``. Grep the static path *prefix*, not the full literal.
- **Framework adapter tables.** NextAuth's `Account` / `Session` / `VerificationToken` look unused (`db.account.*` = 0 refs) but are owned by `PrismaAdapter(db)`.

When a sub-agent reports something dead, verify it personally before acting. The cost of one more grep is small; the cost of deleting a live feature is a regression you ship. (Both wrong calls this session were caught *because* of hand-verification — keep that step.)

## Related: breadth questions ("does X work across the app?") need a fan-out audit, not a quick grep (session 153)

The same discipline applies to a *system-spanning* question, not just a reviewer-flagged class. When the question is "does this capability work everywhere it should?", diagnosing from a few greps + a couple of files produces a confident, wrong answer.

Session 153: asked to confirm monthly-recurrence support, I diagnosed from targeted greps + three files and reported a root cause that was **wrong twice over** — the stale date on the program card was a cached `dateText` string (data), not the label-compute path I blamed; and the `.ics` export already emitted `FREQ=MONTHLY` (I'd assumed it broken too). A 14-agent fan-out (readers across every recurrence/label/editor/calendar/rotation surface, then adversarial verifiers trying to *refute* each claim, then synthesis) corrected both and surfaced the actual gap (no MONTHLY branch in `isOccurrenceOnDate`) plus a bonus (the session-room join-gate fix).

**Rule:** when Jesse says "look closely / get this right," or the question spans many surfaces, run the broad audit *before* asserting a diagnosis — and have independent agents try to refute the central claims, not just confirm them. The cheap-looking grep answer is the one most likely to be confidently wrong. Pairs with [[feedback-measure-before-agreeing]].
