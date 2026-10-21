/**
 * Hosting a session on Zoom (2026-10-21, Jesse: "make one for Zoom hosts"):
 * the Hosting Team's day, from My Home to holding host in Zoom, and the
 * backup host's page. Only claiming host, by Jesse's call: nothing here about
 * muting, co-hosts or ending the meeting. The written twin is
 * ZOOM_HOST_GUIDE.md. The Zoom door links here (lib/tutorialLinks.ts).
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

const PROGRAM = "Meditation and Dharma Talk";

const steps: TutorialStep[] = [
  {
    title: "On the day, open My Home",
    words: "Sign in and go to My Home. From 30 minutes before the start, the session you're hosting shows Enter Zoom as host. Choose it.",
    tip: { lead: "Settling in early.", text: "The room is yours from 30 minutes before. Members can come in from 10 minutes before." },
    alt: "My Home with Enter Zoom as host marked.",
  },
  {
    title: "Note the host code, then join",
    words: "This page says You're hosting today and shows the host code. Keep it in view and choose Join as host. Zoom opens.",
    tip: { lead: "The code is for the team.", text: "Members never see it, so please don't post it in the chat." },
    alt: "The host page with Join as host marked and the host code hidden.",
  },
  {
    title: "Type your name the first time",
    words: "The first time Zoom opens on a phone or computer, it asks for your name. Your first name and last initial is fine. You don't need a Zoom account, and Zoom remembers your name next time.",
    tip: { lead: "Signed in to your own Zoom account?", text: "Then Zoom shows that account's name instead, and RIM can't change it." },
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
    tip: { lead: "Don't see Claim Host?", text: "Tap the three dots (•••) at the top of the Participants list and look there. If someone already holds host, that's fine. If no one does and it isn't there, claim host from a computer, or write to support." },
    computer: {
      words: "At the bottom of the Participants list, click Claim host. Type the code from step 2 and click Claim Host. The host controls are now yours.",
      tip: { lead: "Can't find it?", text: "It may be under More (…) at the bottom of the list. If it isn't there at all, someone already holds host, and that's fine." },
      alt: "Zoom's Claim Host box with the code typed and the Claim Host button marked.",
    },
    alt: "Zoom's participant list on a phone with Claim Host marked.",
  },
  {
    title: "If you're the backup host",
    words: "Helping with a session someone else is hosting? Open the Scheduler: from 30 minutes before, the session shows Enter room. This page names today's host and shows the same code. Choose Join. If the host is there, there's nothing to do. If they can't come, claim host with the code so the session is never left without one.",
    tip: { lead: "Only one host at a time.", text: "Whoever holds host can make another person a co-host inside Zoom." },
    alt: "The backup host's page naming today's host, with Join marked.",
  },
];

function screensFor(device: Device) {
  return [
    myHomeScreen(device, {
      date: "Saturday, October 31",
      greeting: "Good morning, Pat.",
      weekButton: false,
      today: <TodayRow time="9:30 AM" pill="Host entry open" open program={PROGRAM} place="Online on Zoom" button="Enter Zoom as host" lines={["Member entry opens at 9:20 AM"]} hl />,
    }),
    doorScreen(device, {
      eyebrow: "You're hosting today",
      program: PROGRAM,
      join: "Join as host →",
      intro: "To take host controls, tap Participants → Claim Host in Zoom and enter:",
    }),
    zoomNameScreen(device),
    zoomScreen(device, "toolbar"),
    zoomScreen(device, "claim"),
    doorScreen(device, {
      eyebrow: "You're on the Hosting Team",
      program: PROGRAM,
      hostLine: "Sam R. is hosting today.",
      join: "Join →",
      intro: "If you need to step in as host, tap Participants → Claim Host and enter:",
    }),
  ];
}

export const hostingOnZoom: Tutorial = {
  slug: "hosting-on-zoom",
  title: "Hosting a session on Zoom",
  forWhom: "For the Hosting Team",
  summary: "On the day: opening the room from My Home, the host code, your name in Zoom, Claim Host, and stepping in as the backup host.",
  topic: "Hosting on Zoom",
  steps,
  screens: { phone: screensFor("phone"), computer: screensFor("computer") },
  help: [
    "If Zoom doesn't open, choose Join as host again. If the website says the session can't open right now, wait a moment and choose Try again.",
    "Anything else: ask your team's coordinators, or write to support@rootedinmindfulness.org and we'll help you in.",
  ],
};
