/**
 * The Scheduler, one tutorial per team that uses it (2026-10-21, Jesse: "make
 * one for using the scheduler for each team. Let's set each team up for
 * success."). One recipe, set with each team's own words, so a greeter never
 * reads "host" and the four can't drift apart.
 *
 * The words are the teams' coverage copy as it stood in production on
 * 2026-10-21 (Hub.coverageNoun / coverageVerb / coverageAction) and the
 * Scheduler's own labels (components/HubScheduleClient.tsx,
 * components/HubActivityClient.tsx). If a team's words change in /admin/hubs,
 * change its entry here. Two shapes, as in the app (RIM_Scheduler.md):
 * single-slot teams take a session and ask for cover; an open sign-up team
 * (greeters) signs up, several to a session, and cancels its own sign-up.
 *
 * The sessions are examples from each team's real programs, in the week of
 * Monday, October 26, 2026. Wording provisional until Jesse's read-aloud.
 */

import type { ReactNode } from "react";
import type { Tutorial, TutorialStep } from "./types";
import { ScheduleRow, SignUpState } from "./drawing";
import {
  DialogActions, TodayRow, codeScreen, myHomeScreen, myTeamsScreen, needsYouScreen, phoneMenuScreen,
  schedulerScreen, signInScreen, teamHomeScreen, type Device,
} from "./screens";

type Session = { day: string; date: string; full: string; short: string; time: string; program: string; format: string };

type Team = {
  slug: string;
  /** The team's name, as on My Teams. */
  team: string;
  /** "hosts", "guides": who the tutorial is for, in the index's title. */
  people: string;
  forWhom: string;
  noun: string;
  verb: string;
  action: string;
  /** "a host", "AV": needsRoleOf in lib/hubApps.ts. */
  needs: string;
  /** Open sign-up (greeters): several to a session, no cover requests. */
  openSignUp: boolean;
  /** Four example sessions: yours, open, someone else's, a cover request. */
  sessions: [Session, Session, Session, Session];
  weekCount: number;
  /** The last step: what My Home shows on the day, and where to go on. */
  onTheDay: { pill: string; open?: boolean; place?: string; button?: string; lines: string[]; words: string; tip?: { lead: string; text: string }; next?: { href: string; label: string } };
};

const s = (day: string, date: string, full: string, short: string, time: string, program: string, format: string): Session =>
  ({ day, date, full, short, time, program, format });

const ART = "The Art of Meditation";
const TALK = "Meditation and Dharma Talk";
const BOTH = "In-person and virtual";

