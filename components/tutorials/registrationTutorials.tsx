/**
 * For the Registration Team (2026-10-26, Jesse: "a Registration Team section
 * to the site's Tutorials, with the two tutorials drawn from the screens";
 * the wording read and approved the same day). Setting up a program draws the
 * step-by-step setup and a program's page (redrawn 2026-10-28 when they
 * replaced the one-page editor: components/programSetup/*, the start page
 * app/tools/programs/new; wording provisional until Jesse's read-aloud); Looking after the
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
          <span className="tut-meta">Choose a shape to start from. It fills in answers, and you&rsquo;ll still see each one as you go. Nothing is published until you say so.</span>
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


/** The walk-through (2026-10-28): one question in a card, and the answers so
 *  far beside it on a computer, folded above it on a phone. */
function walk(device: Device, where: string, question: string, body: ReactNode, answers: [string, string[]][], continueHl = false) {
  const card = (
    <div className="tut-card">
      <span className="tut-meta">{where}</span>
      <span className="tut-h2">{question}</span>
      {body}
      <span className="tut-actions"><span className={cx("tut-btn", continueHl && "hl")}>Continue</span><span className="tut-link">← Back</span></span>
    </div>
  );
  const head = (
    <>
      <span className="tut-h1">{PROGRAM}</span>
      <span className="tut-meta"><b>Draft</b> · Saved as you go. No one sees it, and no team is told, until you publish.</span>
    </>
  );
  if (device === "phone") {
    return teamPage(device, "Program Manager", (
      <>
        {head}
        <span className="tut-list__row"><span><b>Your answers so far</b></span><span>▾</span></span>
        {card}
      </>
    ));
  }
  return teamPage(device, "Program Manager", (
    <>
      {head}
      <div className="tut-split tut-split--trail">
        {card}
        <span className="tut-sections">
          <span className="on">Your answers so far</span>
          {answers.map(([sec, items]) => (
            <span key={sec}><b>{sec}</b>{items.map((x) => <small key={x} style={{ display: "block" }}>{x}</small>)}</span>
          ))}
        </span>
      </div>
    </>
  ));
}

const SO_FAR: [string, string[]][] = [
  ["About", [PROGRAM, "A day of practice in silence, together."]],
  ["When and where", ["In person", "At RIM", "Once"]],
];

function firstQuestion(device: Device) {
  return walk(device, "About · 1 of 4", "What is it called?", (
    <>
      <span className="tut-label">Name</span>
      <span className="tut-input hl">{PROGRAM}</span>
      <span className="tut-meta">Its address: rootedinmindfulness.org/programs/autumn-day-of-mindfulness</span>
    </>
  ), [["About", ["You're here"]]], true);
}

function whenQuestion(device: Device) {
  const days = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];
  return walk(device, "When and where · 5 of 6", "Which day?", (
    <>
      <span className="tut-label">The day · November 2026</span>
      <span className="tut-pills">
        {days.map((d) => <span key={d} className={cx(d === "14" && "on hl", Number(d) < 2 && "tut-dim")}>{d}</span>)}
      </span>
      <span className="tut-hostbox"><b>What you&rsquo;ve set up</b>Saturday, November 14, 9:30 AM to 4 PM.</span>
    </>
  ), SO_FAR);
}

function teamsQuestion(device: Device) {
  return walk(device, "Teachers and teams · 3 of 4", "Which teams help at each session?", (
    <>
      <span className="tut-check hl"><span className="tut-check__box">✓</span>Greeter Team</span>
      <span className="tut-check"><span className="tut-check__box"></span>Audio-Visual Team</span>
      <span className="tut-meta">Each team hears about it when you publish, not before.</span>
    </>
  ), [...SO_FAR, ["Teachers and teams", ["Pat L."]]]);
}

function joinQuestion(device: Device) {
  return walk(device, "How people join · 1 of 4", "How do people join?", (
    <>
      <span className="tut-choice"><b>They just come</b><small>Anyone signed in may join, with no sign-up.</small></span>
      <span className="tut-choice tut-choice--on hl"><b>They register first</b><small>Each person signs up and gets a place.</small></span>
      <span className="tut-choice"><b>Both</b><small>People can register, and anyone signed in may also just come.</small></span>
    </>
  ), [...SO_FAR, ["Teachers and teams", ["Pat L.", "Greeter Team"]]]);
}

