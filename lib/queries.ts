// Sanity GROQ queries for RIM Next
//
// Program-related queries were removed in Phase 3d — programs now live in Postgres.

export const teamsQuery = `*[_type == "teams" && !(_id in path("drafts.**"))] | order(sortOrder asc) {
  _id, name, slug, sortOrder, title,
  bio,
  bioPicture { asset-> { url } }
}`;

export const teamBySlugQuery = `*[_type == "teams" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, title,
  bio,
  bioPicture { asset-> { url } }
}`;

export const allTeamSlugsQuery = `*[_type == "teams" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Lessons ──────────────────────────────────────────────────────────────────

export const lessonBySlugQuery = `*[_type == "lessons" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, lessonTitleDisplayed, includesAudio,
  audioFile { asset->{ url } },
  videoLessonLink, headerQuote, quoteSource,
  lessonContent[] {
    ...,
    _type == "practiceCallout" => { _type, _key, title, content[] { ... } },
    _type == "bodyQuote"       => { _type, _key, quote, attribution },
    _type == "verseQuote"      => { _type, _key, quote, attribution },
    _type == "calloutText"     => { _type, _key, text }
  },
  heroImage { asset-> { url }, alt },
  teachers[]-> { name, slug, bioPicture { asset-> { url } } },
  downloadableResources[]-> {
    name, description,
    resourceFile { asset-> { url } }
  }
}`;

export const allLessonSlugsQuery = `*[_type == "lessons" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Courses ──────────────────────────────────────────────────────────────────

export const courseBySlugQuery = `*[_type == "courses" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, subheading, accessLevel, mainContentDescription,
  lessons[]-> { lessonTitleDisplayed, slug, isSectionTitle, includesAudio }
}`;

// Returns slugs of all programs that link to a specific course (for registration-based access check)
export const programsLinkedToCourseQuery = `*[_type == "programs" && $courseSlug in linkedCourses[]->slug.current && !(_id in path("drafts.**"))] {
  "slug": slug.current
}`;

export const allCourseSlugsQuery = `*[_type == "courses" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// All courses enriched with which programs link back to them (for admin course access UI)
export const allCoursesWithLinkedProgramsQuery = `*[_type == "courses" && !(_id in path("drafts.**"))] | order(name asc) {
  "slug": slug.current,
  name,
  accessLevel,
  "linkedByPrograms": *[_type == "programs" && ^._id in linkedCourses[]._ref && !(_id in path("drafts.**"))] {
    "slug": slug.current,
    name
  }
}`;

// ─── Glossary ─────────────────────────────────────────────────────────────────

export const glossaryTermBySlugQuery = `*[_type == "glossary" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, pali, sanskrit, synonyms
}`;

export const allGlossaryTermSlugsQuery = `*[_type == "glossary" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Magazine Articles ────────────────────────────────────────────────────────

export const magazineArticleBySlugQuery = `*[_type == "magazineArticles" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, slug, articleTitleDisplayed, articleContent
}`;

export const allMagazineArticleSlugsQuery = `*[_type == "magazineArticles" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Volunteer Positions ──────────────────────────────────────────────────────

export const volunteerPositionBySlugQuery = `*[_type == "volunteerPositions" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, isOpen, positionDescription,
  currentVolunteers[]-> { name, slug }
}`;

export const allVolunteerPositionSlugsQuery = `*[_type == "volunteerPositions" && !(_id in path("drafts.**"))] { "slug": slug.current }`;
