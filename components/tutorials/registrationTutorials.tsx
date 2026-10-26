/**
 * For the Registration Team (2026-10-26, Jesse: "a Registration Team section
 * to the site's Tutorials, with the two tutorials drawn from the screens";
 * the wording read and approved the same day). Setting up a program draws the
 * program editor (components/registrar/ProgramEditor.tsx and its sections in
 * program-editor/, the start page app/tools/programs/new); Looking after the
 * people draws the Registration app (app/tools/registration/*,
 * components/registration/*). The words on each screen are the app's own,
 * checked against those files on 2026-10-26. Sample names and a made-up
 * program only. When either app changes, these drawings change with it.
 */

import type { ReactNode } from "react";
import type { Tutorial, TutorialStep } from "./types";
import { Dialog, Header, Page, TeamRail, cx } from "./drawing";
import type { Device } from "./screens";

const TEAM = "Registration Team";
/** The Registration Team's rail: its two apps after Home. */
const LINKS = ["Home", "Registration", "Program Manager", "Updates", "Conversations", "Files", "Members"];
const PROGRAM = "Autumn Day of Mindfulness";
const HELP = ["Questions about programs or registration: ask Jesse."];

function teamPage(
  device: Device,
  active: string,
  children: ReactNode,
  { overlay, railHl, open = false }: { overlay?: ReactNode; railHl?: string; open?: boolean } = {},
) {
  return (
    <div className="tut-screen tut-screen--layer">
      <Page header={<Header device={device} />} rail={<TeamRail device={device} team={TEAM} active={active} links={LINKS} hl={railHl} open={open} />}>
        <div className={cx("tut-stack", (!!overlay || open) && "tut-dim")}>{children}</div>
      </Page>
      {overlay && <Dialog>{overlay}</Dialog>}
    </div>
  );
}

/* ---- Setting up a program ------------------------------------------------ */

function programsList(device: Device) {
  // The list as redrawn 2026-10-26: the kind under the name, quiet text actions.
  const rows: [string, string][] = [
    [PROGRAM, "Immersion · Day of mindfulness · In person"],
    ["Meditation and Dharma Talk", "Ongoing Learning & Practice · Drop-in · In person and online"],
    ["Foundations Course", "Foundations · Course · Online"],
  ];
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-h1">Programs</span>
      <span className="tut-meta">Every program, with its category, format, delivery and registration.</span>
      <span className="tut-week"><span className="tut-input tut-input--short">Search programs</span><span className="tut-btn">+ Add Program</span></span>
      <div className="tut-list">
        {rows.map(([name, facts]) => (
          <span key={name} className="tut-list__row">
            <span><b>{name}</b><small>{facts}</small></span>
            <span className="tut-actions"><span className="tut-link">People</span><span className="tut-link">Edit</span></span>
          </span>
        ))}
      </div>
    </>
  ), { railHl: "Program Manager", open: device === "phone" });
}

const SHAPES: [string, string][] = [
  ["Drop-in", "Open entry, online: people come as they are, with no registration and no questions."],
  ["Class", "Open entry, online, meeting weekly, with no registration."],
  ["Course", "Registration for the whole series, meeting weekly, the teacher’s two questions, dana invited, a reminder 2 days before."],
  ["Workshop", "Registration, the teacher’s two questions, dana invited, a reminder 2 days before."],
  ["Day of mindfulness", "Registration, in person, questions about arriving and dietary needs, dana invited, a reminder 2 days before."],
  ["Retreat", "Registration, in person, the teacher’s two questions and questions about arriving and dietary needs, dana invited, a reminder 2 days before."],
];

function shapesPage(device: Device) {
  // The page lists the shapes as rows, each with Start → at its end. A
  // computer shows all six; a phone is scrolled down to Day of mindfulness.
  const phone = device === "phone";
  const shown = phone ? SHAPES.slice(2, 5) : SHAPES;
  return teamPage(device, "Program Manager", (
    <>
      {!phone && (
        <>
          <span className="tut-link">← Programs</span>
          <span className="tut-h1">What are you offering?</span>
          <span className="tut-meta">Choose a shape to start from. Everything it fills in can be changed before you save.</span>
        </>
      )}
      <div className="tut-list">
        {shown.map(([name, sets]) => (
          <span key={name} className={cx("tut-list__row", name === "Day of mindfulness" && "hl")}>
            <span><b>{name}</b><small>{sets}</small></span>
            <span className="tut-onward">Start →</span>
          </span>
        ))}
      </div>
    </>
  ));
}