function questionsQuestion(device: Device) {
  return walk(device, "How people join · 4 of 4", "What would you like to ask them?", (
    <>
      <div className="tut-card">
        <span className="tut-label">Question 1</span>
        <span className="tut-input">Any dietary needs?</span>
        <span className="tut-label">Asked by</span>
        <span className="tut-input hl">The Kitchen Team ▾</span>
      </div>
      <span className="tut-link">+ Add a question</span>
    </>
  ), [...SO_FAR, ["How people join", ["They register first", "20 places"]]]);
}

function reminderQuestion(device: Device) {
  return walk(device, "Messages to those who register · 2 of 3", "When should the reminder go?", (
    <>
      <span className="tut-choice tut-choice--on hl"><b>Days before the first session</b><small>In the morning, and to anyone who registers later.</small></span>
      <span className="tut-choice"><b>On a set date</b></span>
      <span className="tut-choice"><b>No reminder</b></span>
      <span className="tut-input tut-input--short">2</span>
    </>
  ), [...SO_FAR, ["Messages to those who register", ["Confirmation written"]]]);
}

function setupCard(title: string, lines: string[], hl = false) {
  return (
    <div className="tut-card">
      <span className="tut-week"><span className="tut-h2">{title}</span><span className={cx("tut-link", hl && "hl")}>Change</span></span>
      {lines.map((l) => <span key={l} className="tut-meta">{l}</span>)}
    </div>
  );
}

function reviewPage(device: Device) {
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-h1">{PROGRAM}</span>
      <span className="tut-meta"><b>Draft</b> · here&rsquo;s everything, as people will see it.</span>
      {device === "computer" && setupCard("About", [`It's called ${PROGRAM}.`, "The description is written, with a picture."])}
      {setupCard("When and where", ["In person at RIM.", "Saturday, November 14, 9:30 AM to 4 PM."])}
      <div className="tut-card">
        <span className="tut-h2">When you publish</span>
        <span className="tut-meta">It appears on Programs &amp; Events under Immersion, and on This Week.</span>
        <span className="tut-meta">Registration opens.</span>
        <span className="tut-meta">The Greeter Team is told, and can sign up for sessions.</span>
        <span className="tut-actions"><span className="tut-btn hl">Publish</span><span className="tut-link">Keep it as a draft</span></span>
      </div>
    </>
  ));
}

function setupProgramPage(device: Device) {
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-link">← Programs</span>
      <span className="tut-h1">{PROGRAM}</span>
      <span className="tut-meta"><b>Published</b> · on Programs &amp; Events and This Week · 12 people registered</span>
      <span className="tut-actions"><span className="tut-link">View its page ↗</span><span className="tut-link">People</span><span className="tut-link">Post a notice</span></span>
      {setupCard("When and where", ["In person at RIM.", "Saturday, November 14, 9:30 AM to 4 PM."], true)}
      {device === "computer" && setupCard("Teachers and teams", ["Taught by Pat L.", "The Greeter Team helps at each session."])}
    </>
  ));
}

function beforeYouSave(device: Device) {
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-h1">Before you save</span>
      <span className="tut-meta">Here&rsquo;s what this change does. Nothing has happened yet.</span>
      <div className="tut-card">
        <span className="tut-h2">What this changes</span>
        <span className="tut-meta">Every session&rsquo;s time changes, from 9:30 AM to 4 PM to 10 AM to 4 PM.</span>
        <span className="tut-meta">The 12 people registered haven&rsquo;t heard about the change to the time. After you save, you&rsquo;ll be offered an update to send them.</span>
        <span className="tut-actions"><span className="tut-btn hl">Save this change</span><span className="tut-link">Back to the questions</span></span>
      </div>
    </>
  ));
}