export const SCHEDULER_TEAMS: Team[] = [
  {
    slug: "scheduler-for-hosts",
    team: "Hosting Team",
    people: "hosts",
    forWhom: "For the Hosting Team",
    noun: "Host", verb: "hosting", action: "host this", needs: "a host",
    openSignUp: false,
    sessions: [
      s("MON", "26", "Monday, October 26", "Mon, Oct 26", "9:30 AM", "Awakening The Heart", "Virtual"),
      s("TUE", "27", "Tuesday, October 27", "Tue, Oct 27", "9:30 AM", ART, BOTH),
      s("THU", "29", "Thursday, October 29", "Thu, Oct 29", "9:30 AM", "Essential Dharma Study", "Virtual"),
      s("SAT", "31", "Saturday, October 31", "Sat, Oct 31", "9:30 AM", TALK, BOTH),
    ],
    weekCount: 4,
    onTheDay: {
      pill: "Host entry open", open: true, place: "Online on Zoom", button: "Enter Zoom as host",
      lines: ["Member entry opens at 9:20 AM"],
      words: "From 30 minutes before the start, My Home shows Enter Zoom as host on the session you're hosting. Choose it to open the room.",
      tip: { lead: "The Scheduler works too.", text: "In that same window your session shows Enter room." },
      next: { href: "/tutorials/hosting-on-zoom#step-2", label: "Next: the host code and Claim Host in Zoom →" },
    },
  },
  {
    slug: "scheduler-for-guides",
    team: "Peer-Led Silent Meditation",
    people: "guides",
    forWhom: "For the guides of Peer-Led Silent Meditation",
    noun: "Facilitator", verb: "facilitating", action: "facilitate", needs: "a facilitator",
    openSignUp: false,
    sessions: [
      s("TUE", "27", "Tuesday, October 27", "Tue, Oct 27", "6:30 AM", "Good Morning Silent Meditation", "Virtual"),
      s("WED", "28", "Wednesday, October 28", "Wed, Oct 28", "7:30 PM", "Good Evening Silent Meditation", "Virtual"),
      s("THU", "29", "Thursday, October 29", "Thu, Oct 29", "6:30 AM", "Good Morning Silent Meditation", "Virtual"),
      s("FRI", "30", "Friday, October 30", "Fri, Oct 30", "6:30 AM", "Good Morning Silent Meditation", "Virtual"),
    ],
    weekCount: 10,
    onTheDay: {
      pill: "Host entry open", open: true, place: "Online on Zoom", button: "Enter Zoom as host",
      lines: ["Member entry opens at 6:20 AM"],
      words: "From 30 minutes before the start, My Home shows Enter Zoom as host on the session you're facilitating. Choose it to open the room.",
      tip: { lead: "The Scheduler works too.", text: "In that same window your session shows Enter room." },
      next: { href: "/tutorials/getting-started-for-guides#step-11", label: "Next: the host code and Claim Host in Zoom →" },
    },
  },
  {
    slug: "scheduler-for-av",
    team: "Audio/Visual",
    people: "AV",
    forWhom: "For the Audio/Visual team",
    noun: "AV", verb: "covering AV", action: "cover AV", needs: "AV",
    openSignUp: false,
    sessions: [
      s("TUE", "27", "Tuesday, October 27", "Tue, Oct 27", "9:30 AM", ART, BOTH),
      s("SAT", "31", "Saturday, October 31", "Sat, Oct 31", "9:30 AM", TALK, BOTH),
      s("TUE", "3", "Tuesday, November 3", "Tue, Nov 3", "9:30 AM", ART, BOTH),
      s("SAT", "31", "Saturday, October 31", "Sat, Oct 31", "9:30 AM", TALK, BOTH),
    ],
    weekCount: 2,
    onTheDay: {
      pill: "Later today", lines: ["You're covering AV"],
      words: "On the day, My Home's Today shows the session with “You're covering AV”. Your part happens in person at RIM, so there's nothing you need to open.",
      tip: { lead: "Two days before,", text: "you'll get a reminder that names everyone serving that session." },
    },
  },
  {
    slug: "scheduler-for-greeters",
    team: "Greeter",
    people: "greeters",
    forWhom: "For the Greeter team",
    noun: "Greeter", verb: "greeting", action: "greet", needs: "a greeter",
    openSignUp: true,
    sessions: [
      s("TUE", "27", "Tuesday, October 27", "Tue, Oct 27", "9:30 AM", ART, BOTH),
      s("SAT", "31", "Saturday, October 31", "Sat, Oct 31", "9:30 AM", TALK, BOTH),
      s("TUE", "3", "Tuesday, November 3", "Tue, Nov 3", "9:30 AM", ART, BOTH),
      s("SAT", "7", "Saturday, November 7", "Sat, Nov 7", "9:30 AM", TALK, BOTH),
    ],
    weekCount: 2,
    onTheDay: {
      pill: "Later today", lines: ["You're greeting"],
      words: "On the day, My Home's Today shows the session with “You're greeting”. Your part happens in person at RIM, so there's nothing you need to open.",
      tip: { lead: "Two days before,", text: "you'll get a reminder that names everyone serving that session." },
    },
  },
];

/* ---- The steps everyone shares ---------------------------------------- */

