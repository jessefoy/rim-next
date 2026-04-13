# Spec: Documentation Reset & Verification

**Context:** A review of the project documentation revealed that session 80's memory file changes never landed, the session log is 65+ sessions behind, and several files reference structures that don't exist. This spec brings everything into alignment.

**Important:** Read `CLAUDE.md` first — the Session Opening (including the new Connections Map requirement) and Closing Ritual sections have been updated. Those are now the standard.

---

## 1. Verify git status

Run these and report what you find:

```bash
git log --oneline -15
git status
```

Confirm whether session 80's commit (the one that claimed to create memory files and update MEMORY.md) actually landed. If uncommitted changes exist, report them before doing anything else.

## 2. Remove ghost references

The closing ritual in CLAUDE.md previously referenced `memory/MEMORY.md` and memory files (`feature-interconnections.md`, etc.). Those references have been removed from the closing ritual. Check the rest of CLAUDE.md for any remaining references to:

- `memory/MEMORY.md`
- `memory/` directory
- `design-principles.md` (as a memory file)
- `user-jesse.md` (as a memory file)
- `feature-interconnections.md` (as a memory file)
- `feedback-engagement.md` (as a memory file)

Remove any references you find. These files were never created. Do not recreate them — the existing reference documents serve the same purpose.

## 3. Session log — acknowledge the gap

The session log (`session-log.md`) has entries for sessions through ~session 55. Sessions 56–80+ are not recorded. We cannot reconstruct those sessions.

Add a single note at the top of the session log:

```markdown
> **Note:** Sessions 56–79 were not logged due to the closing ritual falling out of practice. 
> The session log resumes with session 80+. The closing ritual has been reinstated 
> in CLAUDE.md — see "Closing Ritual" section.
```

Then add a session log entry for THIS session documenting what was done (the documentation reset work).

## 4. Pages inventory decision

The `pages-inventory.md` file tracks CSS migration status but is stale — it doesn't reflect the dozens of routes added since session 55 (hubs, tools, learning system, LiveKit, etc.). 

Add a note at the top of `pages-inventory.md`:

```markdown
> **Scope note:** This file tracks CSS migration from Webflow classes to the design system 
> for pages that existed before the hub/tools build-out. It is NOT a complete route inventory. 
> For the full site map, see `/admin/sitemap`.
```

Do not try to expand it to cover all routes — the admin sitemap page is the authoritative route inventory.

## 5. Commit and push

Commit all changes from this spec together:

```
git add -A
git commit -m "Documentation reset: rituals updated, ghost refs removed, session log gap noted"
git push
```

## 6. Report back

After completing all steps, tell Jesse:
- What the git log showed (did session 80 land?)
- What ghost references were found and removed
- Confirmation that CLAUDE.md, session-log.md, and pages-inventory.md are updated
- Any other issues discovered

---

**Do not** build any new features. **Do not** create memory files. This is a documentation-only session.
