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
