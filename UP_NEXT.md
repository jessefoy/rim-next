# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Editor architecture rebuild (session 87, 2026-04-17)

Jesse just finished a multi-stage rebuild of the rich-text editor system. Foundation is in place and pushed. Remaining work is verification + small follow-ons.

### What was built and is now live
- **FormatPill + Element Registry** (`lib/editorRegistry.ts`) — single source of truth for every insertable or convertible block. Pill's `+` menu, slash menu, and block-handle "Turn into" all read from it.
- **Scope modifier system** — every editor output wrapper now carries three classes: `rim-content rim-content--{scope} {context-class}`. The scope modifier (`--document` / `--lesson` / `--program`) lets a shared `.rim-el-*` element library render three visual treatments without duplicating class trees. Wired on every render callsite (lessons, programs, course, hub documents, manual, editor lab, account program detail, manual editor preview).
- **Callouts reduced to Note + Decision** — the old six-variant picker is gone. Legacy variants (`info`, `warning`, `practice`, `reflection` as variant string) still deserialize for archived content.
- **Five distinct dharma elements** — `pullQuote`, `verseQuote`, `practiceSuggestion` (container), `reflection` (container), `callout` (container, Note/Decision variants). Each has its own visual vocabulary rather than being a variant of one box. All scoped to `[lesson, program-description]`.
- **Defensive container-body seeding** — `RimBlockEditor` runs `migrateLegacyContainers` on load: strips stray `content` fields from `"none"`-content blocks, migrates legacy inline content into a paragraph child, and seeds an empty paragraph onto any container with no children. Without the seed, BlockNote emits no `blockGroup` sibling and the container renders as uneditable chrome. This was the root cause of the "green box you can't edit" bug Jesse hit.

### Open at session close
1. **Stale-CSS issue in Jesse's browser.** Element inspection on the rendered Practice Suggestion showed the correct HTML (`div.rim-el-practice` with `__header`/`__body` children, inside `.lp-body.rim-content.rim-content--lesson`) but the Styles panel showed no `.rim-el-practice` rule matching — only `.lp-body` and `.rim-content`. Box Model read zero margin. The CSS at `public/css/custom.css:21055` is committed and served. This is almost certainly stale CSS in Safari's cache. **First thing to check next session: did a hard reload / empty cache resolve the box rendering?**
2. **Visual verification across scopes.** Once the box renders, Jesse needs to confirm the three scope treatments (document / lesson / program) feel right. If the `#edf5f3` Practice background reads too subtly against the page `#f5f5f5`, strengthen the bg (e.g. `#e3efe9`) — but only if the CSS is confirmed loaded first.
3. **Reflection + Pull Quote bodies.** Same verification question — are they editable after reload, do edits persist through save → reload → render?

### Queued follow-ons (from backlog)
- `2026-04-17-003` — Migrate Program `specialNotes` field into an inline Note block inside the description body, then drop the separate field. Jesse's observation: now that Note is a first-class editorial element, the separate "Special notes" section is redundant.
- (Consider) expose Pull Quote / Verse Quote to `program-description` only if they read well there — currently scoped to `[lesson, program-description]` in the registry.

### Key files to reference
- `lib/editorRegistry.ts` — registry + context allowlists
- `lib/blockNoteCustomBlocks.tsx` — factories for all five dharma elements; exports `CONTAINER_BLOCK_TYPES`
- `components/RimBlockEditor.tsx` — `migrateLegacyContainers`, pill wiring
- `components/editor/FormatPill.tsx` — insert seeding, turn-into, selection pill
- `lib/renderRichContent.ts` — HTML output for each element; `CONTAINER_TYPES` for child grouping
- `public/css/custom.css` lines ~20800–21500 — editor view (`bn-*`) + rendered output (`rim-el-*`) + scope overrides
- `RIM_Editor_Design.md` — full contract (tiers, element registry rules, three-class wrapper, custom block conventions)

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