function copyPage(device: Device) {
  const past: [string, string][] = [
    ["Autumn Retreat", "Retreat · Nov 2025 · 24 places · 5 questions"],
    ["Spring Day of Mindfulness", "Day of mindfulness · Apr 2026 · 30 places · 3 questions"],
  ];
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-link tut-dim">Start with a blank program →</span>
      <span className="tut-h2">Or copy a program</span>
      <span className="tut-meta">A copy keeps the words, questions, teachers, helpers, dana and settings, and asks for the new dates. It never copies the people registered.</span>
      {past.map(([name, facts], i) => (
        <span key={name} className={cx("tut-choice", i === 0 && "hl")}>
          <b>{name}</b><small>{facts}</small><span className="tut-onward">Copy →</span>
        </span>
      ))}
      <span className="tut-label">Another program</span>
      <span className="tut-input">Choose a program ▾</span>
    </>
  ));
}

const SECTION_NAMES = ["About", "When and where", "Teachers and teams", "How people join", "Messages to those who register", "Dana", "Where it appears"];

/** The editor: its header, then on a computer the section list beside the
 *  sections, on a phone Jump to above them. */
function editor(
  device: Device,
  on: string,
  body: ReactNode,
  { navHl = false, overlay, top, scrolled = false, topOnly = false }: { navHl?: boolean; overlay?: ReactNode; top?: ReactNode; scrolled?: boolean; topOnly?: boolean } = {},
) {
  const head = (
    <>
      <span className="tut-week"><span className="tut-h1">Edit Program</span><span className="tut-link">View program page →</span></span>
      {top}
    </>
  );
  // A phone shows less at once: `scrolled` is the page scrolled down to its
  // body, `topOnly` the top of the page alone.
  if (device === "phone") {
    return teamPage(device, "Program Manager", (
      <>
        {!scrolled && head}
        {!scrolled && !topOnly && (
          <>
            <span className="tut-label">Jump to</span>
            <span className={cx("tut-input", navHl && "hl")}>{on} ▾</span>
          </>
        )}
        {!topOnly && body}
      </>
    ), { overlay });
  }
  return teamPage(device, "Program Manager", (
    <>
      {head}
      <div className="tut-split">
        <span className="tut-sections">
          {SECTION_NAMES.map((s) => <span key={s} className={cx(s === on && "on", s === on && navHl && "hl")}>{s}</span>)}
        </span>
        <div className="tut-stack">{body}</div>
      </div>
    </>
  ), { overlay });
}

function section(title: string, children: ReactNode) {
  return (
    <div className="tut-card">
      <span className="tut-h2">{title}</span>
      {children}
    </div>
  );
}

function aboutSection() {
  return section("About", (
    <>
      <span className="tut-label">Name</span>
      <span className="tut-input">{PROGRAM}</span>
      <span className="tut-label">Tagline</span>
      <span className="tut-input">A day of practice in silence, together.</span>
    </>
  ));
}

function teachersSection() {
  return section("Teachers and teams", (
    <>
      <span className="tut-label">Teacher / Facilitators</span>
      <span className="tut-input">Search teachers by name…</span>
      <span className="tut-pill">Pat L. ×</span>
      <span className="tut-label">Supporting teams</span>
      <span className="tut-check hl"><span className="tut-check__box">✓</span>Greeter Team</span>
      <span className="tut-label">Teams that prepare</span>
      <span className="tut-check"><span className="tut-check__box">✓</span>Kitchen Team</span>
    </>
  ));
}

