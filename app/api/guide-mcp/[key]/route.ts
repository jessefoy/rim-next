import { NextRequest, NextResponse } from "next/server";
import { OFFERING_CATEGORIES, OFFERING_FORMATS } from "@/lib/programOffering";
import { db } from "@/lib/db";
import { readAccess, SITE_ORIGIN } from "@/lib/guideAuth";
import { keyMatches } from "@/lib/guideConnector";
import {
  listGuideTopics,
  publicPageWords,
  readDesignDoc,
  readGuideTopic,
  screenCode,
  screenWords,
  searchGuide,
  DESIGN_DOCS,
} from "@/lib/guideContent";
import {
  emailTemplates,
  findMembers,
  listPrograms,
  memberRecord,
  myTeams,
  programPeople,
  programSettings,
  teamConversations,
  teamMembers,
  teamSchedule,
  viewerCan,
  type GuideViewer,
} from "@/lib/guideData";
import { conversationReply, conversationStart, coverAsk, coverCancel, coverTake, sessionAssign, sessionGiveUp, sessionTake, sessionTakeOver } from "@/lib/guideSchedule";
import { registrationAdd, registrationChange, registrationMessage, registrationNote, registrationReminder, registrationRemove, registrationSettings } from "@/lib/guideRegistration";
import { archiveProgram, canEditAny, changeWords, editContent, findWords, reachOf, readContent, startProgram, type Replacement } from "@/lib/guideEdits";

/**
 * The RIM Guide connector (2026-10-27): a read-only remote MCP server that the
 * volunteers' shared Claude project uses for everything it knows. Each person
 * signs in with their own RIM account (lib/guideAuth.ts) and the guide reads
 * what they can read on the site: the guide's topics, the design docs, every
 * signed-in screen's words and code (lib/guideContent.ts), and RIM's data
 * through the site's own gates (lib/guideData.ts). It also acts for them
 * (2026-10-28): what their account may do on the site, through the site's own
 * steps, and for Content editors (CONTENT_EDITOR) content in every editor and
 * the pages' words (lib/guideEdits.ts). Each change is recorded and emailed
 * to Jesse.
 *
 * Added once by a workspace owner (Organization settings > Connectors > Add >
 * Custom > Web) at https://<site>/api/guide-mcp/<GUIDE_CONNECTOR_KEY>; each
 * volunteer presses Connect and signs in once. Without a current sign-in it
 * answers 401 with where to sign in (RFC 9728), which is how Claude starts it.
 *
 * Streamable HTTP, stateless: each POST carries JSON-RPC and gets JSON back;
 * there is no event stream (GET is 405) and no session.
 */

// Saves send their emails after the response, as the site's routes do: a
// program's team emails, and Message people one at a time to up to 50 people
// (as POST /api/programs/[slug]/message allows; 2026-10-28).
export const maxDuration = 300;

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const s = (description: string) => ({ type: "string", description });

type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: object };

