# Editor Audit — Sweep 1: Prisma Schema (Four-Type Framing)

**Status:** Revised to four-type model. Review with Jesse, then freeze and move to Sweep 2 (Sanity).
**Source:** `prisma/schema.prisma` at session 89 (2026-04-20).
**Reference:** `RIM_Editor_Types.md` (canonical) — the four types (Document, Page Designer, Message, Form Field), template vs. content distinction, output destinations.

Each authored-content field is classified as one of:

- **Document** — standalone sophisticated document
- **Page Designer** — composed from design blocks inside a page template
- **Message** — general communication
- **Form Field** — inline-only rich input
- **Template data** — structured field, stays as a field, not an editor surface *(mentioned for completeness where relevant)*
- **Sunset → Block** — field goes away; its content becomes a block inside a Page Designer editor elsewhere
- **Sunset → Delete** — field is abandoned; schema + data are removed
- **Outlier** — MarkdownEditor (email templates only)

---

## A. Document type

| Field | Component | Output destination | Output wrapper | Notes |
|---|---|---|---|---|
| `HubDocument.body` | `HubDocumentEditor` | Interactive web | `rim-content hdoc-body` | Working as designed. |
| `ManualSection.body` | `ManualSectionEditor` | Web template | `rim-content man-body` | Working as designed. |
| `Hub.welcomeBody` | `HubAdminForm` (drift — currently uses wrong engine) | Web template | `rim-content hdoc-body` (target) | **Drift to fix in Stage 2b.** Currently wired to Message-type engine; should be Document. |
| `Hub.homeContent` | `HubAdminForm` (drift — currently uses wrong engine) | Web template | `rim-content hdoc-body` (target) | **Drift to fix in Stage 2b.** Same issue as welcomeBody. |

---

## B. Page Designer type

| Field | Component | Output destination | Output wrapper | Notes |
|---|---|---|---|---|
| `Program.description` | `ProgramEditor` (Content tab) | Web template | `rim-content rim-content--program prog-description` | The author's main writing surface for a program. Will absorb blocks that replace several sunset fields (see Section F). |
| `Lesson.body` | `LessonEditor` | Web template | `rim-content rim-content--lesson lp-body` | The author's main writing surface for a lesson. Will absorb blocks that replace `headerQuote`, `quoteSource`, `reflectionPrompt`. |

These are the only two Page Designer placements today. The pattern will extend to glossary entries and any future templated-page surface where authored content needs design blocks.

---

## C. Message type

| Field | Component | Output destination | Output wrapper | Notes |
|---|---|---|---|---|
| `User.adminNotes` | `AdminNotesSection` | Interactive web | inline (no wrapper) | Internal staff notes. |
| `Household.notes` | `HouseholdDetail` | Interactive web | inline (no wrapper) | Internal staff notes. |
| `Registration.notes` | `registrar/VolunteerTable` | Interactive web | inline row | Volunteer staff notes on a registration. |
| `Course.description` | `CourseEditor` | Web template | `rim-content crs-desc` | Series-level description on course page. |
| `LessonNote.body` | `LessonNoteEditor` | Interactive web | `rim-content ls-notes-body` | Member's personal reflection space. |
| `HubConversationThread.body` | `HubConvClient` | Interactive web | `rim-content hub-conv-post__body` | Thread opening post. |
| `HubConversationReply.body` | `HubConvThreadClient` | Interactive web | `rim-content hub-conv-post__body` | Replies. |
| `Task.body` | `HubTasksClient` | Interactive web | `rim-content tsk-body` | Task description. |
| `Subtask.body` | `HubTasksClient` | Interactive web | `rim-content tsk-body` | Subtask description. |
| `SiteBanner.body` | `app/admin/banner/page.tsx` | Web template | `rim-content ban-body` | Site-wide announcement strip. |
| `SupportNote.body` | `SupportInboxClient` | Interactive web | inline | Internal staff note on a support thread. |
| `SupportTemplate.body` | `SupportSettingsClient` | Reusable into email | inline in editor | Saved reply template. Feature-parity with outgoing reply (both email-bound). |
| `SupportThread.body` (live reply draft) | `SupportInboxClient` | Transactional email | email HTML | Not a schema field — client-state reply before sending. Email-safe Message output. |
| `Program.confirmationMessage` | `ProgramEditor` | Interactive web + transactional email | `pg-*` / email | Shown after registration and in confirmation email. |
| `Program.reminderMessage` | `ProgramEditor` | Transactional email | email | Sent a few days before program. |
| `Program.danaMessage` | `ProgramEditor` | Web template + transactional email | `pg-dana__message` / email | **See note in Section F** — the page-rendering of this message is a candidate to become a Page Designer block (*Dana Invitation*). The email version stays Message. |
| `SubRequest.message` | `HubScheduleClient` | Interactive web + transactional email | inline + email | Host's context when requesting a sub. |
| `SubClaim.message` | *(not yet editable anywhere — field is live, UI to be built)* | Transactional email | email | Claimer's optional message back to original host, embedded in the sub-claimed email. Needs a UI when the claim flow is implemented. |