function joinSection() {
  return section("How people join", (
    <>
      <span className="tut-hostbox"><b>How this appears to visitors</b>Registration is open. Visitors see a Register button. Once it&rsquo;s full, new sign-ups join the waiting list.</span>
      <span className="tut-label">Registration</span>
      <span className="tut-pills">
        <span>Off</span><span>Not open yet</span><span className="on hl">Open</span><span>Closed</span>
      </span>
      <span className="tut-meta">Visitors get a registration form.</span>
      <span className="tut-label">Capacity</span>
      <span className="tut-input tut-input--short">20</span>
    </>
  ));
}

function questionsSection() {
  return section("How people join", (
    <>
      <span className="tut-label">Custom Questions</span>
      <div className="tut-card">
        <span className="tut-input">Any dietary needs?</span>
        <span className="tut-input tut-input--short">Short text ▾</span>
        <span className="tut-label">Asked by</span>
        <span className="tut-input hl">The Kitchen Team ▾</span>
      </div>
      <span className="tut-btn tut-btn--ghost">+ Add Question</span>
    </>
  ));
}

function messagesSection() {
  return section("Messages to those who register", (
    <>
      <span className="tut-label">When they register</span>
      <span className="tut-area">What to bring, how to prepare…</span>
      <span className="tut-label">Before it begins</span>
      <span className="tut-pills"><span className="on hl">Days before</span><span>On a set date</span><span>No reminder</span></span>
      <span className="tut-input tut-input--short">2</span>
      <span className="tut-label">After it ends</span>
      <span className="tut-check"><span className="tut-check__box">✓</span>Send a note the day after</span>
    </>
  ));
}

function readyAndSave(device: Device) {
  return editor(device, "Where it appears", (
    <>
      {section("Where it appears", (
        <>
          <span className="tut-label">Category</span>
          <span className="tut-input">Immersion ▾</span>
        </>
      ))}
      <span className="tut-actions"><span className="tut-btn hl">Save</span><span className="tut-btn tut-btn--ghost">Cancel</span></span>
      <span className="tut-saved"><b>Created. It&rsquo;s saved.</b></span>
    </>
  ), {
    top: (
      <span className="tut-card">
        <span className="tut-label">Ready to be seen</span>
        <span className="tut-meta">✓ About: the name and description are in.</span>
        <span className="tut-meta">✓ How people join: registration is open; 20 places.</span>
      </span>
    ),
  });
}

function updatePanel(device: Device) {
  return editor(device, "When and where", (
    <>
      <span className="tut-actions"><span className="tut-btn">Save</span><span className="tut-meta">Saved at 2:14 PM. The people registered haven&rsquo;t heard: see below.</span></span>
      <div className="tut-card">
        <span className="tut-h2">Tell the people registered?</span>
        <span className="tut-meta">You changed the time. The 12 people registered still have it as it was. Here&rsquo;s an update to send them; change it as you like.</span>
        <span className="tut-label">Subject</span>
        <span className="tut-input">A change to {PROGRAM}</span>
        <span className="tut-area">There&rsquo;s a change to {PROGRAM}. When: November 14, 2026, 9:30 AM–4:00 PM CT</span>
        <span className="tut-actions"><span className="tut-btn">Send to the 12 people registered</span><span className="tut-btn tut-btn--ghost hl">Send me a test</span><span className="tut-btn tut-btn--ghost">Not now</span></span>
      </div>
    </>
  ), { scrolled: true });
}

function noticePanel(device: Device) {
  return editor(device, "About", null, {
    top: (
      <div className="tut-card">
        <span className="tut-label">Notice</span>
        <span className="tut-input">Cancelled tonight.</span>
        <span className="tut-label">Show until</span>
        <span className="tut-input tut-input--short">Nov 14, 2026</span>
        <span className="tut-check"><span className="tut-check__box">✓</span>Also email the 12 people registered</span>
        <span className="tut-actions"><span className="tut-btn hl">Post the notice</span><span className="tut-btn tut-btn--ghost">Close</span></span>
      </div>
    ),
    topOnly: true,
  });
}