/** Tools everyone signed in may use. */
const OPEN_TOOLS: Tool[] = [
  {
    name: "guide_topics",
    title: "List the guide's topics",
    description: "Lists the RIM Guide's topics (how the site works and why, the site map, Programs and Registration, teams and the Scheduler, the tutorials, how RIM writes), each with the name to read it by.",
    inputSchema: obj({}),
    annotations: READ_ONLY,
  },
  {
    name: "search_guide",
    title: "Search the guide and design docs",
    description: "Finds the sections of the guide's topics and the design docs that best match a few words, such as \"waiting list email\" or \"why can't members cancel\". Use it first for most questions.",
    inputSchema: obj({ query: s("A few words about what to find."), within: { type: "string", enum: ["both", "guide", "docs"], description: "Search the guide's topics, the design docs, or both (the default)." } }, ["query"]),
    annotations: READ_ONLY,
  },
  {
    name: "read_guide",
    title: "Read a guide topic",
    description: "Reads one topic of the guide in full, or only the section whose heading contains the given words. Use the topic names from guide_topics.",
    inputSchema: obj({ topic: s("The topic's name, such as \"programs-and-registration\" or \"site-map\"."), section: s("Optional: words from a section heading, to read only that section.") }, ["topic"]),
    annotations: READ_ONLY,
  },
  {
    name: "read_design_doc",
    title: "Read a design doc",
    description: `Reads one of RIM's design docs, which say why each part of the site is built the way it is. Without a section it gives the doc's opening and its headings; with words from a heading it gives that section. The docs: ${DESIGN_DOCS.join(", ")}.`,
    inputSchema: obj({ doc: s("The doc's name, such as \"RIM_ProgramEditor\" or \"web design philosophy\"."), section: s("Optional: words from a section heading.") }, ["doc"]),
    annotations: READ_ONLY,
  },
  {
    name: "screen_words",
    title: "Read a screen's words",
    description: "The exact words on a signed-in screen (labels, hints under fields, buttons, headings, confirm questions, the messages after saving or on an error), each with the file and line where it lives in the code. Without a screen it lists the screens. Use it to quote what a volunteer reads, and put the file and line in a feedback note.",
    inputSchema: obj({ screen: s("The screen's name from the list, such as \"program-editor\" or \"registration-program\"."), part: s("Optional: part of one file's name, such as \"About\" or \"Dana\", to read only that part.") }),
    annotations: READ_ONLY,
  },
  {
    name: "screen_code",
    title: "Read the code behind a screen",
    description: "Up to 160 numbered lines of one screen's code, around a line or between two. Use it to see when something shows or what a button does, then explain it in plain words; don't show code unless asked.",
    inputSchema: obj({ file: s("The file's full name as screen_words gives it."), line: { type: "number", description: "A line to read around." }, from: { type: "number", description: "First line to read." }, to: { type: "number", description: "Last line to read." } }, ["file"]),
    annotations: READ_ONLY,
  },
  {
    name: "page_words",
    title: "Read a public page's words",
    description: "Reads the words on one public page of RIM's site right now, such as /new-to-rim or /programs/qigong-at-rim. Use it to quote a public page's current words exactly.",
    inputSchema: obj({ path: s("The page's address after the site name, such as /about.") }, ["path"]),
    annotations: { ...READ_ONLY, openWorldHint: true },
  },
  {
    name: "my_teams",
    title: "List my teams",
    description: "The teams the signed-in person can open, with the name to ask about each by.",
    inputSchema: obj({}),
    annotations: READ_ONLY,
  },
  {
    name: "team_members",
    title: "A team's members",
    description: "A team's members as its Members page shows the signed-in person (a lead also sees emails and notes).",
    inputSchema: obj({ team: s("The team's name from my_teams, such as \"host-team\".") }, ["team"]),
    annotations: READ_ONLY,
  },
  {
    name: "team_conversations",
    title: "A team's conversations",
    description: "A team's conversations, latest first, or one conversation with its replies when given words from its title.",
    inputSchema: obj({ team: s("The team's name from my_teams."), title: s("Optional: words from a conversation's title, to read it.") }, ["team"]),
    annotations: READ_ONLY,
  },
  {
    name: "team_schedule",
    title: "A team's schedule",
    description: "Who is covering a team's sessions in the coming weeks, which are still open, and the open requests for a sub, as the Scheduler shows them.",
    inputSchema: obj({ team: s("The team's name from my_teams."), weeks: { type: "number", description: "How many weeks ahead, 1 to 12 (4 if not given)." } }, ["team"]),
    annotations: READ_ONLY,
  },
];

const PROGRAM_TOOLS: Tool[] = [
  {
    name: "list_programs",
    title: "List the programs",
    description: "Every program as the Programs list shows it: when, in person or online, its category and format, and where registration stands (with how many registered, for those who can open Registration).",
    inputSchema: obj({ include_archived: { type: "boolean", description: "Include archived programs." } }),
    annotations: READ_ONLY,
  },
  {
    name: "program_settings",
    title: "A program's settings",
    description: "Every setting of one program exactly as the program editor holds it now, each under the editor's own name for it: the words, dates, registration, questions, messages, dana and where it appears.",
    inputSchema: obj({ program: s("The program's name or web address, such as \"qigong-at-rim\".") }, ["program"]),
    annotations: READ_ONLY,
  },
];

const REGISTRATION_TOOLS: Tool[] = [
  {
    name: "program_people",
    title: "A program's people",
    description: "One program's people as the Registration app shows them: each person's place, dana and contact, and the latest history. Given a person's name, their answers, notes and history in full.",
    inputSchema: obj({ program: s("The program's name or web address."), person: s("Optional: part of a person's name or email.") }, ["program"]),
    annotations: READ_ONLY,
  },
];

const EMAIL_TOOLS: Tool[] = [
  {
    name: "email_templates",
    title: "The emails RIM sends",
    description: "The email templates from /admin/emails: the list by group, or one email's subject, body, when it goes and what fills in. The words are the templates, never a person's email.",
    inputSchema: obj({ email: s("Optional: the email's name in brackets from the list, such as \"registration-confirmation\".") }),
    annotations: READ_ONLY,
  },
];

const REGISTRY_TOOLS: Tool[] = [
  {
    name: "find_members",
    title: "Find members",
    description: "Members whose name or email has the given words, with their roles and teams, as the Member Registry finds them.",
    inputSchema: obj({ query: s("Part of a name or email.") }, ["query"]),
    annotations: READ_ONLY,
  },
  {
    name: "member_record",
    title: "A member's record",
    description: "One member's record as the Member Registry shows it to the signed-in person: contact, teams, roles, registrations and the other sections they may see.",
    inputSchema: obj({ email: s("The member's email, from find_members.") }, ["email"]),
    annotations: READ_ONLY,
  },
];

