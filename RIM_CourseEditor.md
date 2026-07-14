# RIM Course Manager

**Status:** Active per-tool engineering reference. Created session 162 (2026-07-13).

The Course Manager is the operational application for RIM's persistent learning offerings and lessons. Read this with `RIM_Offering_Model.md` and `RIM_Editor_Types.md`. A Course may stand alone or be unlocked by a live Program; its editor therefore connects the public landing page, member Library, lesson reader, enrollment/access, dana, and Program bundles.

---

## Routes and access

- `/tools/learning` — course index
- `/tools/learning/new` — create course
- `/tools/learning/[courseSlug]` — edit course
- `/tools/learning/lessons` — lesson index
- `/tools/learning/lessons/new` — create lesson
- `/tools/learning/lessons/[lessonSlug]` — edit lesson
- `/api/courses/*`, `/api/lessons/*`, and category/access routes — course and lesson operations

The layout gates with `hasToolAccess(userId, roles, ["TEACHER"], "learning")`: TEACHER, ADMIN, or an individual `UserToolAccess` grant. Course and lesson API routes must retain the corresponding tool gate; the layout is not the security boundary by itself.

## Hub context and shell

`app/tools/learning/layout.tsx` provides `ToolsProvider`, the Series/Lessons sub-navigation, and `WorkspaceShell`. A Course Hub launch carries `?hub=courses` and keeps the shared hub rail. Direct entry uses the tool header and returns to the Course Hub when appropriate.

The Course Hub is where the team coordinates; Course Manager is where course content and access are managed. `?hub=` is navigation context, not current course-query scoping. Do not silently make one imply the other.

## Editor structure

`components/CourseEditor.tsx` is the structural peer of ProgramEditor and shares the `pe-` chrome. Its tabs are Content, Lessons, Landing, Categories, Access, Schedule, Dana, and Visibility. Lesson ordering mixes section rows and lesson rows; keep drag/reorder behavior, explicit removal, and the add-existing/create-new distinction legible.

Course rich fields and lesson rich fields must follow the placements in `RIM_Editor_Types.md`. The `th-` grammar remains for course/lesson lists and lesson-specific controls; `pe-` owns the shared editor shell.

## Full ecosystem trace

Before changing a Course or Lesson field, check:

- public course landing: `/course/[slug]`
- member Library: `/account/courses`
- access-gated lesson reader: `/lessons/[slug]`
- `CourseAccess`, `SeriesEnrollment`, and role/self-enroll rules
- dana and checkout behavior
- `ProgramCourse` bundles and registration-driven unlocks
- lesson media/resources, progress, notes, and teacher attribution
- course/lesson slugs, deep links, and category filtering

Programs and Courses are siblings, not interchangeable records: Programs organize live occurrences; Courses organize persistent study content.

## Authenticated design contract

- use the shared member header, `WorkspaceShell`, and Series/Lessons sub-navigation
- keep the compact authenticated type scale for controls; authored lesson/course content remains editorial
- use warm ground + quiet white working surfaces; do not introduce decorative cards, shadows, or competing action colors
- preserve the `pe-`/`th-` hierarchy instead of creating page-local CSS
- align controls vertically within rows and keep table/list actions predictable
- tabs should reduce cognitive load; avoid duplicating the same control or explanation across tabs
- preserve 44px touch targets, responsive table containment, and 16px minimum mobile input text

## Common pitfalls

- Treating the Course Hub as the Course database scope.
- Conflating course access flags with the paths that grant access (`CourseAccess`, `SeriesEnrollment`, `ProgramCourse`).
- Updating a course editor field without updating the public/member renderer.
- Adding rich text without an `RIM_Editor_Types.md` placement and output wrapper.
- Breaking ordered mixed section/lesson rows while changing drag UI.
- Passing raw Prisma `Date` values to a client component.
- Replacing `hasToolAccess()` with a role-only check.

## Verification

Run `npx tsc --noEmit` before pushing. For behavioral changes, exercise the relevant access state—not only ADMIN—and trace course landing → enrollment/access → Library → lesson. The full production build completes on Vercel, not locally.