const settingUpSteps: TutorialStep[] = [
  {
    title: "Open Programs",
    words: "In the Registration Team's space, open the ☰ beside the team's name and choose Program Manager. It opens on every program. Edit opens one to change it, and People opens the same program in Registration.",
    computer: { words: "In the Registration Team's space, choose Program Manager on the left. It opens on every program. Edit opens one to change it, and People opens the same program in Registration." },
    alt: "The team's menu with Program Manager marked, over the list of programs.",
  },
  {
    title: "Start a new program",
    words: "Choose + Add Program. The page asks What are you offering? Choose the one closest to yours: a drop-in, a class, a course, a workshop, a day of mindfulness or a retreat. Each fills in sensible starting settings. Nothing is saved until you choose Save.",
    tip: { lead: "Not sure?", text: "Choose Start with a blank program and fill in everything yourself." },
    alt: "What are you offering? with Day of mindfulness marked.",
  },
  {
    title: "Or copy one",
    words: "Under Or copy a program, choose a past program and choose Copy. It's the easiest way to set up next year's retreat. A copy keeps the words, the questions, the teachers, the teams, dana and the settings.",
    tip: { lead: "Never copied:", text: "the people who registered, the dates, the notice and the guest link. Set new dates before you save." },
    alt: "Or copy a program, with a past retreat marked.",
  },
  {
    title: "One page, seven sections",
    words: "A program is one page in seven sections, in the order you'd decide them: About, When and where, Teachers and teams, How people join, Messages to those who register, Dana, and Where it appears. Choose Jump to at the top to go straight to one.",
    computer: { words: "A program is one page in seven sections, in the order you'd decide them: About, When and where, Teachers and teams, How people join, Messages to those who register, Dana, and Where it appears. The list of sections sits beside the page; choose one to go straight to it." },
    alt: "The program's page with the way to its sections marked.",
  },
  {
    title: "Teachers and teams",
    words: "Under Teachers and teams, search for the teacher by name. Then tick the teams that help. The hosting team runs the live session. Supporting teams, such as greeters or AV, help on the day. Teams that prepare, such as a kitchen team, help ahead of time.",
    tip: { lead: "Ticked teams hear when you save.", text: "Leave the teams off until the program is real." },
    alt: "Teachers and teams with the Greeter Team ticked.",
  },
  {
    title: "Registration: off, not open yet, open or closed",
    words: "Under How people join, choose one: Off, for a program people simply come to; Not open yet, to start sign-ups on a date you choose; Open; or Closed. How this appears to visitors says in a sentence what a visitor will see. Read it before you save.",
    tip: { lead: "Capacity", text: "is the most who can register. Once it's full, new sign-ups join the waiting list." },
    alt: "The four registration choices with Open marked.",
  },
  {
    title: "The questions",
    words: "Choose + Add Question, type it, and choose its kind: Short text, Long text, Yes / No, or Select. Under Asked by, choose who reads the answers: the registration team, the teacher, or one of the program's teams.",
    tip: { lead: "Every answer", text: "is read by the registration team too. People see the questions grouped by who is asking." },
    alt: "A question with Asked by marked.",
  },
  {
    title: "The three emails",
    words: "Under Messages to those who register are the three emails, in the order people get them. When they register: the confirmation, for what to bring or directions. Before it begins: the reminder, usually 2 days before. After it ends: an optional note the morning after a one-time program.",
    alt: "Messages to those who register, with its three emails.",
  },
  {
    title: "Ready to be seen, then Save",
    words: "At the top, Ready to be seen marks anything that would keep the program from being seen or joined. Choose a line to go to its section. Then choose Save at the bottom of the screen. A new program says Created. It's saved.",
    tip: { lead: "Something missing?", text: "The note beside Save says which section to look in, such as \"Under When and where: …\"" },
    alt: "Ready to be seen at the top, and Save marked.",
  },
  {
    title: "Tell the people registered",
    words: "If people have registered and you change the time, the place or the confirmation, they still have the old details. After you save, Tell the people registered? offers an email with the new details written in. Choose Send me a test, read it, then send it.",
    tip: { lead: "Not a registrar?", text: "You'll be told the registration team needs to send it." },
    alt: "Tell the people registered? with Send me a test marked.",
  },
  {
    title: "Post a notice",
    words: "For news people need right away, like \"Cancelled tonight\", choose Post a notice at the top. Type one line, choose Show until (the last day it shows), and choose Post the notice. It shows on the program's page, in the listings and on My Home.",
    tip: { lead: "Registrars", text: "can also email it to the people registered." },
    alt: "The notice with Post the notice marked.",
  },
];