const CONFIRM = { type: "string", description: "Only after the person said yes to what the first answer described: the confirm text that answer gave." };
const WRITES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const KIND = { type: "string", enum: ["program", "course", "lesson", "email", "teacher"], description: "What kind of thing." };

/**
 * Acting for the person (lib/guideEdits.ts): read_content and edit_content
 * for anyone who changes something on the site (Programs, the Course
 * Manager, Admin) or is a Content editor; each kind as they may on the site.
 */
const EDIT_TOOLS: Tool[] = [
  {
    name: "read_content",
    title: "Read content exactly",
    description: "A program's part, a course with its lessons, a lesson, an email or a teacher page exactly as stored (rich text as HTML), to change it without losing anything. Without an item, lists the courses or teacher pages. For a program, give the part (program_settings shows them all as words).",
    inputSchema: obj({ kind: KIND, item: s("Its name or web address (for an email, its name in brackets from email_templates)."), field: s("For a program: the part's name in brackets from program_settings, such as \"description\".") }, ["kind"]),
    annotations: READ_ONLY,
  },
  {
    name: "edit_content",
    title: "Change content",
    description: "Changes a program, course, lesson, email or teacher page through its editor's own save, so it does exactly what saving in the editor does (a program's new name reaches its registrations, donations and Zoom meetings; a schedule change clears sessions on days it no longer meets). Give `replace` to change some words inside a part, or `changes` (with the version read_content gave) to set whole parts, by the names read_content shows. The sign-in emails can't be changed. Before calling it, show the person the change, before and after, and wait for their yes. A program change that may email teams or hosts asks first: the first call does nothing and says who may be emailed; only after their yes call again with the confirm text it gave. Every change is recorded and emailed to Jesse.",
    inputSchema: obj(
      {
        kind: KIND,
        item: s("Its name or web address (for an email, its name in brackets)."),
        replace: {
          type: "array",
          description: "Words to change inside a part: each must appear exactly once in that part.",
          items: obj({ field: s("The part, such as \"description\" or \"tagline\"."), find: s("The words as they are now."), replace_with: s("The new words.") }, ["field", "find", "replace_with"]),
        },
        changes: { type: "object", description: "Whole parts to set, by name: { \"tagline\": \"…\" }. Rich text is HTML. Values take the forms read_content shows (dates as YYYY-MM-DDTHH:MM, Central time; teachers by name). Needs version." },
        version: s("With changes: the version read_content gave, so nothing saved since is overwritten."),
        confirm: CONFIRM,
      },
      ["kind", "item"],
    ),
    annotations: WRITES,
  },
];

/** For anyone who may start programs on the site (Programs), or a Content editor. */
const START_TOOLS: Tool[] = [
  {
    name: "create_program",
    title: "Start a new program",
    description: `Starts a new program as the program editor does: blank, from a shape, or as a copy of another program, with any parts set at once (the names program_settings and read_content show; rich text is HTML). It goes through the editor's own create, so its team hears about it as from the editor. A category is required: offeringCategory, one of ${OFFERING_CATEGORIES.map((c) => `${c.code} (${c.label})`).join(", ")}; Dates and times are YYYY-MM-DDTHH:MM in Central time (startDatetime, endDatetime and the rest); teachers (teacherIds) are given by name. A shape sets the format (offeringFormat, one of ${OFFERING_FORMATS.map((f) => f.code).join(", ")}). Before calling it, show the person what you will make and wait for their yes. If it would email its teams, the first call does nothing and says who; only after their yes call again with the confirm text it gave. Afterwards read it back with program_settings and fill in the rest with edit_content. Every change is recorded and emailed to Jesse.`,
    inputSchema: obj(
      {
        name: s("The program's name."),
        start: s("Optional: \"blank\" (the default), or a shape: DROP_IN, CLASS, COURSE, WORKSHOP, DAY_OF_MINDFULNESS or RETREAT."),
        copy: s("Optional: a program's name or web address, to start as a copy of it (new dates are then needed)."),
        changes: { type: "object", description: "Optional: parts to set at once, by name, such as { \"tagline\": \"…\", \"offeringCategory\": \"…\" }." },
        confirm: CONFIRM,
      },
      ["name"],
    ),
    annotations: WRITES,
  },
];

/** For the registrar, admins and the guiding teacher, as on the site. */
const ARCHIVE_TOOLS: Tool[] = [
  {
    name: "archive_program",
    title: "Archive or restore a program",
    description: "Archives a program, or restores an archived one, as Programs' Archive does. Before calling it, say which program and wait for their yes. Recorded and emailed to Jesse.",
    inputSchema: obj({ program: s("The program's name or web address."), restore: { type: "boolean", description: "True to restore an archived program." } }, ["program"]),
    annotations: WRITES,
  },
];

