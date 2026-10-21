/**
 * Getting started for guides (2026-10-21, Jesse, from LoriLee's notes): the
 * Peer-Led Silent Meditation team's walk from signing in to claiming host in
 * Zoom, for a phone and for a computer. The words are this team's (the
 * Scheduler and the Zoom door read "facilitate" from the team's coverage
 * copy). The names, dates and code in the drawings are examples; the week is
 * Monday, October 26, 2026.
 *
 * Zoom's steps follow Zoom's own article for the desktop app (Participants,
 * then Claim host at the bottom of the list, then the key). Zoom does not
 * document the host key in its phone app; the phone drawing is unconfirmed
 * until someone checks it on a phone (Jesse, 2026-10-21). On a phone Zoom
 * keeps Mute all under the list's "…", so the tip points there too.
 *
 * Wording provisional until Jesse's read-aloud.
 */

import type { Tutorial, TutorialStep } from "./types";
import { ScheduleRow } from "./drawing";
import {
  DialogActions, TodayRow, codeScreen, doorScreen, myHomeScreen, myTeamsScreen, phoneMenuScreen,
  schedulerScreen, signInScreen, teamHomeScreen, zoomScreen, type Device,
} from "./screens";

const TEAM = "Peer-Led Silent Meditation";
const PROGRAM = "Good Morning Silent Meditation";

const steps: TutorialStep[] = [
  {
    title: "Sign in with your email",
    words: "On this website, tap Menu, then Sign in. Type the email address RIM has for you, then choose Send code. There is no password.",
    computer: { words: "On this website, choose Members at the top of the page, then Sign in. Type the email address RIM has for you, then choose Send code. There is no password." },
    tip: { lead: "Your first sign-in matters.", text: "It's what turns on your team's emails, so sign in once even if you're not taking a session yet." },
    alt: "The Sign in page with an email typed in and the Send code button marked.",
  },
  {
    title: "Type the code from your email",
    words: "Rooted In Mindfulness emails you a 6-digit code. Type the six digits and choose Sign in. The code lasts 30 minutes.",
    tip: { lead: "Reading the email on the same phone or computer?", text: "Choose Sign me in from this device in the email. The code fills itself in, and you choose Sign in." },
    alt: "The Enter your code page with six digits filled in and the Sign in button marked.",
  },
  {
    title: "This is My Home",
    words: "After you sign in, you arrive at My Home. It shows today's gatherings. On a day you facilitate, your session appears here with its own button (step 10).",
    tip: { lead: "Lost?", text: "While you're signed in, My Home is the first thing in the Menu." },
    computer: { tip: { lead: "Lost?", text: "While you're signed in, My Home is always at the top right of the page." } },
    alt: `My Home with today's ${PROGRAM} marked.`,
  },
  {
    title: "Find My Teams",
    words: "To reach your team, open Menu at the top of the screen and choose My Teams.",
    computer: {
      title: "Choose My Teams",
      words: "To reach your team, choose My Teams in the column on the left.",
      alt: "My Home with My Teams marked in the column on the left.",
    },
    alt: "The open menu with My Teams marked under My RIM.",
  },
  {
    title: "Choose your team",
    words: `Choose ${TEAM}. This is the guides' team.`,
    tip: { lead: "On more than one team?", text: "Each one is listed here." },
    alt: `The My Teams page with ${TEAM} marked.`,
  },
  {
    title: "Open the Scheduler",
    words: "Your team's home holds its Conversations, Files and Members. The sessions live in the Scheduler. Choose Open the Scheduler.",
    tip: { lead: "The line above the button", text: "tells you how many sessions in the next two weeks still need a facilitator." },
    computer: { tip: { lead: "The column on the left", text: "now lists your team's pages. Scheduler is right under Home." } },
    alt: "The team's home with the Open the Scheduler button marked.",
  },
  {
    title: "Find a session that needs you",
    words: "Each row is one session. Facilitator needed means no one has it yet. Choose Yes, I can facilitate to take it.",
    tip: { lead: "My schedule", text: "shows only your sessions. “via rotation” means the session comes from your regular turn, set up by your coordinators." },
    alt: "The Scheduler with Yes, I can facilitate marked on an open session.",
  },
  {
    title: "Say yes",
    words: "Check the day and time, then choose Yes, I'll facilitate. The session is yours, and a confirmation email is on its way.",
    tip: { lead: "Two days before", text: "each session you're facilitating, you'll get a reminder." },
    alt: "The Take this session? box with Yes, I'll facilitate marked.",
  },
  {
    title: "Can't make it? Ask the team",
    words: "Find your session in the Scheduler and choose Ask the team to cover. Add a note if you like, then choose Send to the team. Your teammates get an email and someone can step in.",
    tip: { lead: "Plans changed again?", text: "Choose Cancel my request on the same row. The session stays yours, and the team knows the request is closed." },
    alt: "The Ask the team to cover box with Send to the team marked.",
  },
  {
    title: "On the day: Enter Zoom as host",
    words: "From 30 minutes before the start, My Home shows Enter Zoom as host on your session. Choose it. Everyone else can come in from 10 minutes before.",
    tip: { lead: "The Scheduler works too.", text: "In that same window your session shows Enter room." },
    alt: "My Home on the morning of the session with Enter Zoom as host marked.",
  },
  {
    title: "Note the host code, then join",
    words: "You'll see today's host code. Keep it in view and choose Join as host. Zoom opens. The first time, type your name (your first name and last initial is fine). You don't need a Zoom account.",
    tip: { lead: "The code is for the team.", text: "Members never see it, so please don't post it in the chat." },
    alt: "The host page with Join as host marked and the host code hidden.",
  },
  {
    title: "In Zoom, open Participants",
    words: "Tap Participants in the row of buttons at the bottom of the screen. If the buttons are hidden, tap the screen once and they appear.",
    computer: {
      words: "Click Participants in the row of buttons along the bottom of the Zoom window. The list of everyone in the room opens on the right. If the buttons are hidden, move the mouse over the window.",
      alt: "The Zoom window with Participants marked in the bottom toolbar.",
    },
    alt: "Zoom on a phone with Participants marked in the bottom row.",
  },
  {
    title: "Claim host with the code",
    words: "Tap Claim Host, type the code from step 11, and confirm. The host controls are now yours.",
    tip: { lead: "Don't see Claim Host?", text: "Tap the three dots (•••) at the top of the Participants list and look there. If someone already holds host, that's fine. If no one does and it isn't there, claim host from a computer, or ask your coordinator." },
    computer: {
      words: "At the bottom of the Participants list, click Claim host. Type the code from step 11 and click Claim Host. The host controls are now yours.",
      tip: { lead: "Can't find it?", text: "It may be under More (…) at the bottom of the list. If it isn't there at all, someone already holds host, and that's fine." },
      alt: "Zoom's Claim Host box with the code typed and the Claim Host button marked.",
    },
    alt: "Zoom's participant list on a phone with Claim Host marked.",
  },
];