function updatePanel(device: Device) {
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-h1">{PROGRAM}</span>
      <span className="tut-saved"><b>Saved at 2:14 PM.</b></span>
      <div className="tut-card">
        <span className="tut-h2">Tell the people registered?</span>
        <span className="tut-meta">You changed the time. The 12 people registered still have it as it was. Here&rsquo;s an update to send them; change it as you like.</span>
        <span className="tut-label">Subject</span>
        <span className="tut-input">A change to {PROGRAM}</span>
        <span className="tut-actions"><span className="tut-btn">Send to the 12 people registered</span><span className="tut-link hl">Send me a test</span><span className="tut-link">Not now</span></span>
      </div>
    </>
  ));
}

function noticePanel(device: Device) {
  return teamPage(device, "Program Manager", (
    <>
      <span className="tut-h1">{PROGRAM}</span>
      <div className="tut-card">
        <span className="tut-label">Notice</span>
        <span className="tut-input">Cancelled tonight.</span>
        <span className="tut-label">Show until</span>
        <span className="tut-input tut-input--short">Nov 14, 2026</span>
        <span className="tut-check"><span className="tut-check__box">✓</span>Also email the 12 people registered</span>
        <span className="tut-actions"><span className="tut-btn hl">Post the notice</span><span className="tut-link">Close</span></span>
      </div>
    </>
  ));
}

const settingUpSteps: TutorialStep[] = [
  {
    title: "Open Programs",
    words: "In the Registration Team's space, open the ☰ beside the team's name and choose Program Manager. It opens on every program. Choose a program's name to open its page, and People to see the people in Registration.",
    computer: { words: "In the Registration Team's space, choose Program Manager on the left. It opens on every program. Choose a program's name to open its page, and People to see the people in Registration." },
    alt: "The team's menu with Program Manager marked, over the list of programs.",
  },
  {
    title: "Start a new program",
    words: "Choose + Add Program. The page asks What are you offering? Choose the one closest to yours: a drop-in, a class, a course, a workshop, a day of mindfulness or a retreat. It fills in sensible answers and walks you through each one.",
    tip: { lead: "Not sure?", text: "Choose Start with a blank program and answer everything yourself." },
    alt: "What are you offering? with Day of mindfulness marked.",
  },
  {
    title: "Or copy one",
    words: "Under Or copy a program, choose a past program. It's the easiest way to set up next year's retreat. A copy keeps the words, the questions, the teachers, the teams, dana and the settings, and asks for the new dates.",
    tip: { lead: "Never copied:", text: "the people who registered, the dates, the notice and the guest link." },
    alt: "Or copy a program, with a past retreat marked.",
  },
  {
    title: "One question at a time",
    words: "It asks one question at a time, in seven parts: About, When and where, Teachers and teams, How people join, Messages to those who register, Dana, and Where it appears. Answer and choose Continue. ← Back goes to the one before. Your answers so far fold above the question: tap it to see them, and tap any answer to go back to it.",
    computer: { words: "It asks one question at a time, in seven parts: About, When and where, Teachers and teams, How people join, Messages to those who register, Dana, and Where it appears. Answer and choose Continue. ← Back goes to the one before. Your answers so far sit beside the question: choose any answer to go back to it." },
    tip: { lead: "It's a draft.", text: "It's saved as you go, so you can stop and come back. No one sees it until you publish." },
    alt: "The first question, What is it called?, with Continue marked.",
  },
  {
    title: "When it meets",
    words: "When and where asks how often it meets, which days, and what time, with the length shown. Then the first session: only the days it meets can be chosen. For a series, it asks how it ends and lists every session.",
    tip: { lead: "Changed your mind?", text: "Go back and change it. What still fits is kept; anything that needs choosing again is marked." },
    alt: "The calendar for the day, with Saturday, November 14 marked.",
  },
  {
    title: "Teachers and teams",
    words: "Teachers and teams asks who teaches it, then which teams help at each session, such as greeters, and whether a team prepares, such as the kitchen.",
    tip: { lead: "Teams hear when you publish,", text: "not before." },
    alt: "Which teams help at each session? with the Greeter Team ticked.",
  },
  {
    title: "How people join",
    words: "Choose They just come, for a program people simply arrive at; They register first; or Both. If people register, it asks when registration opens and closes, and how many places.",
    tip: { lead: "Places:", text: "once it's full, new sign-ups join the waiting list." },
    alt: "How do people join? with They register first marked.",
  },
  {
    title: "The questions",
    words: "Add each question and choose its kind of answer. Under Asked by, choose who reads the answers: the registration team, the teacher, or a team that prepares.",
    tip: { lead: "Every answer", text: "is read by the registration team too. People see the questions grouped by who is asking." },
    alt: "A question with Asked by marked.",
  },
  {
    title: "The three emails",
    words: "Messages to those who register asks what the confirmation should say, when the reminder goes (usually 2 days before), and, for a one-time program, whether a note goes the day after.",
    alt: "When should the reminder go? with Days before marked.",
  },
  {
    title: "Review, then Publish",
    words: "At the end, everything is shown as sentences, each part with Change. When you publish says what publishing sets off: where it's listed, registration opening, the teams told. Choose Publish when it's right, or Keep it as a draft.",
    tip: { lead: "Something missing?", text: "Publish waits, and says what's missing. Choose the line to go to its question." },
    alt: "The review with When you publish and Publish marked.",
  },
  {
    title: "Changing it later",
    words: "A program's page shows each part in sentences, with Change. Change asks just that part's questions. At the end, Before you save says what the change will do, such as sessions that move or people who are told, before anything happens. Then choose Save this change.",
    alt: "A program's page with Change marked beside When and where.",
  },
  {
    title: "Before you save",
    words: "Read what the change does. Save this change makes it; Back to the questions lets you change your answers; nothing happens until you save.",
    alt: "Before you save, with Save this change marked.",
  },
  {
    title: "Tell the people registered",
    words: "If people have registered and you change the time, the place or the confirmation, they still have the old details. After you save, Tell the people registered? offers an email with the new details written in. Choose Send me a test, read it, then send it.",
    tip: { lead: "Not a registrar?", text: "You'll be told the registration team needs to send it." },
    alt: "Tell the people registered? with Send me a test marked.",
  },
  {
    title: "Post a notice",
    words: "For news people need right away, like \"Cancelled tonight\", choose Post a notice on the program's page. Type one line, choose Show until (the last day it shows), and choose Post the notice. It shows on the program's page, in the listings and on My Home.",
    tip: { lead: "Registrars", text: "can also email it to the people registered." },
    alt: "The notice with Post the notice marked.",
  },
];