const PROGRAM_ARG = s("The program's name or web address.");
const PERSON_ARG = s("The person's name or email, as program_people shows them.");

/** The Registration app's actions, for those who may open it (lib/guideRegistration.ts). */
const REGISTRATION_ACTION_TOOLS: Tool[] = [
  {
    name: "registration_add",
    title: "Add someone to a program",
    description: "Adds someone who signed up by phone, in person or on paper, as Registration's Add someone does: a place (or the waiting list when full), how they gave dana, and their confirmation. If it would email anyone, the first call does nothing and says who would be emailed; tell the person, and only after their yes call again with the confirm text it gave.",
    inputSchema: obj(
      {
        program: PROGRAM_ARG,
        firstName: s("Their first name."),
        lastName: s("Their last name."),
        email: s("Their email."),
        phone: s("Optional: their phone."),
        dana: { type: "string", enum: ["given", "none", "online"], description: "How they give dana, when the program asks for it: given another way (cash or check), none, or online (they're emailed the link)." },
        sendConfirmation: { type: "boolean", description: "False to send them no confirmation (the app's unticked box). Default true." },
        answers: { type: "object", description: "Optional: their answers, by each question's exact wording." },
        confirm: CONFIRM,
      },
      ["program", "firstName", "lastName", "email"],
    ),
    annotations: WRITES,
  },
  {
    name: "registration_change",
    title: "Change someone's registration",
    description: "One change to one person's registration, as the buttons on their card do: move_off_waiting_list, cancel (emailThem false to not email them), restore, dana_given (given another way), dana_none, resend_confirmation, send_dana_link, send_edit_link, send_reminder, or answers (with answers by each question's wording). Anything that would email asks first: the first call does nothing and says who would be emailed; only after their yes call again with the confirm text it gave.",
    inputSchema: obj(
      {
        program: PROGRAM_ARG,
        person: PERSON_ARG,
        change: { type: "string", enum: ["move_off_waiting_list", "cancel", "restore", "dana_given", "dana_none", "resend_confirmation", "send_dana_link", "send_edit_link", "send_reminder", "answers"] },
        emailThem: { type: "boolean", description: "With cancel: false to not email them. Default true." },
        answers: { type: "object", description: "With answers: the changed answers, by each question's exact wording." },
        confirm: CONFIRM,
      },
      ["program", "person", "change"],
    ),
    annotations: WRITES,
  },
  {
    name: "registration_remove",
    title: "Remove a cancelled registration",
    description: "Removes a cancelled registration for good, as the app's Delete does (its History stays). It can't be undone, so the first call only says what would happen; after their yes, call again with the confirm text it gave.",
    inputSchema: obj({ program: PROGRAM_ARG, person: PERSON_ARG, confirm: CONFIRM }, ["program", "person"]),
    annotations: { ...WRITES, destructiveHint: true },
  },
  {
    name: "registration_note",
    title: "Add a note to someone's registration",
    description: "Adds a note to a person's registration, with their name and the date, as the app does. Emails no one. Show the note first and wait for their yes.",
    inputSchema: obj({ program: PROGRAM_ARG, person: PERSON_ARG, note: s("The note, up to 4000 characters.") }, ["program", "person", "note"]),
    annotations: WRITES,
  },
  {
    name: "message_people",
    title: "Message the people in a program",
    description: "Emails the people registered, waiting, or both, as Registration's Message people does (up to 50 people; replies go to the registrar's inbox). test: true sends a copy only to the person you're helping. Otherwise the first call does nothing and says how many would be emailed and what; only after their yes call again with the confirm text it gave.",
    inputSchema: obj(
      {
        program: PROGRAM_ARG,
        to: { type: "string", enum: ["registered", "waiting", "both"], description: "Who: registered (the default), waiting, or both." },
        subject: s("The subject."),
        message: s("The message, as plain text."),
        test: { type: "boolean", description: "True to send a test copy only to the person you're helping." },
        confirm: CONFIRM,
      },
      ["program", "subject", "message"],
    ),
    annotations: { ...WRITES, openWorldHint: true },
  },
  {
    name: "send_reminder",
    title: "Send the reminder now",
    description: "Sends the program's reminder now to everyone registered who hasn't had it, as the app's Send the reminder now does. The first call does nothing and says how many would be emailed; only after their yes call again with the confirm text it gave.",
    inputSchema: obj({ program: PROGRAM_ARG, confirm: CONFIRM }, ["program"]),
    annotations: WRITES,
  },
  {
    name: "registration_settings",
    title: "Open, close or schedule registration",
    description: "Registration's settings for a program: state open, not_yet (with opensAt) or closed; closesAt; places (a number, or null for no limit); mailingList automatic, on or off. Emails no one. Dates are YYYY-MM-DDTHH:MM in Central time. Show the change first and wait for their yes.",
    inputSchema: obj(
      {
        program: PROGRAM_ARG,
        state: { type: "string", enum: ["open", "not_yet", "closed"] },
        opensAt: s("With not_yet: when it opens."),
        closesAt: s("When registration closes, or empty for no closing date."),
        places: { type: "number", description: "The number of places (null for no limit)." },
        mailingList: { type: "string", enum: ["automatic", "on", "off"] },
      },
      ["program"],
    ),
    annotations: WRITES,
  },
];

