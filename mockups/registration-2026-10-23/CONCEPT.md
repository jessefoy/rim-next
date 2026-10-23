# Programs and Registration, thought through fresh (2026-10-23)

Design concept for Jesse's review. Not built. The mockup beside this file (`index.html`) shows it; `index-v2.html` is the earlier version, kept for comparison.

## Where the discomfort came from

The earlier versions treated privacy as a permission system: share a roster at a level, give each question an audience, then let rules decide what each page shows. Every piece was defensible, but together they asked a volunteer building a program to think like a database administrator, and the pages that came out of the rules had no one behind them. You couldn't say who a teacher's page was *for*, only which settings produced it.

## The fresh idea: every question has someone asking it, and every program has people helping

Two plain facts already true at RIM replace the permission system:

1. **People help with a program.** A teacher teaches it. The Hosting Team runs its online room. Greeters stand at the door. The kitchen cooks for a retreat. The registration team looks after everyone who signs up. A program already knows most of this (its teachers, its hosting team, its supporting teams).
2. **Each question on the form is asked by one of those helpers, for a reason.** The teacher asks about practice. The kitchen asks about dietary needs. The greeters ask whether someone needs help at the door. The registration team asks about rides.

So the editor doesn't ask "who may read this answer?" It asks **"who's asking?"**, and the answer goes to the one who asked (and always to the registration team). Each helper then has **one page that is plainly theirs**: what they asked, the answers, and who's coming. Nobody shares, nobody sets levels, and the registrant sees, on the form, who is asking each question and why.

## Six parts

1. **Who's helping** (a section in the program editor). One list: the teachers, the hosting team (or "no host needed"), the teams that staff it (greeters, AV), and the teams that prepare for it (a kitchen). The registration team is always there. Beside each helper, one plain line says what their page will show. Teachers can reach each person by email and phone (Jesse, 2026-10-23). Other helpers see no contact details unless a box is ticked for them ("can reach people", for a coordinator arranging rides or rooms). Only the registration team sees dana.
2. **Who's asking** (questions). Each question is asked by one helper. The form groups questions under the person or team asking ("From Jesse, your teacher", "Dietary needs", "For the greeters at the door"), so the registrant knows why each question is there and who reads it. Required or optional per question; optional choices offer "Prefer not to say".
3. **Each helper's page.** Reached from My Home, where teachers and greeters already see their program on the day. The teacher's page: who's coming (first-timers marked), the answers to the teacher's own questions, and notes the registration team wrote for the teacher. The greeters' page: today's list of names, the greeters' own question (help at the door), and a tap to mark someone arrived. The Kitchen Team's page, titled Dietary needs: how many are coming, and the answers to the dietary questions, counted, with names. Every name opens that person's card, holding only what they told this helper.
4. **The desk** (the Registration app's front page). One calm list across every program of what needs a person: a place to offer, a dana step to follow up, a reminder going out, someone who wrote something the registration team should read. Each has its action in place. The programs follow below.
5. **First time at RIM.** Each person carries, from RIM's own records, whether this is their first program. The registrar and the teacher see it, so a newcomer can be welcomed. (It was designed long ago as "first-time attendee flags" in `RIM_Role_Design.md` and deferred; it comes free from registrations already stored.)
6. **Start from a shape, or from last time.** A new program begins with "What are you offering?" A drop-in sit, a class, a course, a workshop, a day of mindfulness, a retreat: each fills sensible starting settings (who joins how, dana, questions, reminders), all editable. Or "Copy a past program": next year's retreat starts as this year's.

Plus **What we tell them**: the program's messages as one timeline (confirmation when they register, a reminder before, any notice, an optional note after), so the order and timing are visible at a glance.

## What stays exactly as it is

Every field of today's editor stays, regrouped (see the mockup's last panel). The public program page, the registration form's flow and dana step, Stripe and receipts, the Zoom door and who it admits, My Home's Today, This Week, Programs & Events, the Scheduler and its rotations, coverage notices, Flodesk segments, reminders, and the Program Manager and Registration roles all keep working as they do.

## What changes in the data (for the build, later)

- **Questions get an identity and an asker.** Each item in `Program.registrationFields` gains a stable `id` and `askedBy` (`registration`, `teacher`, or a team's slug). Answers in `Registration.customFields` are keyed by `id`, not the question's wording. Existing questions become `askedBy: registration`; existing answers are re-keyed once.
- **Teams that prepare.** Today a supporting team must use the Scheduler (`supportingTeamRefusal`). A kitchen prepares rather than staffs, so a program's helpers need one more kind: either a flag on `ProgramCoverageHub` (`schedules: false`) or a small `program_helpers` table. Plus a per-helper "can reach people" flag.
- **History and notes.** A registration history (who did what, when) and notes with an author, a date and "for the teacher".
- **Reminders by days before** (`reminderDaysBefore`), keeping `reminderDate` as an optional fixed day.
- **Copy a program**: a new action. **Starting shapes**: defaults in code, keyed by the existing Format field. **First time at RIM**: derived from registrations, no new field.

## Decided, and waiting

- **Teachers can reach people** by email and phone (Jesse, 2026-10-23).
- **Dana amounts are private** (Jesse, 2026-10-23): how much someone gave is seen only by the Registrar, Guiding Teacher and Admin roles, as it is today (the roster is gated by `canUseProgramManager`; the support@ notice carries only "finished or not"). The rule follows the role, not team membership: anyone else helping in Registration sees whether dana is finished, never the amount. Helpers' pages never show dana, the teacher's page included, even when the guiding teacher opens it; amounts live only in Registration.
- **"Dietary needs"**, not "the kitchen", heads those questions on the form and the team's page (Jesse, 2026-10-23).
- **Waiting until the first version is in use** (recommended 2026-10-23): a teacher adding or sending questions of their own after registration, and helpers writing comments on people. Today a teacher's questions are set with the program and the teacher can now email people directly; notes on people stay with the registration team, which can write one "for the teacher too". If a need shows up in practice, the safe first step is a helper writing a note *to the registration team* about a person, not a comment other helpers read.
- **Still open:** should the teacher see the people waiting, or only those with a place?