function settingUpScreens(device: Device) {
  return [
    programsList(device),
    shapesPage(device),
    copyPage(device),
    editor(device, "About", aboutSection(), { navHl: true }),
    editor(device, "Teachers and teams", teachersSection()),
    editor(device, "How people join", joinSection()),
    editor(device, "How people join", questionsSection()),
    editor(device, "Messages to those who register", messagesSection()),
    readyAndSave(device),
    updatePanel(device),
    noticePanel(device),
  ];
}

/* ---- Looking after the people -------------------------------------------- */

function teamHome(device: Device) {
  return teamPage(device, "Home", (
    <>
      <span className="tut-h1">{TEAM}</span>
      <span className="tut-meta">Your team&rsquo;s shared space.</span>
      <div className="tut-card">
        <span className="tut-eyebrow">This team&rsquo;s tool</span>
        <span className="tut-h2">Registration</span>
        <span className="tut-meta">3 new registrations in the last seven days</span>
        <span className="tut-btn hl">Open Registration</span>
      </div>
      <div className="tut-list">
        <span className="tut-list__row"><span><b>Conversations</b><small>Read and join team discussions</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Files</b><small>Find documents and shared resources</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Members</b><small>Find the people on your team</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Program Manager</b><small>Open this team&rsquo;s Program Manager</small></span><span>→</span></span>
      </div>
    </>
  ));
}

function deskItem(program: string, text: string, button: string, hl = false) {
  return (
    <span className="tut-list__row">
      <span><small>{program}</small><b>{text}</b></span>
      <span className={cx("tut-btn tut-btn--ghost tut-btn--sm", hl && "hl")}>{button}</span>
    </span>
  );
}

function desk(device: Device) {
  return teamPage(device, "Registration", (
    <>
      <span className="tut-meta">What needs a person, then every program with registration on.</span>
      <span className="tut-h2">Needs you</span>
      <div className="tut-list">
        {deskItem(PROGRAM, "8 places are open, and 2 people are waiting.", "See who’s waiting", true)}
        {deskItem("Autumn Retreat", "3 people haven’t finished their dana.", "See who")}
      </div>
      <span className="tut-h2">Going out soon</span>
      <div className="tut-list">
        {deskItem(PROGRAM, "The reminder, Thursday, Nov 12, at 8 AM", "Open the program")}
      </div>
    </>
  ));
}

type Person = { name: string; status: string; dana: string; when: string };
const PEOPLE: Person[] = [
  { name: "Ann L.", status: "Registered", dana: "Received", when: "Oct 20" },
  { name: "Ben K.", status: "Registered", dana: "Not finished", when: "Oct 22" },
  { name: "Cara M.", status: "Waiting #1", dana: "", when: "Oct 25" },
];

/** A program's page in Registration. On a phone, `scrolled` is the page
 *  scrolled down past its heading. */
function programPage(device: Device, children: ReactNode, { overlay, scrolled = false }: { overlay?: ReactNode; scrolled?: boolean } = {}) {
  const head = !(scrolled && device === "phone");
  return teamPage(device, "Registration", (
    <>
      {head && (
        <>
          <span className="tut-link">← All programs</span>
          <span className="tut-h1">{PROGRAM}</span>
          <span className="tut-p"><b>Open until Nov 6</b> · 12 of 20 places taken · 2 waiting</span>
        </>
      )}
      {children}
    </>
  ), { overlay });
}