const TEAM_ARG = s("The team, by the name my_teams gives.");
const DATE_ARG = s("The session's day, YYYY-MM-DD (Central time).");
const ASKS = "Anything that would email someone other than the person you're helping asks first: the first call does nothing and says who would be emailed; only after their yes call again with the confirm text it gave.";

/** For members of teams (lib/guideSchedule.ts): their own sessions and requests, and Conversations. */
const TEAM_ACTION_TOOLS: Tool[] = [
  {
    name: "session_take",
    title: "Take a session",
    description: "Takes an open session on a team's schedule, or signs up on a team that signs up in numbers (the greeters), as the Scheduler does. Their confirmation is emailed to them. Show what you'll do and wait for their yes.",
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG }, ["team", "program", "date"]),
    annotations: WRITES,
  },
  {
    name: "session_give_up",
    title: "Give up a session",
    description: `Takes the person off a session they can't make (or cancels their sign-up). A team lead can name someone to take them off. If that leaves the session with nobody within two weeks, the team is told it's open, as on the site. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG, person: s("Optional, for a team lead: who to take off, by full name."), confirm: CONFIRM }, ["team", "program", "date"]),
    annotations: WRITES,
  },
  {
    name: "cover_ask",
    title: "Ask the team to cover a session",
    description: `Asks the team to cover the person's session, with an optional note, as the Scheduler's "Ask the team to cover" does (a lead can ask on someone's behalf by naming them). The team's members who can take it are emailed. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG, note: s("Optional: a note for the team."), person: s("Optional, for a team lead: whose session, by full name."), confirm: CONFIRM }, ["team", "program", "date"]),
    annotations: WRITES,
  },
  {
    name: "cover_take",
    title: "Cover someone's session",
    description: `Covers a session someone asked the team to cover; the person who asked is emailed that it's covered. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG, note: s("Optional: a note to the person who asked."), confirm: CONFIRM }, ["team", "program", "date"]),
    annotations: WRITES,
  },
  {
    name: "cover_cancel",
    title: "Clear a cover request",
    description: "Clears an open cover request (the person's own, or, for a lead, any on their team); the person stays on the session. Emails no one. Show what you'll do and wait for their yes.",
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG }, ["team", "program", "date"]),
    annotations: WRITES,
  },
  {
    name: "conversation_start",
    title: "Start a conversation in a team",
    description: `Posts a new conversation in a team's Conversations, as the person, emailing the team's leads and anyone named in notify, by their choices. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, title: s("Its title."), message: s("The message, as plain text (blank lines between paragraphs)."), notify: { type: "array", items: { type: "string" }, description: "Optional: team members to tell, by full name." }, confirm: CONFIRM }, ["team", "title", "message"]),
    annotations: { ...WRITES, openWorldHint: true },
  },
  {
    name: "conversation_reply",
    title: "Reply in a team's conversation",
    description: `Replies in a team's open conversation, found by its title, emailing those following it, by their choices. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, conversation: s("Words from the conversation's title."), message: s("The reply, as plain text."), notify: { type: "array", items: { type: "string" }, description: "Optional: team members to add, by full name." }, confirm: CONFIRM }, ["team", "conversation", "message"]),
    annotations: { ...WRITES, openWorldHint: true },
  },
];

/** For team leads (their own team), Scheduling managers and admins, as on the site. */
const LEAD_TOOLS: Tool[] = [
  {
    name: "session_assign",
    title: "Put someone on a session",
    description: `For a team lead: puts a member of their team on an open session, as the Scheduler's Assign does; they're emailed a confirmation. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG, person: s("Who, by full name."), confirm: CONFIRM }, ["team", "program", "date", "person"]),
    annotations: WRITES,
  },
  {
    name: "session_take_over",
    title: "Take a session over",
    description: `For a team lead: takes a session over themselves, as the Scheduler's Reassign does; the person who had it is emailed. ${ASKS}`,
    inputSchema: obj({ team: TEAM_ARG, program: PROGRAM_ARG, date: DATE_ARG, confirm: CONFIRM }, ["team", "program", "date"]),
    annotations: WRITES,
  },
];