function openingSteps(t: Team): TutorialStep[] {
  return [
    {
      title: "Sign in with your email",
      words: "On this website, tap Menu, then Sign in. Type the email address RIM has for you, then choose Send code. There is no password.",
      computer: { words: "On this website, choose Members at the top of the page, then Sign in. Type the email address RIM has for you, then choose Send code. There is no password." },
      tip: { lead: "Your first sign-in matters.", text: "It's what turns on your team's emails, so sign in once even if you're not signing up for anything yet." },
      alt: "The Sign in page with an email typed in and the Send code button marked.",
    },
    {
      title: "Type the code from your email",
      words: "Rooted In Mindfulness emails you a 6-digit code. Type the six digits and choose Sign in. The code lasts 30 minutes.",
      tip: { lead: "Reading the email on the same phone or computer?", text: "Choose Sign me in from this device in the email. The code fills itself in, and you choose Sign in." },
      alt: "The Enter your code page with six digits filled in and the Sign in button marked.",
    },
    {
      title: "Find My Teams",
      words: "You arrive at My Home. To reach your team, open Menu at the top of the screen and choose My Teams.",
      computer: {
        title: "Choose My Teams",
        words: "You arrive at My Home. To reach your team, choose My Teams in the column on the left.",
        alt: "My Home with My Teams marked in the column on the left.",
        tip: { lead: "Lost?", text: "While you're signed in, My Home is always at the top right of the page." },
      },
      tip: { lead: "Lost?", text: "While you're signed in, My Home is the first thing in the Menu." },
      alt: "The open menu with My Teams marked under My RIM.",
    },
    {
      title: "Choose your team",
      words: `Choose ${t.team}.`,
      tip: { lead: "On more than one team?", text: "Each one is listed here, with its own schedule." },
      alt: `The My Teams page with ${t.team} marked.`,
    },
    {
      title: "Open the Scheduler",
      words: "Your team's home holds its Conversations, Files and Members. The sessions live in the Scheduler. Choose Open the Scheduler.",
      tip: { lead: "The line above the button", text: `tells you how many sessions in the next two weeks still need ${t.needs}.` },
      computer: { tip: { lead: "The column on the left", text: "now lists your team's pages. Scheduler is right under Home." } },
      alt: "The team's home with the Open the Scheduler button marked.",
    },
    {
      title: "Read the schedule",
      words: t.openSignUp
        ? "Each row is one session: its day and time on the left, then who has signed up. All shows every session, Needs help shows the ones with no one yet, and My schedule shows yours."
        : `Each row is one session: its day and time on the left, then who is ${t.verb}. All shows every session, Needs help shows the ones that still need someone, and My schedule shows yours.`,
      tip: { lead: "The small arrow beside My schedule", text: "lets you pick a teammate and see their sessions." },
      alt: "The Scheduler's list with the My schedule filter marked.",
    },
  ];
}

/* ---- The drawings ------------------------------------------------------ */

function homeToday(t: Team, railHl?: string) {
  const first = t.sessions[0];
  return (
    <TodayRow time={first.time} pill="Later today" program={first.program}
      place={t.onTheDay.place} lines={t.onTheDay.place ? [`Opens at ${t.onTheDay.lines[0].replace("Member entry opens at ", "")}`] : t.onTheDay.lines}
      hl={!railHl} />
  );
}

function singleRows(t: Team, device: Device, { hlOpen = false, cover = false }: { hlOpen?: boolean; cover?: boolean } = {}) {
  const [mine, open, other, asked] = t.sessions;
  // A team with two sessions a week (AV) shows only this week's two; the
  // step-in screen puts the teammate's request in its place, by date. Its
  // dialog carries the one mark.
  const showOther = t.weekCount >= 3;
  return (
    <>
      <ScheduleRow device={device} {...rowOf(mine)} tag={`${mine.format} · via rotation`} state={<span className="tut-state">You&rsquo;re {t.verb}</span>} action="Ask the team to cover" quiet />
      {!cover && (
        <ScheduleRow device={device} {...rowOf(open)} state={<span className="tut-state">{t.noun} needed</span>} action={`Yes, I can ${t.action}`} hl={hlOpen} />
      )}
      {showOther && (
        <ScheduleRow device={device} {...rowOf(other)} tag={`${other.format} · via rotation`} state={<span className="tut-meta">{t.noun}: Sam R.</span>} />
      )}
      {cover && (
        <ScheduleRow device={device} {...rowOf(asked)} state={<span className="tut-state">Alex M. needs help</span>} action="Yes, I can cover" />
      )}
    </>
  );
}

function rowOf(x: Session) {
  return { day: x.day, date: x.date, time: x.time, program: x.program, tag: x.format };
}

function signUpRows(t: Team, device: Device, stage: "open" | "joined" | "only", hl = true) {
  const [tue, sat] = t.sessions;
  const plural = `${t.noun.toLowerCase()}s`;
  const one = t.noun.toLowerCase();
  if (stage === "only") {
    return (
      <ScheduleRow device={device} {...rowOf(sat)} state={<SignUpState header={`We have 1 ${one}: that's you`} names={["Pat L."]} mine="Pat L." />} action="Cancel my signup" quiet />
    );
  }
  return (
    <>
      {stage === "joined" ? (
        <ScheduleRow device={device} {...rowOf(tue)}
          state={<SignUpState header={`We have 3 ${plural}, and you're one of them`} names={["Sam R.", "Alex M.", "Pat L."]} mine="Pat L." />}
          action="Cancel my signup" quiet />
      ) : (
        <ScheduleRow device={device} {...rowOf(tue)}
          state={<SignUpState header={`We have 2 ${plural}`} names={["Sam R.", "Alex M."]} />}
          action="I’ll be there too" hl={hl} />
      )}
      <ScheduleRow device={device} {...rowOf(sat)} state={<span className="tut-state">No {plural} yet. Be the first?</span>} action="I’ll be the first" />
    </>
  );
}