function peopleTab(filter: string, { hlFilter = false, hlRow, rows = PEOPLE }: { hlFilter?: boolean; hlRow?: string; rows?: Person[] } = {}) {
  const pills = ["All", "Registered", "Waiting", "Dana not finished", "Cancelled"];
  return (
    <>
      <span className="tut-tabs"><span className="on">People</span><span>History</span></span>
      <span className="tut-pills">
        {pills.map((p) => <span key={p} className={cx(p === filter && "on", p === filter && hlFilter && "hl")}>{p}</span>)}
      </span>
      <span className="tut-input">Search by name or email</span>
      <div className="tut-list">
        {rows.map((p) => (
          <span key={p.name} className={cx("tut-list__row", p.name === hlRow && "hl")}>
            <span><b>{p.name}</b><small>{p.status}{p.dana ? ` · Dana: ${p.dana}` : ""}</small></span>
            <span className="tut-meta">{p.when}</span>
          </span>
        ))}
      </div>
    </>
  );
}

/** A person's card: the parts in the app's order, `parts` choosing which show. */
function card(
  name: string,
  parts: { place?: ReactNode; dana?: ReactNode; answers?: boolean; notes?: boolean; hl?: boolean },
) {
  return (
    <div className={cx("tut-card", parts.hl && "hl")}>
      <span className="tut-h2">{name}</span>
      <span className="tut-label">Contact</span>
      <span className="tut-meta">{name.split(" ")[0].toLowerCase()}@example.com · (555) 010-0142</span>
      {parts.place && (<><span className="tut-label">Their place</span>{parts.place}</>)}
      {parts.dana && (<><span className="tut-label">Dana</span>{parts.dana}</>)}
      {parts.answers && (<><span className="tut-label">Their answers</span><span className="tut-meta">Any dietary needs? Vegetarian</span></>)}
      {parts.notes && (<><span className="tut-label">Notes</span><span className="tut-meta">Add a note for the registration team</span></>)}
    </div>
  );
}

function addPanel(device: Device) {
  return programPage(device, (
    <div className="tut-card">
      <span className="tut-h2">Add a person</span>
      <span className="tut-meta">For someone who phoned, wrote, or signed up on paper. If their email belongs to a member, it&rsquo;s added to their account.</span>
      <span className="tut-week"><span className="tut-input tut-input--short">Rosa</span><span className="tut-input tut-input--short">T.</span></span>
      <span className="tut-input">rosa@example.com</span>
      <span className="tut-label">Dana</span>
      <span className="tut-pills"><span>They&rsquo;ll give online</span><span className="on">Given by cash or check</span><span>No dana</span></span>
      <span className="tut-check"><span className="tut-check__box">✓</span>Email them their confirmation email</span>
      <span className="tut-actions"><span className="tut-btn hl">Add them</span><span className="tut-btn tut-btn--ghost">Cancel</span></span>
    </div>
  ));
}

function messagePanel(device: Device) {
  return programPage(device, (
    <div className="tut-card">
      <span className="tut-h2">Message people</span>
      <span className="tut-meta">An email from the registration team about {PROGRAM}. Replies come to the registrar&rsquo;s inbox, and it&rsquo;s kept in History.</span>
      <span className="tut-label">To</span>
      <span className="tut-input">Everyone registered (12) ▾</span>
      <span className="tut-label">Subject</span>
      <span className="tut-input">Parking on the day</span>
      <span className="tut-area">The lot behind the building is open from 8:30.</span>
      <span className="tut-actions"><span className="tut-btn">Send to 12 people</span><span className="tut-btn tut-btn--ghost hl">Send me a test</span><span className="tut-btn tut-btn--ghost">Cancel</span></span>
    </div>
  ), { scrolled: true });
}

function settingsFold(device: Device) {
  return programPage(device, (
    <div className="tut-card">
      <span className="tut-label">Registration settings <span className="tut-meta">Open until Nov 6 · 20 places · mailing list on</span></span>
      <span className="tut-label">Registration</span>
      <span className="tut-input tut-input--short">Open ▾</span>
      <span className="tut-label">Places</span>
      <span className="tut-input tut-input--short">20</span>
      <span className="tut-label">Closes</span>
      <span className="tut-input tut-input--short">Nov 6, 2026, 11:59 PM</span>
      <span className="tut-label">Mailing list</span>
      <span className="tut-input tut-input--short">On ▾</span>
      <span className="tut-btn hl">Save settings</span>
    </div>
  ), { scrolled: true });
}