/** Content editors only: the words written into the pages. */
const PAGE_TOOLS: Tool[] = [
  {
    name: "find_page_words",
    title: "Find words on the site's pages",
    description: "Finds where words are written in the site's pages (Home, About and every other page, and each screen's labels), with the file, line and the lines around them. Use it before change_page_words. Words in a program, course, lesson, email or teacher page are changed with edit_content instead.",
    inputSchema: obj({ words: s("A few words exactly as the page shows them.") }, ["words"]),
    annotations: READ_ONLY,
  },
  {
    name: "change_page_words",
    title: "Change words on a page",
    description: "Changes words written into the site's pages: one place, or many in one go (put every change the person agreed to in `changes`, so it is one change to the site and one approval). Words only: anything that would change a link, a style or the code is refused, and if any change can't be made, none is. Each find must be page words in one place in its file; include more of the words around it if not. Write new words as plain text: an entity such as &nbsp; is kept as written, and a space at the start or end is kept. It's on the site about two minutes later; then read it back with page_words. Before calling it, show the person every change, before and after, and wait for their yes. Every change is recorded and emailed to Jesse.",
    inputSchema: obj({
      changes: {
        type: "array",
        description: "The changes, up to 30, all made together.",
        items: obj({ file: s("The file from find_page_words, such as \"app/about/page.tsx\"."), find: s("The words as they are now."), replace_with: s("The new words.") }, ["file", "find", "replace_with"]),
      },
    }, ["changes"]),
    annotations: { ...WRITES, openWorldHint: true },
  },
];

/** Whether they're on a team (or see every team), and lead one, as the Scheduler decides. */
async function teamReach(v: GuideViewer): Promise<{ member: boolean; lead: boolean }> {
  const oversees = v.roles.includes("ADMIN") || v.roles.includes("HOST_MANAGER");
  const sees = oversees || v.roles.includes("GUIDING_TEACHER");
  const memberships = await db.hubMember.findMany({ where: { userId: v.userId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { isCoordinator: true, status: true } });
  return {
    member: sees || memberships.length > 0,
    lead: oversees || memberships.some((m) => m.isCoordinator && m.status === "ACTIVE"),
  };
}

async function toolsFor(v: GuideViewer): Promise<Tool[]> {
  const reach = await reachOf({ id: v.userId, roles: v.roles });
  const team = await teamReach(v);
  return [
    ...OPEN_TOOLS,
    ...((await viewerCan.programs(v)) ? PROGRAM_TOOLS : []),
    ...(viewerCan.registration(v) ? [...REGISTRATION_TOOLS, ...REGISTRATION_ACTION_TOOLS] : []),
    ...(viewerCan.emails(v) ? EMAIL_TOOLS : []),
    ...(viewerCan.registry(v) ? REGISTRY_TOOLS : []),
    ...(canEditAny(reach) ? EDIT_TOOLS : []),
    ...(reach.programs || reach.contentEditor ? START_TOOLS : []),
    ...(reach.programManager ? ARCHIVE_TOOLS : []),
    ...(reach.contentEditor ? PAGE_TOOLS : []),
    ...(team.member ? TEAM_ACTION_TOOLS : []),
    ...(team.lead ? LEAD_TOOLS : []),
  ];
}

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

type Viewer = GuideViewer & { name: string; email: string };

/** The person, as the guide acts for them. */
const me = (v: Viewer) => ({ id: v.userId, roles: v.roles, name: v.name, email: v.email });
const strs = (x: unknown) => (Array.isArray(x) ? x.map((y) => str(y)).filter(Boolean) : undefined);
const obj2 = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined);

