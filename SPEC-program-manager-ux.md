# Spec: Program Manager UX Overhaul

**Before starting:** Run the opening prompt. Read `CLAUDE.md`, `RIM_Web_Design_Philosophy.md`, `RIM_Role_Design.md` (Registrar section), and the existing `ProgramEditor` component + `ProgramsTableClient` + `VolunteerTable` + all `pe-` CSS in `custom.css`. Produce the Connections Map before writing any code.

**Context:** A deep analysis of the Program Manager tool (`/tools/programs`) revealed several UX issues that affect LoriLee and future registrar volunteers. The tool works — the data model and API layer are solid — but the interface needs to better serve a volunteer who may have tech anxiety and who uses this tool as their primary workspace. Every change in this spec is governed by the panic-state design rules in `RIM_Web_Design_Philosophy.md`.

**Primary user:** LoriLee (Registrar). Assume baseline tech anxiety. Assume she won't read tooltips unless she's stuck. Assume she needs to feel confident, not managed.

**CSS prefix:** Continue using `pe-` for all Program Editor styles.

---

## 1. Unsaved Changes Warning (PRIORITY — SAFETY)

**Problem:** If LoriLee fills in multiple tabs of the program editor and accidentally navigates away, everything is lost silently. This directly violates "make random tapping survivable."

**Build:**
- Add a `hasUnsavedChanges` state that becomes `true` when any form field is modified from its loaded value
- Register a `beforeunload` event listener when `hasUnsavedChanges` is true — browser will show the native "You have unsaved changes" dialog on tab close, back button, or navigation
- Also intercept Next.js client-side navigation: when `hasUnsavedChanges` is true and the user clicks a nav link, show a plain-language confirmation: "You have unsaved changes. Leave without saving?" with two buttons: **"Stay on this page"** (primary, visually dominant) and "Leave without saving" (muted, secondary)
- The Save button should clear `hasUnsavedChanges` on successful save
- Do NOT use a dirty-check per field. A single boolean flipped on any `onChange` is sufficient.

---

## 2. Inline Help Text on Every Editor Field

**Problem:** The editor currently has labels but no explanations. LoriLee (or a future registrar) shouldn't have to guess what a field does, what happens when she fills it in, or what the consequences of leaving it blank are. The editor should teach as it goes.

**Approach:** Add a help line below every field label — a single sentence in plain language explaining what the field does and where it appears. Style these as `pe-help` — a muted, slightly smaller line (14px, `--rim-text-muted` color, `line-height: 1.5`) directly beneath the label and above the input. Not a tooltip. Not hidden. Always visible.