---

## D. Form Field type

| Field | Component | Output destination | Output wrapper | Notes |
|---|---|---|---|---|
| `ReflectionQuestion.body` | `LessonEditor` (question body field) | Web template | `ls-question__text` inline | Short question text with bold/italic/link only. |

---

## E. Plain fields being promoted to Message type

These are `String` / `String?` today and should become rich `Message` editors. Promotion happens in Stage 2 (likely 2b or 2d depending on coupling).

| Field | Current UI | Target type | Target placement | Why |
|---|---|---|---|---|
| `TeacherProfile.bio` | plain textarea | Message | `/teachers/[slug]` profile page | Bios need paragraph breaks and emphasis. |
| `Course.completionNote` | plain textarea | Message | Displayed when member completes a series | Closing message often wants a paragraph + link. |

Other plain fields I considered and rejected (stay plain): `HostAssignment.notes`, `AttendanceRecord.notes` (short admin notes — textarea is fine), `Program.pullQuote`, `Lesson.headerQuote` (single-line quotes — plain input is correct, and these will migrate into blocks anyway).

---

## F. Sunset → Block (fields absorbed into Page Designer editors)

These fields currently exist as separate top-level fields because the old Webflow-era template model couldn't embed authored design. With the Page Designer, they become **blocks** inside the main description/body editor. Author decides placement inline; template stops rendering separate slots.

### On `Program` → absorbed into `Program.description` (Page Designer)

| Sunset field | Current type | Becomes block | Notes |
|---|---|---|---|
| `Program.specialNotes` | Json? (RimProseEditor) | **Special Note** block | Currently rendered in a separate `.pg-notes` slot on program page. Becomes a Note block inserted inline wherever the author wants it. |
| `Program.specialAnnouncement` | String? (plain textarea) | **Announcement** block | Currently rendered as plain text. Becomes a visual announcement block. |
| `Program.earlyArrivalMessage` | String? (plain textarea) | **Early Arrival** block (or practical-info block) | Currently plain text. Practical info benefits from a styled container. |
| `Program.pullQuote` + `Program.pullQuoteSource` | String? + String? | **Pull Quote** block (already exists) | The existing Pull Quote block covers this. Migrate data into a Pull Quote block inside the description. |
| `Program.danaMessage` *(web page rendering only)* | Json? (RimProseEditor) | **Dana Invitation** block | The on-page version becomes a block. The email-sent version stays a Message-type field (see Section C). |

### On `Lesson` → absorbed into `Lesson.body` (Page Designer)

| Sunset field | Current type | Becomes block | Notes |
|---|---|---|---|
| `Lesson.headerQuote` + `Lesson.quoteSource` | String? + String? | **Pull Quote** or **Verse Quote** block (author chooses) | The existing quote blocks cover this. Migrate data into a quote block at the top of the lesson body. |
| `Lesson.reflectionPrompt` | String? (plain textarea) | **Reflection** block (already exists, may need a prompt variant) | Existing Reflection block was designed for dharma content; verify it fits this use or tune it. |

### Fields that might migrate but need discussion

| Field | Consideration |
|---|---|
| `Lesson.resources` | Structured JSON `[{name, url, resourceType}]` currently rendered in a "Resources" section. Could become a **Resources** block (list of links). Would simplify the template. Worth discussing — possible Stage 2d task. |
| `Program.confirmationMessage` / `reminderMessage` | These are authored to be sent as email. They could have a *companion* Page Designer block for on-page display after registration, but the email-sent body stays as a Message field. Not a sunset — leave as-is. |

---

## G. Sunset → Delete (abandoned session module)

These get deleted in Stage 2c. Confirmed with Jesse in session 89: the post-session debrief flow was abandoned and will be rebuilt fresh if/when needed. Site isn't live, so no real data to preserve.

| Table / Enum | What it held | Why delete |
|---|---|---|
| `SessionAttendance` | Records of members joining live sessions, with post-session flags (`flaggedByHost`, `postSessionNote`, `postSessionAction`, `actionRouted`). | Abandoned debrief module. |
| `SessionReport` | Host reflection + optional shared resource, one per session. | Abandoned debrief module. |
| `SessionCoHost` | Self-marked co-host records for a session. | Abandoned debrief module. |
| `SessionCoHostReport` | Co-host's reflection submitted after a session. | Abandoned debrief module. |
| `PostSessionAction` enum | `NONE` / `GENTLE_FOLLOWUP` / `JESSE_ONLY` / `TECHNICAL_ISSUE` | No longer referenced after deletions above. |