async function callTool(name: string, args: Record<string, unknown>, v: Viewer) {
  switch (name) {
    case "guide_topics": {
      const topics = await listGuideTopics();
      return text(topics.map((t) => `- ${t.slug}: ${t.title}`).join("\n"));
    }
    case "search_guide": {
      const within = str(args.within);
      return text(await searchGuide(str(args.query), 6, within === "guide" || within === "docs" ? within : "both"));
    }
    case "read_guide": {
      const found = await readGuideTopic(str(args.topic), str(args.section) || undefined);
      if (found) return text(found);
      const topics = (await listGuideTopics()).map((t) => t.slug).join(", ");
      return text(args.section ? `No section in "${str(args.topic)}" has "${str(args.section)}" in its heading. Read the whole topic, or search.` : `There's no topic "${str(args.topic)}". The topics are: ${topics}.`, true);
    }
    case "read_design_doc":
      return text(await readDesignDoc(str(args.doc), str(args.section) || undefined));
    case "screen_words":
      return text(await screenWords(str(args.screen) || undefined, str(args.part) || undefined));
    case "screen_code":
      return text(await screenCode(str(args.file), num(args.line), num(args.from), num(args.to)));
    case "page_words":
      return text(await publicPageWords(SITE_ORIGIN, str(args.path)));
    case "my_teams":
      return text(await myTeams(v));
    case "team_members":
      return text(await teamMembers(v, str(args.team)));
    case "team_conversations":
      return text(await teamConversations(v, str(args.team), str(args.title) || undefined));
    case "team_schedule":
      return text(await teamSchedule(v, str(args.team), num(args.weeks) ?? 4));
    case "list_programs":
      return text(await listPrograms(v, args.include_archived === true));
    case "program_settings":
      return text(await programSettings(v, str(args.program)));
    case "program_people":
      return text(await programPeople(v, str(args.program), str(args.person) || undefined));
    case "email_templates":
      return text(await emailTemplates(v, str(args.email) || undefined));
    case "find_members":
      return text(await findMembers(v, str(args.query)));
    case "member_record":
      return text(await memberRecord(v, str(args.email)));
    case "read_content":
      return text(await readContent({ id: v.userId, roles: v.roles }, str(args.kind), str(args.item) || undefined, str(args.field) || undefined));
    case "edit_content": {
      const changes = args.changes && typeof args.changes === "object" && !Array.isArray(args.changes) ? (args.changes as Record<string, unknown>) : undefined;
      const replace = Array.isArray(args.replace) ? (args.replace as Replacement[]) : undefined;
      return text(await editContent({ id: v.userId, roles: v.roles, name: v.name }, str(args.kind), str(args.item), changes, replace, str(args.version) || undefined, (str(args.confirm) || undefined)));
    }
    case "create_program": {
      const changes = args.changes && typeof args.changes === "object" && !Array.isArray(args.changes) ? (args.changes as Record<string, unknown>) : undefined;
      return text(await startProgram({ id: v.userId, roles: v.roles, name: v.name }, { name: str(args.name), start: str(args.start) || undefined, copy: str(args.copy) || undefined, changes, confirm: (str(args.confirm) || undefined) }));
    }
    case "archive_program":
      return text(await archiveProgram({ id: v.userId, roles: v.roles, name: v.name }, str(args.program), args.restore !== true));
    case "registration_add":
      return text(await registrationAdd(me(v), {
        program: str(args.program), firstName: str(args.firstName), lastName: str(args.lastName), email: str(args.email),
        phone: str(args.phone) || undefined, dana: str(args.dana) || undefined,
        sendConfirmation: args.sendConfirmation !== false, answers: obj2(args.answers), confirm: (str(args.confirm) || undefined),
      }));
    case "registration_change":
      return text(await registrationChange(me(v), {
        program: str(args.program), person: str(args.person), change: str(args.change),
        emailThem: args.emailThem !== false, answers: obj2(args.answers), confirm: (str(args.confirm) || undefined),
      }));
    case "registration_remove":
      return text(await registrationRemove(me(v), { program: str(args.program), person: str(args.person), confirm: (str(args.confirm) || undefined) }));
    case "registration_note":
      return text(await registrationNote(me(v), { program: str(args.program), person: str(args.person), note: str(args.note) }));
    case "message_people":
      return text(await registrationMessage(me(v), {
        program: str(args.program), to: str(args.to) || undefined, subject: str(args.subject), message: str(args.message),
        test: args.test === true, confirm: (str(args.confirm) || undefined),
      }));
    case "send_reminder":
      return text(await registrationReminder(me(v), { program: str(args.program), confirm: (str(args.confirm) || undefined) }));
    case "registration_settings":
      return text(await registrationSettings(me(v), {
        program: str(args.program),
        state: str(args.state) || undefined,
        opensAt: str(args.opensAt) || undefined,
        closesAt: args.closesAt === undefined ? undefined : str(args.closesAt) || null,
        places: args.places === undefined ? undefined : num(args.places) ?? null,
        mailingList: str(args.mailingList) || undefined,
      }));
    case "session_take":
      return text(await sessionTake(me(v), { team: str(args.team), program: str(args.program), date: str(args.date) }));
    case "session_give_up":
      return text(await sessionGiveUp(me(v), { team: str(args.team), program: str(args.program), date: str(args.date), person: str(args.person) || undefined, confirm: str(args.confirm) || undefined }));
    case "session_assign":
      return text(await sessionAssign(me(v), { team: str(args.team), program: str(args.program), date: str(args.date), person: str(args.person), confirm: str(args.confirm) || undefined }));
    case "session_take_over":
      return text(await sessionTakeOver(me(v), { team: str(args.team), program: str(args.program), date: str(args.date), confirm: str(args.confirm) || undefined }));
    case "cover_ask":
      return text(await coverAsk(me(v), { team: str(args.team), program: str(args.program), date: str(args.date), note: str(args.note) || undefined, person: str(args.person) || undefined, confirm: str(args.confirm) || undefined }));
    case "cover_take":
      return text(await coverTake(me(v), { team: str(args.team), program: str(args.program), date: str(args.date), note: str(args.note) || undefined, confirm: str(args.confirm) || undefined }));
    case "cover_cancel":
      return text(await coverCancel(me(v), { team: str(args.team), program: str(args.program), date: str(args.date) }));
    case "conversation_start":
      return text(await conversationStart(me(v), { team: str(args.team), title: str(args.title), message: str(args.message), notify: strs(args.notify), confirm: str(args.confirm) || undefined }));
    case "conversation_reply":
      return text(await conversationReply(me(v), { team: str(args.team), conversation: str(args.conversation), message: str(args.message), notify: strs(args.notify), confirm: str(args.confirm) || undefined }));
    case "find_page_words":
      return text(await findWords(str(args.words)));
    case "change_page_words": {
      // One change may also come as file, find and replace_with on their own.
      const list = Array.isArray(args.changes) ? (args.changes as Record<string, unknown>[]) : [args];
      const changes = list.map((c) => ({ file: str(c.file), find: str(c.find), replaceWith: str(c.replace_with) }));
      return text(await changeWords({ id: v.userId, roles: v.roles, name: v.name }, changes));
    }
    default:
      return null;
  }
}