function openingScreens(t: Team, device: Device): ReactNode[] {
  const morning = { date: t.sessions[0].full, greeting: "Good morning, Pat." };
  return [
    signInScreen(device),
    codeScreen(device),
    device === "phone" ? phoneMenuScreen() : myHomeScreen(device, { ...morning, today: homeToday(t, "My Teams"), railHl: "My Teams" }),
    myTeamsScreen(device, t.team),
    teamHomeScreen(device, t.team, `2 sessions in the next two weeks need ${t.needs}`),
  ];
}

function onTheDayScreen(t: Team, device: Device) {
  const first = t.sessions[0];
  const d = t.onTheDay;
  return myHomeScreen(device, {
    date: first.full,
    greeting: "Good morning, Pat.",
    weekButton: false,
    today: <TodayRow time={first.time} pill={d.pill} open={d.open} program={first.program} place={d.place} button={d.button} lines={d.lines} hl />,
  });
}

/* ---- One team's tutorial ----------------------------------------------- */

function singleSlotTutorial(t: Team): Pick<Tutorial, "steps" | "screens"> {
  const [mine, open, , asked] = t.sessions;
  const counts = { all: t.weekCount * 4, needs: 2, mine: 3, week: t.weekCount };
  const steps: TutorialStep[] = [
    ...openingSteps(t),
    {
      title: "Take a session that needs you",
      words: `${t.noun} needed means no one has the session yet. Choose Yes, I can ${t.action} to take it.`,
      tip: { lead: "“via rotation”", text: "on a session means it comes from a regular turn your coordinators set up." },
      alt: `The Scheduler with Yes, I can ${t.action} marked on an open session.`,
    },
    {
      title: "Say yes",
      words: `Check the day and time, then choose Yes, I'll ${t.action}. The session is yours, and a confirmation email is on its way.`,
      tip: { lead: "Two days before", text: `each session you're ${t.verb}, you'll get a reminder that names everyone serving it.` },
      alt: `The Take this session? box with Yes, I'll ${t.action} marked.`,
    },
    {
      title: "Can't make it? Ask the team",
      words: "Find your session (My schedule shows it) and choose Ask the team to cover. Add a note if you like, then choose Send to the team. Your teammates get an email, and the session stays yours until someone steps in.",
      tip: { lead: "Plans changed again?", text: "Choose Cancel my request on the same row. The session stays yours, and the team knows the request is closed." },
      alt: "The Ask the team to cover box with Send to the team marked.",
    },
    {
      title: "Step in for a teammate",
      words: "When a teammate asks for cover, their session shows their name and needs help. Choose Yes, I can cover, then Yes, I'll cover this. They're told you're stepping in.",
      alt: "The Confirm covering box with Yes, I'll cover this marked.",
    },
    {
      title: "When the team needs someone",
      words: `Your team's Updates page lists, under Needs you, the sessions in the next two weeks that still need ${t.needs}. You can take one right there with Take this session.`,
      tip: { lead: "You'll hear by email too.", text: "When a session close at hand loses its person, the team is told, and every Monday brings the next two weeks' open sessions." },
      alt: "The team's Updates page with Take this session marked under Needs you.",
    },
    {
      title: "On the day",
      words: t.onTheDay.words,
      tip: t.onTheDay.tip,
      next: t.onTheDay.next,
      alt: "My Home on the day of the session.",
    },
  ];

  const screensFor = (device: Device): ReactNode[] => [
    ...openingScreens(t, device),
    schedulerScreen(device, t.team, singleRows(t, device), { pillHl: true, counts }),
    schedulerScreen(device, t.team, singleRows(t, device, { hlOpen: true }), { counts }),
    schedulerScreen(device, t.team, singleRows(t, device), {
      counts,
      dialog: (
        <>
          <span className="tut-h2">Take this session?</span>
          <span className="tut-p">{open.program} on {open.full} at {open.time} will be yours. We&rsquo;ll email you a confirmation.</span>
          <DialogActions yes={`Yes, I'll ${t.action}`} />
        </>
      ),
    }),
    schedulerScreen(device, t.team, singleRows(t, device), {
      counts,
      dialog: (
        <>
          <span className="tut-h2">Ask the team to cover</span>
          <span className="tut-p">Let your teammates know you can&rsquo;t make {mine.full} for {mine.program}. They&rsquo;ll receive an email and someone may step in.</span>
          <span className="tut-label">Add a note (optional)</span>
          <span className="tut-area">Anything the replacement should know…</span>
          <DialogActions yes="Send to the team" />
        </>
      ),
    }),
    schedulerScreen(device, t.team, singleRows(t, device, { cover: true }), {
      counts,
      dialog: (
        <>
          <span className="tut-h2">Confirm covering</span>
          <span className="tut-p">You&rsquo;ll cover for Alex M. on {asked.full} for {asked.program}. They&rsquo;ll be notified that you&rsquo;re stepping in.</span>
          <DialogActions yes="Yes, I'll cover this" />
        </>
      ),
    }),
    needsYouScreen(device, t.team, { what: `${open.program} · ${open.short} at ${open.time}`, needs: `needs ${t.needs}`, button: "Take this session" }),
    onTheDayScreen(t, device),
  ];
  return { steps, screens: { phone: screensFor("phone"), computer: screensFor("computer") } };
}

