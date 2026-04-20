# Editor Audit — Sweep 4: Admin Tools (Four-Type Framing)

**Status:** Draft. Review with Jesse, then freeze and move to Sweep 5 (public content).
**Source:** `app/admin/**`, `app/tools/**`, and the admin-side components (`registrar/ProgramEditor`, `LessonEditor`, `CourseEditor`, `SupportInboxClient`, `SupportSettingsClient`, `ManualSectionEditor`, `EmailTemplateEditor`, `AdminNotesSection`, `HouseholdDetail`, `TeacherSection`, `VolunteerTable`) as of session 89.
**Reference:** `RIM_Editor_Types.md` (canonical).

---

## Admin tool inventory by area

### Program Editor (`/tools/programs/[slug]/edit`)

Used by registrars to create and edit programs. Main tool for the registration-heavy work.

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `Program.name`, `slug`, `tagline`, `categoryId`, schedule / recurrence fields, `programImage`, location, capacity, dana settings, teacher links | plain / select / date / number | Template data | All correct |
| `Program.description` | `RimBlockEditor` context="program-description" | **Page Designer** | The main editor. Will absorb the sunset fields below as blocks. |
| `Program.specialNotes` | `RimProseEditor` | **Sunset → Special Note block** | Renders on public program page in separate `.pg-notes` slot. Becomes a block inside description in Stage 2d. |
| `Program.specialAnnouncement` | `<textarea>` plain (line 1610) | **Sunset → Announcement block** | Currently plain text. Becomes a block. |
| `Program.earlyArrivalMessage` | `<textarea>` plain (line 1633) | **Sunset → Early Arrival block** | Currently plain text. Becomes a block. |
| `Program.pullQuote`, `pullQuoteSource` | `<input>` plain (line 1647) | **Sunset → Pull Quote block** | Becomes a Pull Quote block inside description. |
| `Program.confirmationMessage` | `RimProseEditor` | **Message** | Used in email + on-screen after registration. Kept as a Message field. |
| `Program.reminderMessage` | `RimProseEditor` | **Message** | Email only. Kept as a Message field. |
| `Program.danaMessage` | `RimProseEditor` | **Message** (email) + **Sunset → Dana Invitation block** (on-page) | Split: email stays Message; on-page rendering becomes a block. Decision documented in Sweep 1. |

**Recommendation:** Program editor is the biggest consumer of Page Designer migration work. Stage 2d is the largest batch here.

---

### Lesson Editor (`/tools/learning/lessons/[slug]`)

Used by teachers to author lessons.

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `Lesson.titleInternal`, `titleDisplayed`, `slug`, `accessLevel`, hero image, audio, video, duration, release settings | plain / select / URL | Template data | |
| `Lesson.body` | `RimBlockEditor` context="lesson" | **Page Designer** | Main editor. Will absorb sunset fields. |
| `Lesson.headerQuote`, `quoteSource` | `<input>` plain | **Sunset → Pull Quote or Verse Quote block** | Author chooses which block on migration. |
| `Lesson.reflectionPrompt` | `<textarea>` plain | **Sunset → Reflection block** | Verify the existing Reflection block fits; may need a prompt-only variant. |
| `Lesson.resources` | structured list UI | Template data or potential future block | Flagged in Sweep 1 as discussion candidate. Keep as-is for now. |
| `ReflectionQuestion.body` | `RimProseEditor` minimal | **Form Field** | Question text, inline-only formatting. |
| `ReflectionOption.text` | `<input>` plain | Template data | Answer option text. |

**Recommendation:** Like Program Editor, Lesson Editor gets a Stage 2d migration batch. Three sunsets: `headerQuote`/`quoteSource` → Quote block, `reflectionPrompt` → Reflection block.

---

### Course Editor (`/tools/learning/[slug]`)

Used by teachers to author series/course metadata (which lessons, what order, what access level).

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `Course.title`, `slug`, `subheading`, access settings, drip settings, category | plain / select | Template data | |
| `Course.description` | `RimProseEditor` | **Message** | Short descriptive prose. Correct. |
| `Course.completionNote` | `<textarea>` plain | **Promote to Message** | From Sweep 1 Section E. |
| `CourseLesson.groupLabel` | `<input>` plain | Template data | Section header for lesson groupings. |

**Recommendation:** One promotion (`completionNote` → Message). Otherwise correct.

---

### Member Profile (`/admin/members/[id]`)

Sections composing the member admin view: `CoreRecordSection`, `TeacherSection`, `RegistrationHistorySection`, `RolesSection`, `AdminNotesSection`, `DangerZoneSection`.

| Section | Field | Editor | Four-type | Notes |
|---|---|---|---|---|
| AdminNotesSection | `User.adminNotes` | `RimProseEditor` | **Message** | Correct. |
| TeacherSection | `TeacherProfile.bio` | `<textarea>` plain | **Promote to Message** | From Sweep 1. Public teacher bio. |
| TeacherSection | `TeacherProfile.photoUrl`, `slug`, `isPublic` | plain / toggle | Template data | |
| CoreRecordSection | `User.firstName`, `lastName`, `preferredName`, `phone`, `title`, address | plain | Template data | |
| CoreRecordSection | `User.tags` | tag input | Template data | |
| RolesSection | `User.roles` | multi-select | Template data | |