async function answer(msg: RpcMessage, v: Viewer): Promise<object | null> {
  if (!msg || typeof msg !== "object") {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
  }
  // A notification (no id) gets no reply.
  if (msg.id === undefined || msg.id === null) return null;
  const reply = (result: object) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });

  switch (msg.method) {
    case "initialize": {
      const asked = str(msg.params?.protocolVersion);
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "rim-guide", title: "RIM Guide", version: "2.0.0" },
        instructions: `How Rooted in Mindfulness's website and apps work and why, for RIM's volunteers, read as ${v.firstName || "the signed-in volunteer"} with what their account can see. Search the guide and design docs before answering; quote a screen's exact words with screen_words; read RIM's data with the program, registration, team and member tools. The guide can also act for them, doing what their account may do on the site (and, for a Content editor, changing content and page words): show each change before and after and wait for their yes.`,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: await toolsFor(v) });
    case "tools/call": {
      const name = str(msg.params?.name);
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!(await toolsFor(v)).some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const result = await callTool(name, args, v);
        // Who used which tool, for the record; never what they asked or read.
        console.info(`[guide-mcp] ${v.userId} ${name}`);
        return result ? reply(result) : fail(-32602, `Unknown tool: ${name}`);
      } catch (err) {
        console.error(`[guide-mcp] ${name} failed`, err);
        return reply(text("That didn't work just now. Try again in a moment.", true));
      }
    }
    default:
      return fail(-32601, `Method not found: ${str(msg.method)}`);
  }
}

/** Who is asking, from their sign-in, with roles read now; null asks them to sign in. */
async function viewerFrom(request: NextRequest): Promise<Viewer | null> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const access = await readAccess(m[1]);
  if (!access) return null;
  const user = await db.user.findUnique({
    where: { id: access.userId },
    select: { id: true, firstName: true, preferredName: true, lastName: true, email: true, roles: true, sectionGrants: true, archivedAt: true },
  });
  if (!user || user.archivedAt) return null;
  const firstName = user.preferredName || user.firstName || "";
  return {
    userId: user.id,
    firstName,
    // For the record of a change: who made it.
    name: `${firstName} ${user.lastName ?? ""}`.trim() || user.email,
    email: user.email,
    roles: user.roles,
    sectionGrants: user.sectionGrants,
  };
}

function signInPlease(key: string, hadToken: boolean) {
  const meta = `${SITE_ORIGIN}/api/guide-mcp/${key}/oauth-protected-resource`;
  return new NextResponse(JSON.stringify({ error: "Sign in to RIM to use the guide." }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${meta}", scope="guide"${hadToken ? ', error="invalid_token"' : ""}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!keyMatches(key)) return new NextResponse("Not found", { status: 404 });

  const viewer = await viewerFrom(request);
  if (!viewer) return signInPlease(key, !!request.headers.get("authorization"));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const batch = Array.isArray(body);
  const messages: unknown[] = batch ? (body as unknown[]) : [body];
  if (!messages.length) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }, { status: 400 });
  }
  const replies = (await Promise.all(messages.map((m) => answer(m as RpcMessage, viewer)))).filter(Boolean);
  // Only notifications: accepted, nothing to say.
  if (!replies.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? replies : replies[0], { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return new NextResponse("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