function historyTab(device: Device) {
  const lines: [string, string][] = [
    ["Oct 26, 2:10 PM", "Pat L. sent a message to 12 people: Parking on the day"],
    ["Oct 25, 9:02 AM", "Rosa T. · Pat L. added them"],
    ["Oct 24, 4:31 PM", "Ann L. · Pat L. marked dana received"],
    ["Oct 22, 11:15 AM", "Ben K. · Registered"],
  ];
  return programPage(device, (
    <>
      <span className="tut-tabs"><span>People</span><span className="on">History</span></span>
      <span className="tut-actions">
        <span className="tut-btn tut-btn--ghost tut-btn--sm hl">Print a sign-in list</span>
        <span className="tut-btn tut-btn--ghost tut-btn--sm">Download a spreadsheet</span>
      </span>
      <div className="tut-list">
        {lines.map(([when, text]) => (
          <span key={when} className="tut-list__row"><span><small>{when}</small>{text}</span></span>
        ))}
      </div>
    </>
  ), { scrolled: true });
}

const lookingAfterSteps: TutorialStep[] = [
  {
    title: "Open Registration",
    words: "On the Registration Team's Home, choose Open Registration.",
    tip: { lead: "Don't see Registration?", text: "Registration opens only for registrars, the guiding teacher and admins, because it holds people's details." },
    alt: "The Registration Team's Home with Open Registration marked.",
  },
  {
    title: "What needs you",
    words: "Registration opens on Needs you: anything across every program that is waiting for a person, such as \"A place is open, and 2 people are waiting.\" Each has a button that takes you to them. Below are Going out soon, the reminders and notes that send themselves, and Programs with registration on.",
    alt: "Needs you, with See who's waiting marked.",
  },
  {
    title: "A program's people",
    words: "Choose a program. The top line says where it stands, such as \"Open until Nov 6 · 12 of 20 places taken.\" Under People, the buttons show everyone, or only those Registered, Waiting, with Dana not finished, or Cancelled. Search finds a name or email.",
    alt: "A program's People with its buttons, and one person marked.",
  },
  {
    title: "A person's card",
    words: "Choose a name to open their card: Contact, Their place, Dana, Their answers, Notes for the registration team, and History. Each part has its own buttons.",
    alt: "A person's card with its parts.",
  },
  {
    title: "It asks first",
    words: "Anything that emails someone, or changes their place or their dana, asks first in plain words, and says whether they will be emailed. Choose the button that begins with Yes to go ahead, or Never mind. The answer appears right there.",
    alt: "A question asked in the card before acting, with its Yes button marked.",
  },
  {
    title: "Add someone who phoned",
    words: "Choose Add a person. Fill in their name, email and phone, and their answers. If the program invites dana, choose They'll give online, Given by cash or check, or No dana. Choose Add them.",
    tip: { lead: "Full?", text: "They join the waiting list instead. If they'll give online, they get the link to give first, and the confirmation follows." },
    alt: "Add a person with Add them marked.",
  },
  {
    title: "Give a place to someone waiting",
    words: "Choose Waiting, open the card of the person first in line, and choose Offer them a place, then Yes, register and email them. They're told their place is confirmed.",
    alt: "A waiting person's card with Offer them a place marked.",
  },
  {
    title: "Dana given another way",
    words: "Choose Dana not finished and open their card. Under Dana, choose Given another way, then Yes, mark it received. Or choose Send a dana reminder, or No dana for them.",
    alt: "A person's Dana with Given another way marked.",
  },
  {
    title: "Cancel, or put back",
    words: "On their card, choose Cancel their registration. The box to email them is ticked; untick it if you've told them yourself. Choose Yes, cancel it.",
    tip: { lead: "A mistake?", text: "Choose Cancelled, open their card, and choose Restore their registration." },
    alt: "Cancel their registration's question, with the email box and Yes, cancel it.",
  },
  {
    title: "Message people",
    words: "Choose Message people. Choose who it goes to, write a subject and a message, and choose Send me a test. Read it in your inbox, then send it. Replies come to the registrar's inbox.",
    tip: { lead: "More than 50 people?", text: "Use the program's Flodesk mailing list instead." },
    alt: "Message people with Send me a test marked.",
  },
  {
    title: "Registration settings",
    words: "Choose Registration settings to open it. Set Registration (Open, Not open yet or Closed), Opens, Places, Closes and the Mailing list, then choose Save settings. Times are Central. Closing never takes anyone's place away.",
    alt: "Registration settings with Save settings marked.",
  },
  {
    title: "History, the sign-in list and the spreadsheet",
    words: "History lists everything that happened, and who did it. Print a sign-in list gives names and a box to tick, for the door. Download a spreadsheet gives everyone and their answers.",
    alt: "History, with Print a sign-in list marked.",
  },
];

