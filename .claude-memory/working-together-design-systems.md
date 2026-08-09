---
name: How Jesse and Claude work on design-system-level decisions
description: The durable pattern for establishing and preserving design best practices across sessions — project docs as shared memory, memory files as Claude's working standards, CLAUDE.md as the gate, code as the enforcer
type: feedback
originSessionId: 6e92db7e-914c-41c8-a560-795cfcd2d595
---
Jesse and Claude work on RIM as co-creators of a design system, not as executor and task-runner. For this relationship to hold across sessions — weeks, months, or a year later — design best practices and system decisions must persist in places both of us can read.

**Three layers of persistence, each with a different job:**

1. **Project documents** (`RIM_*.md` in the repo) are the shared memory. They describe how the system works, what decisions have been made, and what the contract is. When code and a project document disagree, the code is wrong. These are versioned, searchable, and visible to both Jesse and Claude. This is where design decisions live.

2. **Claude's memory files** (`~/.claude/projects/.../memory/`) are Claude's working standards for how to collaborate with Jesse — his communication style, his engagement expectations, his design instincts, his preferences about when to pause for alignment. Jesse doesn't read these directly; they shape how Claude shows up. Do not put project design decisions here — those belong in project documents.

3. **`CLAUDE.md`** is the gate that forces Claude to consult the right project document before doing work in a given subsystem. The Design Orientation table maps task type → required reading. The Closing Ritual requires updating project documents when the code changes. These two checkpoints are what keep the project documents from drifting.

**Code-level gates are stronger than any of the above.** Where feasible, design decisions should be enforced at the code level (a wrapper component that refuses to mount without a registered placement, a type-level constraint that blocks an unregistered block type). Discipline is fragile; a compiler error is durable. Always propose the code-level gate as the terminal state when a subsystem is being reorganized.

**Why this matters:** in session 89, Jesse and Claude spent significant time reorganizing the editor system — four canonical types, template vs. content distinction, a block library with a creation procedure. Jesse explicitly asked how this would survive to future conversations. The answer is that the canonical reference (`RIM_Editor_Types.md`) lives in the repo, `CLAUDE.md` forces Claude to read it before any editor work, the Closing Ritual forces updates when editor code changes, and a future `<EditorField>` wrapper will make the registry a compile-time gate rather than a polite request. This four-layer approach is the pattern for any subsystem-level design work with Jesse.

**How to apply:**
- When starting subsystem-level design work with Jesse, establish a canonical project document first (not an inventory, not a catalog — the canonical reference).
- Add a row to the `CLAUDE.md` Design Orientation table pointing to the new canonical document.
- Add a line to the `CLAUDE.md` Closing Ritual requiring updates to the canonical document when the subsystem's code changes.
- Propose a code-level gate as the terminal state of reconciliation, even if it's not built immediately.
- Save a memory file like this one describing the collaboration pattern (how this subsystem was reorganized) — not the design itself (which lives in the canonical doc).
