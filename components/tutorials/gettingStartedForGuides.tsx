/**
 * Getting started for guides (2026-10-21, Jesse, from LoriLee's notes): the
 * Peer-Led Silent Meditation team's walk from signing in to claiming host in
 * Zoom, for a phone and for a computer. The words are this team's (the
 * Scheduler and the Zoom door read "facilitate" from the team's coverage
 * copy). The names, dates and code in the drawings are examples.
 *
 * Zoom's steps follow Zoom's own article for the desktop app (Participants,
 * then Claim host at the bottom of the list, then the key). Zoom does not
 * document the host key in its phone app; the phone drawing is unconfirmed
 * until someone checks it on a phone (Jesse, 2026-10-21).
 *
 * Wording provisional until Jesse's read-aloud.
 */

import type { ReactNode } from "react";
import type { Tutorial, TutorialStep } from "./types";
import { Dialog, Header, Page, PersonalRail, ScheduleRow, TeamRail, cx } from "./drawing";

const TEAM = "Peer-Led Silent Meditation";

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
    alt: "My Home with today's Good Morning Silent Meditation marked.",
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
    tip: { lead: "Plans changed again?", text: "The same row then shows Cancel my request, and the session is yours again." },
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
    words: "At the bottom of the list, tap Claim Host, type the code from step 11, and confirm. The host controls are now yours.",
    tip: { lead: "Don't see Claim Host?", text: "If someone already holds host, that's fine. If no one does, claiming host works most clearly from a computer; ask your coordinator for help." },
    computer: {
      words: "At the bottom of the Participants list, click Claim host. Type the code from step 11 and click Claim Host. The host controls are now yours.",
      tip: { lead: "Can't find it?", text: "It may be under More (…) at the bottom of the list. If it isn't there at all, someone already holds host, and that's fine." },
      alt: "Zoom's Claim Host box with the code typed and the Claim Host button marked.",
    },
    alt: "Zoom's participant list on a phone with Claim Host marked.",
  },
];

/* ---- The drawings ------------------------------------------------------ */

function signIn(device: "phone" | "computer") {
  return (
    <Page header={<Header device={device} signedIn={false} />} center={device === "computer"}>
      <span className="tut-eyebrow">Members</span>
      <span className="tut-h1">Sign in</span>
      <span className="tut-p">Enter your email and we&rsquo;ll send you a 6-digit code. No password needed.</span>
      <span className="tut-label">Email</span>
      <span className="tut-input"><span className="tut-typing">pat@example.com</span></span>
      <span className="tut-btn hl">Send code →</span>
      <span className="tut-meta">New to RIM? <span className="tut-link">Become a member →</span></span>
    </Page>
  );
}

function code(device: "phone" | "computer") {
  return (
    <Page header={<Header device={device} signedIn={false} />} center={device === "computer"}>
      <span className="tut-eyebrow">Members</span>
      <span className="tut-h1">Enter your code</span>
      <span className="tut-p">We sent a 6-digit code to pat@example.com. It expires in 30 minutes.</span>
      <span className="tut-label">6-digit code</span>
      <span className="tut-codes">{["4", "8", "1", "2", "0", "7"].map((d, i) => <span key={i}>{d}</span>)}</span>
      <span className="tut-btn hl">Sign in →</span>
      <span className="tut-meta">Didn&rsquo;t receive it? Check your spam folder, or <span className="tut-link">send a new code</span>.</span>
    </Page>
  );
}

function today(device: "phone" | "computer", onTheDay: boolean, railHl?: string) {
  const row = onTheDay ? (
    <div className="tut-card">
      <div className="tut-today">
        <span className="tut-time">6:30 AM<span className="tut-pill tut-pill--open">Host entry open</span></span>
        <span className="tut-stack">
          <span className="tut-h2">Good Morning Silent Meditation</span>
          <span className="tut-meta">Online on Zoom</span>
          <span className="tut-btn hl">Enter Zoom as host</span>
          <span className="tut-meta">Member entry opens at 6:20 AM</span>
        </span>
      </div>
    </div>
  ) : (
    <div className={cx("tut-card", !railHl && "hl")}>
      <div className="tut-today">
        <span className="tut-time">6:30 AM<span className="tut-pill">Later today</span></span>
        <span className="tut-stack">
          <span className="tut-h2">Good Morning Silent Meditation</span>
          <span className="tut-meta">Online on Zoom</span>
          <span className="tut-meta">Opens at 6:20 AM</span>
        </span>
      </div>
    </div>
  );
  return (
    <Page
      header={<Header device={device} />}
      rail={device === "computer" ? <PersonalRail active="My Home" hl={railHl} /> : undefined}
    >
      <span className="tut-meta">Tuesday, October 28</span>
      <span className="tut-h1">Good morning, Pat.</span>
      <span className="tut-eyebrow">Today</span>
      {row}
      {!onTheDay && <span className="tut-btn tut-btn--ghost">This week&rsquo;s schedule →</span>}
    </Page>
  );
}