**Recommendation:** One promotion (`TeacherProfile.bio` → Message).

---

### Household (`/admin/households/[id]`)

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `Household.name`, address, `HouseholdMember.relationshipType`, etc. | plain / select | Template data | |
| `Household.notes` | `RimProseEditor` | **Message** | Correct. |

**Recommendation:** Correct. No changes.

---

### Registrar / Volunteer Table (`/tools/programs/[slug]`)

Used by registrars to view and manage registrants for a program.

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `Registration.notes` | `RimProseEditor` inline | **Message** | Correct. |
| `Registration.firstName`, `lastName`, `email`, `phone`, `customFields`, `status`, donation fields | plain / structured | Template data | |

**Recommendation:** Correct.

---

### Support Inbox (`/tools/inbox`)

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| Compose editor (outgoing email to new contact) | `RimProseEditor` | **Message** (email-bound) | Will be distinguished as `support-reply` placement. |
| Reply editor (reply in existing thread) | `RimProseEditor` | **Message** (email-bound) | Same placement — `support-reply`. |
| Note editor (internal note on thread) | `RimProseEditor` | **Message** (internal) | Distinguish as `support-note` placement. |
| `SupportSignature.name`, `tagline`, `role` | plain | Template data | |

**Recommendation:** Three-way placement split (`support-reply`, `support-note`, `support-template`) lands in Stage 2b. Currently all three share one editor instance which is fine in code but needs registry disambiguation.

---

### Support Settings (`/tools/inbox/settings`)

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `SupportTemplate.name`, `subject` | plain | Template data | |
| `SupportTemplate.body` | `RimProseEditor` | **Message** (email-bound, `support-template` placement) | Working as designed. |
| Signature fields | plain | Template data | |

**Recommendation:** Correct after Stage 2b placement split.

---

### Manual (`/admin/manual/[slug]/edit`)

Used by Jesse + staff to author the internal staff manual — chapters documenting how RIM works, who does what, how to use the tools.

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `ManualSection.title`, `description`, `hubSlug`, `relations`, `order` | plain / select / tag | Template data | |
| `ManualSection.body` | `RimBlockEditor` context="manual" | **Document** | Working as designed. |

**Recommendation:** Correct. One of the two canonical Document-type placements (with `HubDocument.body`).

---

### Site Banner (`/admin/banner`)

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `SiteBanner.body` | `RimProseEditor` | **Message** | Correct. Short site-wide announcement. |
| `isActive` | toggle | Template data | |

**Recommendation:** Correct.

---

### Email Templates (`/admin/emails/[slug]`)

| Field | Editor | Four-type | Notes |
|---|---|---|---|
| `EmailTemplate.name`, `description`, `subject`, `helpText`, `sanityNote`, `slug`, `enabled`, variables, `group`, `minRole` | plain / select / tag | Template data | |
| `EmailTemplate.body` | `MarkdownEditor` | **Outlier** (Markdown) | Preserved until a BlockNote-to-email pipeline exists. |

**Recommendation:** Correct. Only editor outside the four-type model. Explicitly documented as outlier in `RIM_Editor_Types.md`.

---

### Admin Hubs (`/admin/hubs/[slug]/edit`)

Covered in Sweep 3 — Hub Admin Form.

---

### Editor Lab (`/admin/editor-lab`)

A verification surface. Not a tool that authors content into storage — a sandbox for testing block rendering. Out of scope for this audit; it reads the registry and renders test blocks.

---

## Drift caught in Sweep 4

No *new* drift beyond what Sweep 1 already flagged. Sweep 4 confirms from the tool side:

1. Program Editor has the most sunset fields (5+ fields absorbed into the Page Designer body via blocks in Stage 2d).
2. Lesson Editor has 2–3 sunsets (quote fields, reflection prompt).
3. Two plain → Message promotions: `TeacherProfile.bio`, `Course.completionNote`.
4. Support tool has three distinct placements sharing one editor instance (`support-reply`, `support-note`, `support-template`); registry split lands in Stage 2b.

---

## Summary

| Area | Correct | Promotions needed | Sunsets planned |
|---|---|---|---|
| Program Editor | description, messages | — | 5 fields → blocks |
| Lesson Editor | body, questions | — | 2–3 fields → blocks |
| Course Editor | description | 1 (`completionNote`) | — |
| Member Profile | adminNotes, core fields | 1 (`TeacherProfile.bio`) | — |
| Household | notes | — | — |
| Registrar | registration notes | — | — |
| Support Inbox | reply / note / compose | — | — *(placement split only)* |
| Support Settings | templates | — | — |
| Manual | body | — | — |
| Site Banner | body | — | — |
| Email Templates | body (outlier) | — | — |
| Hub Admin | covered in Sweep 3 | — | — |

**Net from Sweep 4:** No new findings. The admin tools are consistent with the four-type model once Stage 2 reconciliation runs.

---

## Open questions for Jesse

None from Sweep 4 specifically. All questions already surfaced in Sweeps 1–3. Moving to Sweep 5 unless you want to pause.

Next: Sweep 5 — Public-facing authored content (program pages, lesson pages, course pages, glossary, teacher profiles, volunteer positions, home, footer, nav content). The last sweep.
