// All Sanity GROQ queries for RIM Next

export const programsQuery = `*[_type == "programs" && !(_id in path("drafts.**")) && hideFromProgramPageList != true] | order(sortOrder asc) {
  _id,
  name,
  slug,
  tagline,
  listingDayAndTimeText,
  dateText,
  timeText,
  locationText,
  locationLink,
  danaText,
  sortOrder,
  dashboardSpecialAnnouncement,
  registrationRequired,
  registrationClosed,
  filloutRegistrationFormId,
  zoomLink,
  zoomLinkText,
  quote,
  quoteSource,
  programDescription,
  specialNotes,
  signedOutInstructions,
  signedInInstructions,
  programCategory-> { name, slug },
  teacherFacilitators[]-> {
    name, slug, title,
    bioPicture { asset-> { url } }
  },
  dayOfWeek[]-> { name, slug },
  largeProgramImage { asset-> { url } }
}`;

export const programBySlugQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id,
  name,
  slug,
  tagline,
  listingDayAndTimeText,
  dateText,
  timeText,
  locationText,
  locationLink,
  danaText,
  registrationRequired,
  registrationClosed,
  filloutRegistrationFormId,
  registrationEnabled,
  registrationCapacity,
  registrationDeadline,
  danaMode,
  suggestedDana,
  danaBaseAmount,
  danaFixedAmount,
  danaMessage,
  registrationFields[] {
    _key, label, fieldType, required, options
  },
  zoomLink,
  zoomLinkText,
  quote,
  quoteSource,
  programDescription[] {
    ...,
    _type == "practiceCallout" => { _type, _key, title, content[] { ... } },
    _type == "bodyQuote"       => { _type, _key, quote, attribution },
    _type == "verseQuote"      => { _type, _key, quote, attribution },
    _type == "calloutText"     => { _type, _key, text }
  },
  specialNotes,
  signedOutInstructions,
  signedInInstructions,
  programCategory-> { name, slug },
  teacherFacilitators[]-> {
    name, slug, title,
    bioPicture { asset-> { url } }
  },
  dayOfWeek[]-> { name, slug },
  largeProgramImage { asset-> { url } }
}`;

export const programCategoriesQuery = `*[_type == "programCategories" && !(_id in path("drafts.**")) && hideFromProgramsPage != true] {
  _id, name, slug, description
}`;

export const dashboardProgramsQuery = `*[_type == "programs" && !(_id in path("drafts.**")) && removeFromProgramList != true] | order(sortOrder asc) {
  _id,
  name,
  sortOrder,
  dayOfWeek[]-> { name },
  dayFiltering,
  listingDayAndTimeText,
  zoomLink,
  dashboardSpecialAnnouncement,
  dashboardEarlyArrivalMessage
}`;

export const allProgramSlugsQuery = `*[_type == "programs" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

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
  _id, name, slug, subheading, mainContentDescription,
  lessons[]-> { lessonTitleDisplayed, slug, isSectionTitle, includesAudio }
}`;

export const allCourseSlugsQuery = `*[_type == "courses" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Glossary ─────────────────────────────────────────────────────────────────

export const glossaryTermBySlugQuery = `*[_type == "glossary" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, pali, sanskrit, synonyms
}`;

export const allGlossaryTermSlugsQuery = `*[_type == "glossary" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

// ─── Class Recordings ─────────────────────────────────────────────────────────

export const classRecordingBySlugQuery = `*[_type == "classRecordings" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, dateRecorded, audioEmbedCode, videoLink, description,
  teachers[]-> { name, slug },
  topics[]-> { name, slug }
}`;

export const allClassRecordingSlugsQuery = `*[_type == "classRecordings" && !(_id in path("drafts.**"))] { "slug": slug.current }`;

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

// ─── Registration field definitions (for self-service edit form) ──────────────

export const registrationFieldsBySlugQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  registrationFields[] { _key, label, fieldType, required, options }
}`;

// ─── Reminder email data (for route handler and bulk send) ────────────────────

export const programReminderDataQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  name,
  dateText,
  timeText,
  locationText,
  locationLink,
  zoomLink,
  zoomLinkText,
  reminderMessage
}`;

// ─── Programs with reminder date in a time window (for daily cron) ────────────

export const programsWithReminderInWindowQuery = `*[_type == "programs" && reminderDate >= $since && reminderDate <= $now && !(_id in path("drafts.**"))] {
  _id, name, "slug": slug.current,
  dateText, timeText, locationText, locationLink,
  zoomLink, zoomLinkText, reminderMessage
}`;
