// Sanity GROQ queries for RIM Next.
//
// Programs, lessons, courses, and teachers (Sanity `teams`) have all migrated
// to Postgres. The only authored content still in Sanity is `glossary` and
// `volunteerPositions`. Both are planned for Postgres migration in Stage 2d of
// the editor reorg — see RIM_Editor_Types.md.

// ─── Glossary ─────────────────────────────────────────────────────────────────

export const glossaryTermBySlugQuery = `*[_type == "glossary" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, pali, sanskrit, synonyms
}`;

export const allGlossaryTermSlugsQuery = `*[_type == "glossary" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Volunteer Positions ──────────────────────────────────────────────────────
// currentVolunteers used to dereference Sanity `teams`; those are deleted.
// The volunteer-positions page stopped rendering the Current Volunteers section
// in session 89. Field is still fetched for generateStaticParams parity.

export const volunteerPositionBySlugQuery = `*[_type == "volunteerPositions" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, isOpen, positionDescription
}`;

export const allVolunteerPositionSlugsQuery = `*[_type == "volunteerPositions" && !(_id in path("drafts.**"))] { "slug": slug.current }`;