function lookingAfterScreens(device: Device) {
  // The app asks inside the card, in place of the button (ConfirmBox).
  const confirm = (text: string, yes: string, children?: ReactNode) => (
    <span className="tut-hostbox">
      <span className="tut-p">{text}</span>
      {children}
      <span className="tut-actions"><span className="tut-btn hl">{yes}</span><span className="tut-btn tut-btn--ghost">Never mind</span></span>
    </span>
  );
  return [
    teamHome(device),
    desk(device),
    programPage(device, peopleTab("All", { hlRow: "Ben K." })),
    programPage(device, card("Ben K.", {
      place: <span className="tut-p">Registered</span>,
      dana: <span className="tut-p">Not finished</span>,
      answers: true,
      notes: true,
      hl: true,
    }), { scrolled: true }),
    programPage(device, card("Ben K.", {
      place: <span className="tut-p">Registered</span>,
      dana: (
        <>
          <span className="tut-p">Not finished</span>
          {confirm("Mark Ben K.’s dana as received, given by cash or check? They won’t be emailed.", "Yes, mark it received")}
        </>
      ),
    }), { scrolled: true }),
    addPanel(device),
    programPage(device, card("Cara M.", {
      place: (
        <>
          <span className="tut-p">Waiting, number 1 in line</span>
          <span className="tut-btn hl">Offer them a place</span>
        </>
      ),
    })),
    programPage(device, card("Ben K.", {
      dana: (
        <>
          <span className="tut-p">Not finished</span>
          <span className="tut-actions"><span className="tut-btn tut-btn--sm">Send a dana reminder</span><span className="tut-btn tut-btn--ghost tut-btn--sm hl">Given another way</span><span className="tut-btn tut-btn--ghost tut-btn--sm">No dana for them</span></span>
        </>
      ),
    })),
    programPage(device, card("Ann L.", {
      place: (
        <>
          <span className="tut-p">Registered</span>
          {confirm("Cancel Ann L.’s registration?", "Yes, cancel it",
            <span className="tut-check"><span className="tut-check__box">✓</span>Email Ann at ann@example.com to say so</span>)}
        </>
      ),
    }), { scrolled: true }),
    messagePanel(device),
    settingsFold(device),
    historyTab(device),
  ];
}

export const REGISTRATION_TUTORIALS: Tutorial[] = [
  {
    slug: "setting-up-a-program",
    title: "Setting up a program",
    forWhom: "For the Registration Team",
    summary: "Starting a program from a shape or a copy, the seven sections, registration and the questions, the three emails, saving, and telling people about a change.",
    nextTutorial: "looking-after-the-people",
    steps: settingUpSteps,
    screens: { phone: settingUpScreens("phone"), computer: settingUpScreens("computer") },
    help: HELP,
  },
  {
    slug: "looking-after-the-people",
    title: "Looking after the people",
    forWhom: "For the Registration Team",
    summary: "The Registration app: what needs you, a program's people, adding someone, the waiting list, dana, cancelling, messages, settings and History.",
    steps: lookingAfterSteps,
    screens: { phone: lookingAfterScreens("phone"), computer: lookingAfterScreens("computer") },
    help: HELP,
  },
];