/* ---- The drawings ------------------------------------------------------ */

const morning = { date: "Tuesday, October 27", greeting: "Good morning, Pat." };

function laterToday(railHl?: string) {
  return (
    <TodayRow time="6:30 AM" pill="Later today" program={PROGRAM} place="Online on Zoom" lines={["Opens at 6:20 AM"]} hl={!railHl} />
  );
}

function rows(device: Device, hlOpen: boolean) {
  return (
    <>
      <ScheduleRow device={device} day="TUE" date="27" tag="Virtual · via rotation"
        state={<span className="tut-state">You&rsquo;re facilitating</span>} action="Ask the team to cover" quiet />
      <ScheduleRow device={device} day="WED" date="28" tag="Virtual"
        state={<span className="tut-state">Facilitator needed</span>} action="Yes, I can facilitate" hl={hlOpen} />
      <ScheduleRow device={device} day="THU" date="29" tag="Virtual · via rotation"
        state={<span className="tut-meta">Facilitator: Sam R.</span>} />
    </>
  );
}

function screensFor(device: Device) {
  return [
    signInScreen(device),
    codeScreen(device),
    myHomeScreen(device, { ...morning, today: laterToday() }),
    device === "phone" ? phoneMenuScreen() : myHomeScreen(device, { ...morning, today: laterToday("My Teams"), railHl: "My Teams" }),
    myTeamsScreen(device, TEAM),
    teamHomeScreen(device, TEAM, "2 sessions in the next two weeks need a facilitator"),
    schedulerScreen(device, TEAM, rows(device, true)),
    schedulerScreen(device, TEAM, rows(device, false), {
      dialog: (
        <>
          <span className="tut-h2">Take this session?</span>
          <span className="tut-p">{PROGRAM} on Wednesday, October 28 at 6:30 AM will be yours. We&rsquo;ll email you a confirmation.</span>
          <DialogActions yes="Yes, I'll facilitate" />
        </>
      ),
    }),
    schedulerScreen(device, TEAM, rows(device, false), {
      dialog: (
        <>
          <span className="tut-h2">Ask the team to cover</span>
          <span className="tut-p">Let your teammates know you can&rsquo;t make Tuesday, October 27 for {PROGRAM}. They&rsquo;ll receive an email and someone may step in.</span>
          <span className="tut-label">Add a note (optional)</span>
          <span className="tut-area">Anything the replacement should know…</span>
          <DialogActions yes="Send to the team" />
        </>
      ),
    }),
    myHomeScreen(device, {
      ...morning,
      weekButton: false,
      today: <TodayRow time="6:30 AM" pill="Host entry open" open program={PROGRAM} place="Online on Zoom" button="Enter Zoom as host" lines={["Member entry opens at 6:20 AM"]} hl />,
    }),
    doorScreen(device, {
      eyebrow: "You're facilitating today",
      program: PROGRAM,
      join: "Join as host →",
      intro: "To take host controls, tap Participants → Claim Host in Zoom and enter:",
    }),
    zoomScreen(device, "toolbar"),
    zoomScreen(device, "claim"),
  ];
}

export const gettingStartedForGuides: Tutorial = {
  slug: "getting-started-for-guides",
  title: "Getting started for guides",
  forWhom: `For the guides of ${TEAM}`,
  summary: "Signing in, finding your team, taking a session, asking for cover, and opening the Zoom room on the day you facilitate.",
  topic: "Getting started",
  steps,
  screens: { phone: screensFor("phone"), computer: screensFor("computer") },
  help: [
    "Ask your team's coordinators (they're marked Coordinator on your team's Members page), or write to support@rootedinmindfulness.org and someone will help you in.",
    "If Zoom doesn't open, choose the button again. If the website says the session can't open right now, wait a moment and choose Try again.",
  ],
};