function openSignUpTutorial(t: Team): Pick<Tutorial, "steps" | "screens"> {
  const [, sat] = t.sessions;
  const plural = `${t.noun.toLowerCase()}s`;
  const counts = { all: t.weekCount * 4, needs: 2, mine: 2, week: t.weekCount };
  const steps: TutorialStep[] = [
    ...openingSteps(t),
    {
      title: "Sign up",
      words: `Several ${plural} can share a session. Choose I'll be there too to join the ones already signed up, or I'll be the first where no one has yet. One tap signs you up, and a confirmation email is on its way.`,
      alt: "The Scheduler with I'll be there too marked.",
    },
    {
      title: "You're on it",
      words: `The row now counts you among the ${plural}, with “you” beside your name.`,
      tip: { lead: "Two days before", text: "each session, you'll get a reminder that names everyone serving it." },
      alt: "A session listing you among the greeters, with Cancel my signup.",
    },
    {
      title: "Can't make it? Cancel your sign-up",
      words: `Choose Cancel my signup on the session. If you're the only ${t.noun.toLowerCase()} for it, you'll be asked first. When the session is within two weeks, the team will hear that it needs someone.`,
      alt: "The Cancel your sign-up? box with Yes, cancel my sign-up marked.",
    },
    {
      title: "When the team needs someone",
      words: `Your team's Updates page lists, under Needs you, the sessions in the next two weeks with no ${t.noun.toLowerCase()} yet. You can sign up right there with Sign up to ${t.action}.`,
      tip: { lead: "You'll hear by email too.", text: "When a session close at hand is left with no one, the team is told, and every Monday brings the next two weeks' open sessions." },
      alt: `The team's Updates page with Sign up to ${t.action} marked under Needs you.`,
    },
    {
      title: "On the day",
      words: t.onTheDay.words,
      tip: t.onTheDay.tip,
      alt: "My Home on the day of the session.",
    },
  ];

  const screensFor = (device: Device): ReactNode[] => [
    ...openingScreens(t, device),
    schedulerScreen(device, t.team, signUpRows(t, device, "open", false), { pillHl: true, counts }),
    schedulerScreen(device, t.team, signUpRows(t, device, "open"), { counts }),
    schedulerScreen(device, t.team, signUpRows(t, device, "joined"), { counts }),
    schedulerScreen(device, t.team, signUpRows(t, device, "only"), {
      counts,
      dialog: (
        <>
          <span className="tut-h2">Cancel your sign-up?</span>
          <span className="tut-p">You&rsquo;re the only {t.noun.toLowerCase()} for {sat.program} on {sat.full}. If you cancel, it will show on the schedule as needing {t.needs}, and the team will hear.</span>
          <DialogActions yes="Yes, cancel my sign-up" no="Keep my sign-up" />
        </>
      ),
    }),
    needsYouScreen(device, t.team, { what: `${sat.program} · ${sat.short} at ${sat.time}`, needs: `needs ${t.needs}`, button: `Sign up to ${t.action}` }),
    onTheDayScreen(t, device),
  ];
  return { steps, screens: { phone: screensFor("phone"), computer: screensFor("computer") } };
}

export const SCHEDULER_TUTORIALS: Tutorial[] = SCHEDULER_TEAMS.map((t) => ({
  slug: t.slug,
  title: `The Scheduler for ${t.people}`,
  forWhom: t.forWhom,
  summary: t.openSignUp
    ? "Finding your team, signing up for a session, cancelling, and what you'll see on the day."
    : "Finding your team, taking a session, asking the team to cover, stepping in for a teammate, and what you'll see on the day.",
  topic: "Using the Scheduler",
  ...(t.openSignUp ? openSignUpTutorial(t) : singleSlotTutorial(t)),
  help: [
    "Ask your team's coordinators (they're marked Coordinator on your team's Members page), or write to support@rootedinmindfulness.org and someone will help.",
  ],
}));
