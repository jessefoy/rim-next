/**
 * Leading a session on Zoom, for each team that runs its own sessions
 * (2026-10-21, Jesse: the Peer-Led guides and the Zoom hosts "need to know how
 * to log into Zoom and claim host"). One recipe in each team's words: the
 * Hosting Team hosts, guides facilitate. No one signs in to Zoom: you join
 * under your name, then claim host with the code. Only claiming host, by
 * Jesse's call: nothing about muting, co-hosts or ending the meeting. The
 * written twin is ZOOM_HOST_GUIDE.md; the Zoom door links here
 * (lib/tutorialLinks.ts).
 *
 * Zoom's desktop steps follow Zoom's own article (Participants, then Claim
 * host at the bottom of the list). Zoom doesn't document the host key in its
 * phone app; the phone tip points at the list's "…", where Zoom keeps Mute
 * all, until someone checks it on a phone.
 *
 * Wording provisional until Jesse's read-aloud.
 */

import type { Tutorial, TutorialStep } from "./types";
import { TodayRow, doorScreen, myHomeScreen, zoomNameScreen, zoomScreen, type Device } from "./screens";

type ZoomTeam = {
  slug: string;
  /** The team's name on the backup page ("You're on the … team"). */
  teamPhrase: string;
  people: string;
  forWhom: string;
  verb: string;
  program: string;
  day: string;
  time: string;
  memberOpens: string;
};

const ZOOM_TEAMS: ZoomTeam[] = [
  {
    slug: "zoom-for-hosts",
    teamPhrase: "Hosting Team",
    people: "hosts",
    forWhom: "For the Hosting Team",
    verb: "hosting",
    program: "Meditation and Dharma Talk",
    day: "Saturday, October 31",
    time: "9:30 AM",
    memberOpens: "9:20 AM",
  },
  {
    slug: "zoom-for-guides",
    teamPhrase: "Peer-Led Silent Meditation team",
    people: "guides",
    forWhom: "For the guides of Peer-Led Silent Meditation",
    verb: "facilitating",
    program: "Good Morning Silent Meditation",
    day: "Tuesday, October 27",
    time: "6:30 AM",
    memberOpens: "6:20 AM",
  },
];

function stepsFor(t: ZoomTeam): TutorialStep[] {
  return [
    {
      title: "On the day, open My Home",
      words: `Sign in to the RIM website and go to My Home. From 30 minutes before the start, the session you're ${t.verb} shows Enter Zoom as host; from 10 minutes before, it reads Join on Zoom. Choose it.`,
      tip: { lead: "Settling in early.", text: "The room is yours from 30 minutes before. Everyone else can come in from 10 minutes before." },
      alt: "My Home with Enter Zoom as host marked.",
    },
    {
      title: "Note the host code, then join",
      words: `This page says You're ${t.verb} today and shows the host code. Keep it in view and choose Join as host. Zoom opens. (How to claim host in Zoom, on this page, opens these steps in a new tab.)`,
      tip: { lead: "The code is for the team.", text: "Members never see it, so please don't post it in the chat." },
      alt: "The host page with Join as host marked and the host code hidden.",
    },
    {
      title: "You don't sign in to Zoom",
      words: "There's no Zoom account or password to remember. The first time Zoom opens on a phone or computer, it asks for your name. Type your first name and last initial and choose Join. Zoom remembers it next time. (If you're signed in to a Zoom account of your own, Zoom shows that account's name.)",
      tip: { lead: "The very first time,", text: "your browser may ask “Open Zoom?”: choose Open. A phone may ask you to get the Zoom app first." },
      alt: "Zoom asking for a name, with Join marked.",
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
      words: "Tap Claim Host, type the code from step 2, and confirm. The host controls are now yours.",
      tip: { lead: "Don't see Claim Host?", text: "Tap the three dots (•••) at the top of the Participants list and look there. If someone already holds host, that's fine. If no one does and it isn't there, claim host from a computer, or ask your coordinator." },
      computer: {
        words: "At the bottom of the Participants list, click Claim host. Type the code from step 2 and click Claim Host. The host controls are now yours.",
        tip: { lead: "Can't find it?", text: "It may be under More (…) at the bottom of the list. If it isn't there at all, someone already holds host, and that's fine." },
        alt: "Zoom's Claim Host box with the code typed and the Claim Host button marked.",
      },
      alt: "Zoom's participant list on a phone with Claim Host marked.",
    },
    {
      title: "If you're the backup",
      words: `Helping with a session someone else is ${t.verb}? Open your team's Scheduler: from 30 minutes before, the session shows Enter room. This page names who is ${t.verb} today and shows the same code. Choose Join. If they're there, there's nothing to do. If they can't come, claim host with the code so the session is never left without one.`,
      tip: { lead: "Only one host at a time.", text: "Whoever holds host can make another person a co-host inside Zoom." },
      alt: "The backup's page naming who is leading today, with Join marked.",
    },
  ];
}

function screensFor(t: ZoomTeam, device: Device) {
  return [
    myHomeScreen(device, {
      date: t.day,
      greeting: "Good morning, Pat.",
      weekButton: false,
      today: <TodayRow time={t.time} pill="Host entry open" open program={t.program} place="Online on Zoom" button="Enter Zoom as host" lines={[`Member entry opens at ${t.memberOpens}`]} hl />,
    }),
    doorScreen(device, {
      eyebrow: `You're ${t.verb} today`,
      program: t.program,
      join: "Join as host →",
      intro: "To take host controls, tap Participants → Claim Host in Zoom and enter:",
    }),
    zoomNameScreen(device),
    zoomScreen(device, "toolbar"),
    zoomScreen(device, "claim"),
    doorScreen(device, {
      eyebrow: `You're on the ${t.teamPhrase}`,
      program: t.program,
      hostLine: `Sam R. is ${t.verb} today.`,
      join: "Join →",
      intro: "If you need to step in as host, tap Participants → Claim Host and enter:",
    }),
  ];
}

export const ZOOM_TUTORIALS: Tutorial[] = ZOOM_TEAMS.map((t) => ({
  slug: t.slug,
  title: `Leading a session on Zoom, for ${t.people}`,
  forWhom: t.forWhom,
  summary: "On the day: opening the room from My Home, the host code, joining Zoom by name (no Zoom account), Claim Host, and stepping in as the backup.",
  steps: stepsFor(t),
  screens: { phone: screensFor(t, "phone"), computer: screensFor(t, "computer") },
  help: [
    "If Zoom doesn't open, choose Join as host again. If the website says the session can't open right now, wait a moment and choose Try again.",
    "Anything else: ask your team's coordinators, or write to support@rootedinmindfulness.org and we'll help you in.",
  ],
}));