function phoneMenu() {
  const mine = ["My Home", "Notifications", "Library", "My Teams", "♥  Community Care", "My Profile"];
  return (
    <div className="tut-screen tut-sheet">
      <Header device="phone" open />
      <div className="tut-sheet__body">
        <span className="tut-eyebrow">My RIM</span>
        {mine.map((label) => (
          <span key={label} className={cx("tut-sheet__link", label === "My Teams" && "hl")}>{label}</span>
        ))}
        <span className="tut-sheet__link tut-dim">New to RIM</span>
      </div>
      <div className="tut-sheet__foot">
        <span className="tut-sheet__signout">Sign out</span>
        <span className="tut-donate tut-donate--block">Donate</span>
      </div>
    </div>
  );
}

function myTeams(device: "phone" | "computer") {
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail active="My Teams" /> : undefined}>
      <span className="tut-h1">My Teams</span>
      <span className="tut-p">Choose a team to find its conversations, files, and shared work.</span>
      <div className="tut-list">
        <span className="tut-list__row hl"><b>{TEAM}</b><span>→</span></span>
      </div>
    </Page>
  );
}

function teamHome(device: "phone" | "computer") {
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <TeamRail team={TEAM} active="Home" /> : undefined}>
      <span className="tut-h1">{TEAM}</span>
      <span className="tut-meta">Your team&rsquo;s shared space.</span>
      <div className="tut-card">
        <span className="tut-eyebrow">This team&rsquo;s tool</span>
        <span className="tut-h2">Scheduler</span>
        <span className="tut-meta">2 sessions in the next two weeks need a facilitator</span>
        <span className="tut-btn hl">Open the Scheduler</span>
      </div>
      <div className="tut-list">
        <span className="tut-list__row"><span><b>Conversations</b><small>Read and join team discussions</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Files</b><small>Find documents and shared resources</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Members</b><small>Find the people on your team</small></span><span>→</span></span>
      </div>
    </Page>
  );
}

function scheduler(device: "phone" | "computer", dimmed = false, children?: ReactNode) {
  return (
    <div className="tut-screen tut-screen--layer">
      <Page header={<Header device={device} />} rail={device === "computer" ? <TeamRail team={TEAM} active="Scheduler" /> : undefined}>
        <div className={cx("tut-stack", dimmed && "tut-dim")}>
          <span className="tut-h1">October 2026</span>
          <span className="tut-pills"><span className="on">All 22</span><span>Needs help 2</span><span>My schedule 4 ▾</span></span>
          <span className="tut-week"><span className="tut-h2">This week</span><span className="tut-meta">12 sessions</span></span>
          <ScheduleRow device={device} day="TUE" date="28" tag="Virtual · via rotation"
            state={<span className="tut-state">You&rsquo;re facilitating</span>} action="Ask the team to cover" quiet />
          <ScheduleRow device={device} day="WED" date="29" tag="Virtual"
            state={<span className="tut-state">Facilitator needed</span>} action="Yes, I can facilitate" hl={!dimmed} />
          <ScheduleRow device={device} day="THU" date="30" tag="Virtual · via rotation"
            state={<span className="tut-meta">Facilitator: Sam R.</span>} />
        </div>
      </Page>
      {children}
    </div>
  );
}

function takeDialog(device: "phone" | "computer") {
  return scheduler(device, true, (
    <Dialog>
      <span className="tut-h2">Take this session?</span>
      <span className="tut-p">Good Morning Silent Meditation on Wednesday, October 29 at 6:30 AM will be yours. We&rsquo;ll email you a confirmation.</span>
      <span className="tut-actions"><span className="tut-btn hl">Yes, I&rsquo;ll facilitate</span><span className="tut-btn tut-btn--ghost">Not yet</span></span>
    </Dialog>
  ));
}