**Help text for every field** (write exactly this copy — adjust only if the field name doesn't match):

### Tab 1 — Content
| Field | Help text |
|---|---|
| Name | "The program title. This appears on the public site, in member dashboards, and in all emails." |
| Slug | "The URL path for this program (e.g. /programs/morning-sit). Changing this after the program is live will break existing links and host assignments." |
| Tagline | "A one-line description shown below the program name on the Programs page and in search results." |
| Program Image | "Shown on the public program page and in the Programs listing. Landscape format works best." |
| Description | "The full program description shown on the public program page. Write for someone who has never been to RIM." |
| Pull Quote | "An optional highlighted quote shown on the public program page — something that captures the spirit of this offering." |
| Pull Quote Source | "Who said the pull quote. Appears below the quote in smaller text." |
| Special Notes | "Temporary logistical notes shown on the public program page — things like room changes, schedule adjustments, or one-time notices. Remove when no longer relevant." |
| Teacher/Facilitators | "Search by name to link teachers to this program. Linked teachers automatically get host controls in virtual sessions." |

### Tab 2 — Schedule
| Field | Help text |
|---|---|
| Schedule Label | "How the schedule appears on the public site (e.g. 'Tuesdays, 7:00–8:30 PM'). Leave blank to auto-generate from the fields below." |
| Time Label | "The time display (e.g. '7:00–8:30 PM CT'). Shown on program cards and in confirmation emails." |
| Program Format | "In-person, virtual, or hybrid. This controls whether a LiveKit video room or a venue address is shown." |
| Venue | "Where the program takes place. 'At RIM' auto-fills the RIM address. 'Other' lets you enter a custom location." |
| Open Access | "Virtual/hybrid only. When enabled, generates a guest link that lets anyone join without registering or logging in. Good for drop-in sessions." |
| Start / End Date | "The date range for this program. For single-day events, set both to the same date." |
| Recurrence | "For repeating programs. Sets the pattern (weekly, daily, etc.) and how many times it occurs." |

### Tab 3 — Categories
| Field | Help text |
|---|---|
| Category | "Which section this program appears under on the public Programs & Events page. Programs without a category won't appear on that page." |

### Tab 4 — Registration
| Field | Help text |
|---|---|
| Registration enabled | "When checked, the public program page shows a registration form. When unchecked, visitors can read about the program but can't register." |
| Registration closed | "Manually closes registration. The page shows a 'Registration is closed' notice instead of the form." |
| Capacity | "Maximum number of registered participants. Leave blank for unlimited. When full, new registrations are automatically waitlisted." |
| Registration deadline | "Registration closes automatically after this date. Leave blank if there's no deadline." |
| Custom Questions | "Additional questions shown on the registration form. Answers appear in the registration detail view." |
| Confirmation Message | "Shown in the confirmation email after someone registers. Good for logistics like what to bring or how to prepare." |
| Reminder Date | "When set, a reminder email can be sent to all registered participants on or after this date." |
| Reminder Message | "The content of the reminder email. You'll send it manually from the registration detail page — it doesn't send automatically." |

### Tab 5 — Dana
| Field | Help text |
|---|---|
| Dana Mode | "How donations work for this program. 'Voluntary' lets people give any amount. 'Base + Dana' sets a minimum. 'Fixed' sets an exact amount. 'None' skips the donation step entirely." |
| Suggested Amount | "Voluntary mode: a suggested donation amount shown during registration. Participants can change it." |
| Base Amount | "Base + Dana mode: the minimum amount. Participants can add more on top of this." |
| Fixed Amount | "Fixed mode: the exact amount charged. Participants cannot change it." |
| Dana Step Message | "Shown during the donation step of registration. Use this to explain how dana supports RIM." |
| Program Page Dana Note | "Shown on the public program page near the registration form — a brief note about the dana model for this program." |

### Tab 6 — Dashboard
| Field | Help text |
|---|---|
| Special Announcement | "A bold notice shown on this program's dashboard card. Use for urgent or time-sensitive info like a schedule change." |
| Early Arrival Message | "A quieter message shown on the dashboard card — things like 'Please arrive 10 minutes early' or 'Bring a cushion.'" |
| Hide from dashboard | "When checked, this program won't appear on member dashboards at all. Use for programs that are public-facing only." |
| Day of Week | "Which days this program meets. Controls the 'Today' badge on dashboard cards and how programs are grouped." |

### Tab 7 — Visibility
| Field | Help text |
|---|---|
| Sort Order | "Controls the display order on the public Programs page. Lower numbers appear first." |
| Hide from Programs page | "When checked, this program won't appear on the public Programs & Events listing. It's still accessible by direct URL." |
| Hide from dashboard list | "When checked, this program won't appear in the member dashboard program list. Different from 'Hide from dashboard' above — this controls the list, not the card." |

**Important:** The help text is the spec. Do not shorten it, do not rephrase it to be more "technical," do not hide it behind a hover or click. These lines are always visible.

---

## 3. Tab Restructure — 7 Tabs → 4 Tabs

**Problem:** 7 tabs organized by data type doesn't match how LoriLee thinks about setting up a program. She thinks in terms of "what does this program need to be ready?" — not "which database category does this field belong to?"

**New structure (4 tabs):**

### Tab 1: "Program" (was Content + Categories)
Everything that defines what this program *is*:
- Name, Slug, Tagline
- Program Image
- Description
- Pull Quote + Source
- Special Notes
- Teacher/Facilitators
- Category (moved from old Tab 3)

### Tab 2: "Schedule & Registration" (was Schedule + Registration)
Everything about when, where, and who can sign up:
- Program Format, Venue, Open Access
- Start/End Date, Recurrence
- Schedule Label, Time Label
- Registration enabled/closed
- Capacity
- Registration deadline
- Custom Questions
- Confirmation Message
- Reminder Date + Reminder Message

### Tab 3: "Dana & Messages" (was Dana + Dashboard)
Everything about money and communications:
- Dana Mode + amount fields + Dana Step Message + Program Page Dana Note
- Special Announcement
- Early Arrival Message

### Tab 4: "Display" (was Visibility + remaining Dashboard fields)
Everything about where and how this program appears:
- Sort Order
- Hide from Programs page
- Hide from dashboard / dashboard list
- Day of Week (drives dashboard grouping and Today badge)

**Implementation notes:**
- This is a tab label and content reorganization only. No data model changes. No API changes. Same fields, same save behavior.
- The Save button remains fixed at the bottom, visible from all tabs.
- If any current tab has its own sub-components or state management, consolidate carefully — test that field values persist across the new tab boundaries.

---

## 4. "Edit Program" Link from Registration Detail

**Problem:** LoriLee's most common flow is looking at registrations and then needing to adjust the program settings. Currently she has to navigate back to the list and find the program again.

**Build:** On the registration detail page (`/tools/programs/[slug]`), add an "Edit Program Settings →" link in the stat bar area (near the program name/heading). Style as a quiet text link (`--rim-mid` color, not a button) so it doesn't compete with the registration management actions. Links to `/tools/programs/[slug]/edit`.

---

## 5. Contextual Action Emphasis in Registration Rows

**Problem:** The expanded registration row shows up to 7 action buttons. For a volunteer in a reactive state, that's too many competing options. The panic-state rule says: one dominant action per state.

**Build:**
- **Waitlisted registrant:** "Promote to Registered" should be visually dominant — full-color button (`--rim-mid` background, white text), sized larger. All other actions should be styled as quiet text links or muted outline buttons.
- **Pending dana registrant:** "Send Dana Reminder" should be visually dominant. Same treatment.
- **Active/confirmed registrant with no flags:** No dominant action — all actions are equally quiet (muted text links or small outline buttons). The absence of urgency should feel calm.
- **Cancelled registrant:** "Restore" should be the dominant action. "Delete Record" should be muted and secondary.

**The pattern:** Derive the registration's "state" (waitlisted, dana-pending, active, cancelled) and conditionally style the primary action for that state. Do not change which actions are available — only their visual weight.

---

## 6. Bulk Reminder Preview

**Problem:** "Send to Remaining 5" doesn't tell LoriLee who those 5 are. She holds pastoral relationships with these people and needs to see the names before sending.

**Build:** Next to the "Send to Remaining N" button, add a small "Show names" toggle/link. When clicked, it expands an inline list of the N names (first + last) who will receive the reminder. No new API call needed — the registration data is already loaded on the page. Just filter to active registrants where `reminderSentAt` is null.

---

## 7. Typography & Spacing Audit

**Problem:** The editor needs to feel calm and readable, not dense and administrative. Run through the entire Program Editor and registration detail page and verify/enforce these standards:

**Editor form (all tabs):**
- Field labels: 14px, `font-weight: 600`, `--rim-text` color, `margin-bottom: 4px`
- Help text (new `pe-help` class): 14px, `font-weight: 400`, `--rim-text-muted` color, `line-height: 1.5`, `margin-bottom: 8px` (sits between label and input)
- Text inputs, textareas, selects: `16px` font-size minimum (already required for iOS), `padding: 10px 12px`, `border: 1px solid var(--rim-rule)`, `border-radius: 4px`
- Field groups: `margin-bottom: 24px` between fields (generous, not cramped)
- Tab labels: minimum `15px` font-size (per the 15px minimum-anywhere rule), `44px` touch target height on mobile
- Section dividers within tabs: use `24px` top margin + a muted `1px` rule (`--rim-rule`) only when separating conceptually distinct groups (e.g., between venue fields and date fields). Do not over-divide.
- RimBlockEditor and RimProseEditor instances: ensure they have at least `12px` padding inside the editing area and that the toolbar doesn't feel cramped

**Registration detail page (VolunteerTable):**
- Stat bar numbers: should be large enough to read at a glance — at least `20px` for the count numbers
- Expanded row text: `15px` minimum for all content
- Action buttons in expanded rows: `44px` minimum touch target, adequate spacing between buttons so they can't be accidentally tapped together — at least `12px` gap
- Internal notes editor: `24px` padding inside the editing area, no visible border on the editor container (the content area is the focus, not the frame)

**Mobile (430px breakpoint):**
- Tabs should scroll horizontally (as they do now — confirm this still works with 4 tabs)
- All form fields stack full-width
- Save button full-width, `48px` height
- Help text wraps naturally — confirm it doesn't get clipped or hidden

---

## 8. Clean Up Overlapping Fields

**Problem:** Two "hide from dashboard" concepts exist in different places and are confusing.

**Audit and resolve:**
- "Hide from member dashboard" (currently Dashboard tab) and "Hide from member dashboard program list" (currently Visibility tab) — are these actually different behaviors? If yes, the help text must make the distinction crystal clear. If they're functionally the same or nearly the same, consolidate into one field.
- The `teacherFacilitatorsText` field (old comma-separated text input) — confirm it's fully removed from the editor UI. If it's still in the data model but not rendered, that's fine. If it's still rendered anywhere, remove it.

---

## 9. Manual Section for Program Manager

**Problem:** The Program Manager is the most complex tool in the system and has no manual section. LoriLee should be able to read a plain-language guide.

**Build a new ManualSection** (via the seeding script or direct DB insert) with these chapters:

**Title:** "Program Manager"

**Sections:**
1. **Getting there** — How to open the Program Manager from the Registrar Hub sidebar or directly.
2. **The program list** — What the filter pills mean. What "Needs attention" flags. How to search, archive, restore.
3. **Creating a program** — Walk through each tab (use the new 4-tab names). What's required vs. optional. What happens when you save.
4. **Editing a program** — How to get to the editor. The slug warning. What changes affect the public page immediately.
5. **Managing registrations** — The stat bar. Promoting from waitlist. Handling pending dana. Sending reminders (individual and bulk). Cancelling and restoring. Editing custom field responses. Internal notes.
6. **Common situations** — "A spot just opened and people are waitlisted." "Someone wants to change their registration." "A program is full — what do I do?" "Sending reminders before a program starts." "Someone can't afford the dana amount."
7. **Categories** — How they affect the public Programs page. How to reorder them.

**Tone:** Conversational, direct, LoriLee-friendly. Not technical documentation. Written as if you're sitting next to her walking her through it.

---

## Closing notes

- This spec does NOT change any data models, API routes, or database schema
- This spec does NOT change any public-facing pages
- All changes are within the `/tools/programs` routes and the `pe-` CSS block
- Run the closing prompt when done — update session log, FEATURES.md (Section 37 or wherever Program Manager is documented), and the manual