**Not deleted (live features):**
- `HostAssignment`, `SubRequest`, `SubClaim` — the hosting/claiming/assignment flow.
- `Alert` types `SUB_REQUEST`, `SUB_CLAIMED`, `UNASSIGNED_SESSION` — these feed live notifications.

Stage 2c will confirm the exact cascade (any API routes, any frontend components that touch the deleted tables get removed or adjusted) before anything is dropped.

---

## H. Outlier

| Field | Editor | Output |
|---|---|---|
| `EmailTemplate.body` | `MarkdownEditor` (Tiptap + markdown) | Transactional email HTML (via `marked` → `juice`) |

Kept outside the four-type model per `RIM_Editor_Types.md`. Until a BlockNote-to-email-safe-HTML renderer exists, email template authoring stays on Markdown.

---

## I. Template data — structured fields (not editor surfaces)

Listed for completeness. These stay as fields and are rendered by page templates. Not classified further because they aren't authored prose.

- **Identifiers:** all `id`, `slug`, `*Id` relational fields, enum columns (`Role`, `MemberStatus`, `HubType`, etc.)
- **Names:** `User.firstName`, `lastName`, `preferredName`, `title`; `Household.name`; `Program.name`, `tagline`; `Lesson.titleInternal`, `titleDisplayed`; `Hub.name`, `welcomeHeadline`, `description`; `Course.title`, `subheading`; etc.
- **Structured content:** `Program.dateText`, `timeText`, `startDatetime`, `endDatetime`, `recurrenceFreq`, `recurrenceDays`, `recurrenceInterval`, `recurrenceCount`, `dayOfWeek`, `programFormat`, `venue`, `locationText`, `locationLink`, `zoomLink`, `livekitRoom`, `meetHostAccount`, `calendarEventId`, `programImage`; `Program.registrationEnabled`, `registrationClosed`, `registrationCapacity`, `registrationDeadline`, `registrationFields`, `danaMode`, `suggestedDana`, `danaBaseAmount`, `danaFixedAmount`, `danaText`; `Lesson.heroImageUrl`, `heroImageAlt`, `audioUrl`, `videoUrl`, `resources`, `releaseDate`, `releaseDelayDays`, `durationMinutes`, `questionsRequired`; etc.
- **Addresses:** all `addressLine1`, `addressCity`, `addressState`, `addressZip` fields.
- **Tag / label arrays:** `User.tags`, `User.sectionGrants`, `Hub.documentCategories`, `Hub.conversationCategories`, `ManualSection.relations`, `EmailTemplate.variables`, `Program.teacherFacilitators` (legacy — `ProgramTeacher` join table replaces this).
- **Synced / read-only:** `SupportMessage.bodyHtml`, `bodyText`, `attachments` (from Gmail API); `AppSetting.value` (key-value).
- **Very short plain-text notes that stay plain:** `HostAssignment.notes`, `AttendanceRecord.notes`, `SessionReport.resourceNote` *(moot — SessionReport is deleting)*.

---

## Summary

- **4 Document-type fields** (2 working, 2 with wrong-engine drift)
- **2 Page Designer-type fields** (`Program.description`, `Lesson.body`) — the two placements where authored design blocks live
- **18 Message-type fields** across the platform — the most common editor by far
- **1 Form Field-type field** (`ReflectionQuestion.body`)
- **2 plain fields to promote** to Message (`TeacherProfile.bio`, `Course.completionNote`)
- **9 fields to sunset into blocks** (5 on Program, 2 pairs + 1 on Lesson)
- **5 schema objects to delete** (abandoned session module)
- **1 outlier** (`EmailTemplate.body` on MarkdownEditor)

Every authored-content field in Postgres is now placed in the four-type model. Nothing is unclassified.

---

## Open items for Jesse (review before Sweep 2)

1. **Block names in Section F** — I used working names like *Special Note*, *Announcement*, *Early Arrival*, *Dana Invitation*. These are placeholders. You'll want to name them when they get built (Stage 2d). Any you already have names for?
2. **`Program.danaMessage`** — I split it: the on-page rendering becomes a *Dana Invitation* block, the email version stays a Message field. Confirm this split is what you want, or should the email also reference the block content somehow?
3. **`Lesson.resources`** — possible Page Designer block candidate (flagged in Section F "needs discussion"). Stage 2d decision, not now.
4. **`SubClaim.message`** — listed as "UI to be built." Should I flag that as a follow-on feature in the backlog, or is it already covered?

Next: Sweep 2 — Sanity schemas. Same four-type framing.