function coverDialog(device: "phone" | "computer") {
  return scheduler(device, true, (
    <Dialog>
      <span className="tut-h2">Ask the team to cover</span>
      <span className="tut-p">Let your teammates know you can&rsquo;t make Tuesday, October 28 for Good Morning Silent Meditation. They&rsquo;ll receive an email and someone may step in.</span>
      <span className="tut-label">Add a note (optional)</span>
      <span className="tut-area">Anything the replacement should know…</span>
      <span className="tut-actions"><span className="tut-btn hl">Send to the team</span><span className="tut-btn tut-btn--ghost">Not yet</span></span>
    </Dialog>
  ));
}

function door(device: "phone" | "computer") {
  return (
    <Page header={<Header device={device} />} center>
      <div className="tut-card tut-card--door">
        <span className="tut-eyebrow">You&rsquo;re facilitating today</span>
        <span className="tut-h1">Good Morning Silent Meditation</span>
        <span className="tut-btn hl">Join as host →</span>
        <span className="tut-hostbox">
          You&rsquo;ll join under your own name. To take host controls, tap Participants → Claim Host in Zoom and enter:
          <span className="tut-code">••••••</span>
        </span>
      </div>
    </Page>
  );
}

/** Zoom's own screen, drawn plainly: it is Zoom's, not RIM's. */
function zoom(device: "phone" | "computer", stage: "toolbar" | "claim") {
  const people = ["Pat L.", "Sam R.", "Alex M.", "Jordan K."];
  if (device === "phone") {
    return (
      <div className="tut-screen tut-zoom">
        <div className="tut-zoom__stage">{people.map((p) => <span key={p} className="tut-zoom__tile">{p}</span>)}</div>
        {stage === "claim" && (
          <div className="tut-zoom__panel tut-zoom__panel--sheet">
            <b>Participants (4)</b>
            {people.map((p) => <span key={p}>{p}{p === "Pat L." ? " (me)" : ""}</span>)}
            <span className="tut-zoom__claim hl">Claim Host</span>
          </div>
        )}
        <div className="tut-zoom__bar">
          {["Mute", "Stop Video", "Share", "Participants", "More"].map((b) => (
            <span key={b} className={cx(b === "Participants" && stage === "toolbar" && "hl")}>{b}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="tut-screen tut-zoom tut-zoom--wide">
      <div className="tut-zoom__body">
        <div className="tut-zoom__stage">{people.map((p) => <span key={p} className="tut-zoom__tile">{p}</span>)}</div>
        {stage === "claim" && (
          <div className="tut-zoom__panel">
            <b>Participants (4)</b>
            {people.map((p) => <span key={p}>{p}{p === "Pat L." ? " (me)" : ""}</span>)}
            <span className="tut-zoom__foot"><span>Invite</span><span className="tut-zoom__claim">Claim host</span></span>
          </div>
        )}
      </div>
      <div className="tut-zoom__bar">
        {["Audio", "Video", "Participants", "Chat", "React", "Share", "More"].map((b) => (
          <span key={b} className={cx(b === "Participants" && stage === "toolbar" && "hl")}>{b}</span>
        ))}
        <span className="tut-zoom__leave">Leave</span>
      </div>
      {stage === "claim" && (
        <div className="tut-scrim tut-scrim--zoom">
          <div className="tut-zoom__dialog">
            <b>Claim Host</b>
            <span>Enter the host key to claim host</span>
            <span className="tut-zoom__field">••••••</span>
            <span className="tut-zoom__actions"><span>Cancel</span><span className="tut-zoom__primary hl">Claim Host</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

function screensFor(device: "phone" | "computer"): ReactNode[] {
  return [
    signIn(device),
    code(device),
    today(device, false),
    device === "phone" ? phoneMenu() : today(device, false, "My Teams"),
    myTeams(device),
    teamHome(device),
    scheduler(device),
    takeDialog(device),
    coverDialog(device),
    today(device, true),
    door(device),
    zoom(device, "toolbar"),
    zoom(device, "claim"),
  ];
}

export const gettingStartedForGuides: Tutorial = {
  slug: "getting-started-for-guides",
  title: "Getting started for guides",
  forWhom: `For the guides of ${TEAM}`,
  summary: "Signing in, finding your team, taking a session, asking for cover, and opening the Zoom room on the day you facilitate.",
  topic: "Leading a session",
  steps,
  screens: { phone: screensFor("phone"), computer: screensFor("computer") },
  help: [
    "Ask your team's coordinators (they're marked Coordinator on your team's Members page), or write to support@rootedinmindfulness.org and someone will help you in.",
    "If Zoom doesn't open, choose the button again. If the website says the session can't open right now, wait a moment and choose Try again.",
  ],
};