function settingUpScreens(device: Device) {
  return [
    programsList(device),
    shapesPage(device),
    copyPage(device),
    firstQuestion(device),
    whenQuestion(device),
    teamsQuestion(device),
    joinQuestion(device),
    questionsQuestion(device),
    reminderQuestion(device),
    reviewPage(device),
    setupProgramPage(device),
    beforeYouSave(device),
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
      <span className={cx("tut-link", hl && "hl")}>{button}</span>
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
      <span className="tut-actions"><span className="tut-btn hl">Add them</span><span className="tut-link">Cancel</span></span>
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
      <span className="tut-actions"><span className="tut-btn">Send to 12 people</span><span className="tut-link hl">Send me a test</span><span className="tut-link">Cancel</span></span>
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
        <span className="tut-link hl">Print a sign-in list</span>
        <span className="tut-link">Download a spreadsheet</span>
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
      <span className="tut-actions"><span className="tut-btn hl">{yes}</span><span className="tut-link">Never mind</span></span>
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
          <span className="tut-link hl">Offer them a place</span>
        </>
      ),
    })),
    programPage(device, card("Ben K.", {
      dana: (
        <>
          <span className="tut-p">Not finished</span>
          <span className="tut-actions"><span className="tut-link">Send a dana reminder</span><span className="tut-link hl">Given another way</span><span className="tut-link">No dana for them</span></span>
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
    summary: "Starting a program from a shape or a copy, one question at a time, when it meets, registration and the questions, the three emails, the review and Publish, changing it later, and telling people about a change.",
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
