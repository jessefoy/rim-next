# Prompt: Revert Tab Restructure Only — Protect Everything Else

Read this entire prompt before doing anything.

## What happened

Item 3 from SPEC-program-manager-ux.md restructured the Program Editor from 7 tabs to 4. That was a mistake. The original 7 tabs were the right design — each tab was bite-sized and focused, which is better for a volunteer with tech anxiety. The restructure made things harder to find, not easier.

## What must be preserved

ALL of the other 8 items from the spec are correct and must survive:

1. **Unsaved changes warning** — `beforeunload` + in-app navigation dialog. KEEP.
2. **Help text on every field** — `pe-field__help` spans with exact spec copy. KEEP — but the text will need to be placed into the restored 7-tab structure.
3. ~~Tab restructure~~ — REVERT THIS.
4. **"Edit Program Settings →" link** on registration detail page. KEEP.
5. **Contextual action emphasis** — `vol-action-btn--dominant` class. KEEP.
6. **Bulk reminder "Show names" toggle**. KEEP.
7. **Typography and spacing audit** — all pe- and vol- CSS changes. KEEP.
8. **hideFromDashboard removed from UI**, surviving field help text updated. KEEP.
9. **Manual section** for Program Manager. KEEP.

## Step 1: Understand what the original 7 tabs contained

Before changing anything, use `git log` and `git diff` to find the state of `ProgramEditor.tsx` BEFORE today's session. Specifically, find the commit immediately before your first change to ProgramEditor.

The original 7 tabs were:

| Tab | Name | Contents |
|-----|------|----------|
| 1 | Content | Name, Slug, Tagline, Program Image, Description, Pull Quote + Source, Special Notes, Teacher/Facilitators search |
| 2 | Schedule | Schedule Label, Time Label, Program Format, Venue, Open Access toggle, Start/End dates, Recurrence |
| 3 | Categories | Category dropdown selector AND an interactive category order management tool (up/down reorder arrows, add new category, delete category). This is NOT just a dropdown — it is a full interactive ordering interface. |
| 4 | Registration | Registration enabled/closed, Capacity, Registration deadline, Custom Questions builder, Confirmation Message, Reminder Date + Reminder Message |
| 5 | Dana | Dana Mode radio, conditional amount fields, Dana Step Message, Program Page Dana Note |
| 6 | Dashboard | Special Announcement, Early Arrival Message, Hide from dashboard checkbox, Day of Week checkboxes |
| 7 | Visibility | Sort Order, Hide from Programs page, Hide from dashboard list |

Verify this against the git history. If any field existed in the original tabs that is not listed above, note it — do not drop it.

## Step 2: Restore the 7-tab structure

Revert ONLY the tab restructure. The TABS array should go back to its original 7 entries. The JSX blocks for each tab should contain exactly the fields they originally contained — no more, no less.

Do NOT do a full git revert of the file. That would wipe out the help text, unsaved changes warning, typography fixes, and field cleanup from items 1, 2, 7, and 8. Instead, manually restore the tab array and move the field JSX blocks back to their original tabs.

## Step 3: Place help text into the restored structure

Every field should still have its `pe-field__help` span with the help text from the spec. When you move fields back to their original tabs, bring their help text with them. Verify that every field listed in the spec's help text table has its help line in the restored structure.

For item 8 (the hideFromDashboard cleanup): `hideFromDashboard` should remain removed from the Dashboard tab UI. The surviving field (`removeFromProgramList`) keeps its updated help text in the Visibility tab.

## Step 4: Verify before pushing

List all 7 tabs and every field in each one. Include the help text for each field. Present this to me so I can verify nothing is missing, nothing is in the wrong tab, and all help text is present.

Do NOT push until I confirm.

## Step 5: After confirmation

Commit with message: "Revert tab restructure to original 7 tabs, preserve all other UX improvements"

Push, then run the closing prompt. In the session log entry, note that item 3 was reverted and why — the original 7-tab structure was the better design for the target user.

## Step 6: Update the Manual

The manual section (item 9) was written referencing the 4-tab structure. Update it to reference the correct 7 tabs. Walk through the "Creating a program" chapter and make sure it describes each of the 7 tabs by name with accurate content descriptions.
