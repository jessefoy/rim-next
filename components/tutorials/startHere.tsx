/**
 * Start here: four tutorials everyone reads first, in order (2026-10-21,
 * Jesse: "We need people to be able to log in, and that would be the same for
 * everyone… A lot of these people are logging in for the first time, so they
 * need to be able to log into their member area and find out where their
 * teams are… The whole system should be identified: the emails, the
 * scheduler, etc."). Signing in, Finding your way, Your team's space, Emails
 * and notifications. Written for people who aren't comfortable with
 * technology: one action a step, the words on the screen quoted exactly.
 *
 * The examples use the Hosting Team; every team's space works the same way.
 * Which emails follow the person's choice and which always come is
 * lib/notifications.ts and sendTemplatedEmail in lib/email.ts.
 *
 * Wording provisional until Jesse's read-aloud.
 */

import type { Tutorial, TutorialStep } from "./types";
import {
  TodayRow, codeScreen, myHomeScreen, myTeamsScreen, phoneMenuScreen, signInScreen, teamHomeScreen, type Device,
} from "./screens";
import {
  arrivedScreen, conversationsScreen, emailChoiceScreen, emailScreen, filesScreen, membersScreen,
  notificationsScreen, teamDrawerScreen, teamRailBackScreen, updatesScreen, welcomeScreen,
} from "./memberScreens";
import { Header, Page, PersonalRail, cx } from "./drawing";

const SERIES = "Start here";
const HELP = [
  "Ask your team's coordinators (they're marked Coordinator on your team's Members page), or write to support@rootedinmindfulness.org and someone will help you.",
];

/* ---- 1. Signing in ----------------------------------------------------- */

const signingInSteps: TutorialStep[] = [
  {
    title: "Ask for a sign-in code",
    words: "On the RIM website, tap Menu, then Sign in. Type the email address RIM has for you and choose Send code. There's no password to remember.",
    computer: { words: "On the RIM website, choose Members at the top of the page, then Sign in. Type the email address RIM has for you and choose Send code. There's no password to remember." },
    tip: { lead: "Which email?", text: "The one RIM writes to you at. If the page says “We don't have an account for” that address, try your other email, or write to support. (Become a member is for people who are new to RIM.)" },
    alt: "The Sign in page with an email typed in and Send code marked.",
  },
  {
    title: "Open the email with your code",
    words: "In a minute or two, an email arrives from Rooted In Mindfulness with a 6-digit code. If you're reading it on the same phone or computer, choose Sign me in from this device. Otherwise, note the six digits.",
    tip: { lead: "Nothing yet?", text: "Look in your spam or junk folder. The code works for 30 minutes." },
    alt: "The sign-in email with its code and the Sign me in from this device button marked.",
  },
  {
    title: "Type the code and choose Sign in",
    words: "Type the six digits in the boxes and choose Sign in. (If you used the button in the email, the code is already filled in; just choose Sign in.)",
    alt: "The Enter your code page with the code filled in and Sign in marked.",
  },
  {
    title: "The first time: Welcome",
    words: "The very first time, a Welcome page asks for your first and last name and shows our Community Care Agreements. Read them, tick the box, and choose Step back in (or Join the community, if you're new). Leave I'd rather not join alone: it removes your account.",
    tip: { lead: "Your first sign-in matters.", text: "It's what turns on your team's emails. Until you sign in once, your team can't reach you." },
    alt: "The Welcome page with the agreements box ticked and Step back in marked.",
  },
  {
    title: "You're in: this is My Home",
    words: "You arrive at My Home, with the note “You're all set.” From now on, signing in brings you here.",
    tip: { lead: "Next time", text: "is the same: your email, then a code. You usually stay signed in on that phone or computer, so you won't need a code every time." },
    alt: "My Home with the You're all set notice marked.",
  },
  {
    title: "If the code doesn't come",
    words: "Below the code boxes, choose send a new code. If you typed the wrong address, choose Start over and type it again.",
    tip: { lead: "“We could not sign you in”?", text: "The code was wrong or had run out, or there were several tries in a short time. Wait a few minutes, choose Try again, and ask for a new code." },
    alt: "The Enter your code page with send a new code marked.",
  },
  {
    title: "Signing out",
    words: "On a shared phone or computer, sign out when you're done: open Menu and choose Sign out at the bottom.",
    computer: { words: "On a shared computer, sign out when you're done: choose Sign out at the bottom of the column on the left.", alt: "My Home with Sign out marked at the bottom of the column." },
    alt: "The open menu with Sign out marked at the bottom.",
  },
];

function signingInScreens(device: Device) {
  return [
    signInScreen(device),
    emailScreen(device, {
      subject: "Your Rooted In Mindfulness sign-in code: 481207",
      heading: "Your sign-in code",
      lines: ["Enter this code on the sign-in page to access your account:"],
      big: "481207",
      button: "Sign me in from this device",
    }),
    codeScreen(device),
    welcomeScreen(device),
    arrivedScreen(device),
    codeScreen(device, "resend"),
    device === "phone" ? phoneMenuScreen("Sign out") : myHomeScreen(device, { date: "Tuesday, October 27", greeting: "Good morning, Pat.", today: <span className="tut-meta">There are no more sessions today.</span>, railHl: "Sign out" }),
  ];
}

/* ---- 2. Finding your way ----------------------------------------------- */

const findingSteps: TutorialStep[] = [
  {
    title: "My Home is your day",
    words: "My Home shows today's gatherings. On a day you're serving, your session shows here too. This week's schedule shows the whole week.",
    alt: "My Home with today's session marked.",
  },
  {
    title: "Your menu: My RIM",
    words: "Tap Menu at the top of the screen. Under My RIM are your own pages: My Home, Notifications, Library, My Teams, Community Care and My Profile.",
    computer: { words: "The column on the left holds your own pages, under My RIM: My Home, Notifications, Library, My Teams, Community Care and My Profile.", alt: "My Home with the My RIM column marked." },
    tip: { lead: "Lost?", text: "While you're signed in, My Home is always the first thing in the Menu." },
    alt: "The open menu with My RIM marked.",
  },
  {
    title: "Open My Teams",
    words: "Choose My Teams to see the teams you're on.",
    tip: { lead: "Don't see My Teams?", text: "It appears once you're on a team. Ask your coordinator to add you." },
    computer: { alt: "My Home with My Teams marked in the column." },
    alt: "The open menu with My Teams marked.",
  },
  {
    title: "Choose your team",
    words: "Each team you're on is listed. Choose one to go to its own space.",
    tip: { lead: "Don't see your team?", text: "Ask its coordinator to add you, or write to support." },
    alt: "My Teams with a team marked.",
  },
  {
    title: "Your team's home",
    words: "Your team's home shows its tool (the Scheduler) and three of its pages: Conversations, Files and Members.",
    alt: "The team's home with its Scheduler card marked.",
  },
  {
    title: "Your team's pages",
    words: "Just under the top bar, beside your team's name, is ☰. Tap it to see all your team's pages: Home, Scheduler, Updates, Conversations, Files and Members, with My Teams at the bottom.",
    computer: { words: "Your team's pages are in the column on the left: Home, Scheduler, Updates, Conversations, Files and Members.", alt: "The team's home with Updates marked in the column on the left." },
    tip: { lead: "Two menus:", text: "Menu at the top right is for your own pages and the website. ☰ beside the team's name is for this team." },
    alt: "A team page on a phone with the ☰ beside the team's name marked.",
  },
  {
    title: "Getting back",
    words: "Inside a team, tap ☰ and choose My Teams at the bottom to go back to your teams. For My Home, open Menu at the top right: it's first. The RIM logo goes to the website's home page.",
    computer: { words: "Inside a team, My Teams is at the bottom of the column on the left; choose it to go back to your teams. My Home is always at the top right. The RIM logo goes to the website's home page.", alt: "A team page with My Teams marked at the bottom of the column." },
    alt: "The team's ☰ menu open with My Teams marked.",
  },
];

function findingScreens(device: Device) {
  const today = <TodayRow time="9:30 AM" pill="Later today" program="The Art of Meditation" place="Online on Zoom" lines={["Opens at 9:20 AM"]} hl />;
  const home = { date: "Tuesday, October 27", greeting: "Good morning, Pat." };
  return [
    myHomeScreen(device, { ...home, today }),
    device === "phone" ? phoneMenuScreen("My RIM") : railHomeScreen(),
    device === "phone" ? phoneMenuScreen("My Teams") : myHomeScreen(device, { ...home, today: <TodayRow time="9:30 AM" pill="Later today" program="The Art of Meditation" place="Online on Zoom" />, railHl: "My Teams" }),
    myTeamsScreen(device, ["Hosting Team", "Greeter"]),
    teamHomeScreen(device, "Hosting Team", "2 sessions in the next two weeks need a host", { hlCard: true }),
    device === "phone" ? teamDrawerScreen("☰") : teamHomeScreen(device, "Hosting Team", "2 sessions in the next two weeks need a host", { railHl: "Updates" }),
    device === "phone" ? teamDrawerScreen("My Teams") : teamRailBackScreen(),
  ];
}

/** My Home on a computer with the whole My RIM column marked. */
function railHomeScreen() {
  return (
    <Page header={<Header device="computer" />} rail={<div className={cx("tut-rail-wrap", "hl")}><PersonalRail active="My Home" /></div>}>
      <span className="tut-meta">Tuesday, October 27</span>
      <span className="tut-h1">Good morning, Pat.</span>
    </Page>
  );
}

/* ---- 3. Your team's space ---------------------------------------------- */

const spaceSteps: TutorialStep[] = [
  {
    title: "Updates: what's new",
    words: "Tap ☰ beside your team's name, then Updates. It's your team's news, newest first. Tap any line to open the exact thing: the conversation, the file, the session. Unread shows only what you haven't opened yet.",
    computer: { words: "In the column on the left, choose Updates. It's your team's news, newest first. Choose any line to open the exact thing: the conversation, the file, the session. Unread shows only what you haven't opened yet." },
    tip: { lead: "Caught up?", text: "Mark all as read clears the dots. Nothing leaves the list." },
    alt: "The team's Updates with a new reply marked.",
  },
  {
    title: "Needs you",
    words: "At the top of Updates, Needs you lists the sessions in the next two weeks that still need someone. You can take one right there.",
    alt: "Updates with Take this session marked under Needs you.",
  },
  {
    title: "Conversations",
    words: "Conversations are your team's discussions, one topic each. Open Conversations from your team's home (or ☰), and tap a topic to read it.",
    computer: { words: "Conversations are your team's discussions, one topic each. Choose Conversations in the column on the left, then a topic to read it." },
    alt: "The Conversations list with a topic marked.",
  },
  {
    title: "Reply to a conversation",
    words: "At the bottom of a topic, write in the box and choose Post reply. Everyone following the topic is told.",
    tip: { lead: "Follow", text: "beside the title tells you about every reply (by email, as you choose in My Profile). It changes to Following; tap it again to stop." },
    alt: "A conversation with Post reply marked.",
  },
  {
    title: "Start a new topic",
    words: "Choose + New topic, give it a title and write your message, then choose Post topic.",
    tip: { lead: "Who hears?", text: "Your team's coordinators are told automatically. Under Notify team members you can tick anyone else who should see it." },
    alt: "The new topic form with Post topic marked.",
  },
  {
    title: "Files",
    words: "Files holds your team's shared documents. Tap one to open it right here.",
    tip: { lead: "Looking for something?", text: "Type part of its name in Search file names." },
    alt: "The team's Files with a document marked.",
  },
  {
    title: "A file's page",
    words: "A document opens on its own page. To change it, choose Edit in Google Docs; it opens in Google, and you don't need a Google account. Below it, you can leave a comment for the team. Remove doesn't delete anything at once: it asks a team lead.",
    tip: { lead: "In Google,", text: "your edits may show as “Anonymous” with an animal's name. That's normal. On a phone, Google may offer its Docs app; either works." },
    alt: "A file's page with Edit in Google Docs marked.",
  },
  {
    title: "Members",
    words: "Members lists everyone on your team. The Coordinators at the top are your team's leads: the people to ask.",
    alt: "The team's Members with the Coordinators marked.",
  },
];

function spaceScreens(device: Device) {
  return [
    updatesScreen(device, "row"),
    updatesScreen(device, "take"),
    conversationsScreen(device, "list"),
    conversationsScreen(device, "reply"),
    conversationsScreen(device, "new"),
    filesScreen(device, "list"),
    filesScreen(device, "file"),
    membersScreen(device),
  ];
}

/* ---- 4. Emails and notifications --------------------------------------- */

const emailSteps: TutorialStep[] = [
  {
    title: "Every email has one way in",
    words: "Each RIM email has one button or link, and it takes you to the exact place: the session, the conversation, the file. If you're not signed in on that phone or computer, you'll be asked to sign in first.",
    alt: "An email that a session needs a host, with Open the schedule marked.",
  },
  {
    title: "Notifications: everything in one place",
    words: "Everything RIM emails you is also on your Notifications page, under My RIM. Tap a line to read it.",
    alt: "Notifications with a line marked.",
  },
  {
    title: "Open one",
    words: "A line opens in place, with its details and one button to go there. Opening it marks it read.",
    alt: "An opened notification with Open the schedule marked.",
  },
  {
    title: "Just one team, or one kind",
    words: "From shows news from one team. View shows one kind: Schedule, Conversations, Files, Programs, or Your account.",
    alt: "Notifications with the From choice open.",
  },
  {
    title: "Choose how team news is emailed",
    words: "In My Profile, under Notifications, choose Email me each one, One email a day, or Don't email me team news. Then choose Save email choice.",
    tip: { lead: "Always sent:", text: "emails about you, your sessions, your registrations and your account come whatever you choose, and so does a session that needs someone within two days." },
    alt: "My Profile's email choice with Save email choice marked.",
  },
];

function emailScreens(device: Device) {
  return [
    emailScreen(device, {
      subject: "Needs a host: The Art of Meditation · Tue, Oct 27 at 9:30 AM",
      lines: ["Hi Pat,", "This session coming up has no host now:", "The Art of Meditation · Tue, Oct 27 at 9:30 AM", "If you can take it, you'll find it on the schedule."],
      button: "Open the schedule",
    }),
    notificationsScreen(device, "list"),
    notificationsScreen(device, "open"),
    notificationsScreen(device, "from"),
    emailChoiceScreen(device),
  ];
}

const EMAILS = {
  heading: "The emails you may get",
  intro: "All of these but the sign-in code, the new-member welcome and the daily summary are also on your Notifications page. The ones marked team news follow the choice you make in My Profile; the rest always come.",
  groups: [
    {
      title: "Signing in and joining",
      items: [
        { name: "Your Rooted In Mindfulness sign-in code", text: "Your 6-digit code. It works for 30 minutes." },
        { name: "Welcome back to Rooted In Mindfulness", text: "A letter after your first sign-in, if you were a member on the old website. (New members get “Welcome to Rooted In Mindfulness”.)" },
        { name: "Welcome to [your team]", text: "You've been added to a team. Open your team takes you to its space." },
      ],
    },
    {
      title: "Your own sessions (always sent)",
      items: [
        { name: "You're hosting: [program] · [date]", text: "You're confirmed for a session, in your team's words (greeting, covering AV, facilitating)." },
        { name: "Reminder: you're hosting · [program] · [date]", text: "Two days before your session, with everyone serving it." },
        { name: "Your session is covered", text: "A teammate took the session you asked cover for." },
        { name: "You're no longer hosting: [program] · [date]", text: "A lead took you off a session." },
        { name: "Your [team] schedule has changed, or [program] has a new schedule", text: "Sessions you were on no longer take place, or you're no longer on that team." },
      ],
    },
    {
      title: "Your regular turns, or rotations (always sent)",
      items: [
        { name: "You're scheduled for [program]", text: "A lead put you on a rotation, and these sessions are now yours." },
        { name: "You're no longer scheduled for [program] on [date]", text: "A rotation change took a session from you." },
        { name: "You've been removed from the [program] rotation", text: "A lead took you off a rotation." },
        { name: "Your [role] rotation has ended", text: "A rotation you were on has ended, and its sessions are open." },
      ],
    },
    {
      title: "When your team needs someone (team news)",
      items: [
        { name: "Cover needed: [program] on [date]", text: "A teammate asked for someone to take their session. Cover this session opens it." },
        { name: "Needs a host: [program] · [date]", text: "A session coming up has no one now." },
        { name: "[N] sessions in the next two weeks need a host", text: "Every Monday, the open sessions for the next two weeks." },
        { name: "New program added: [program]", text: "A new program your team may help with." },
      ],
    },
    {
      title: "Conversations and files (team news)",
      items: [
        { name: "New conversation in [team]: [title]", text: "Someone started a topic and asked for you to be told." },
        { name: "New reply in [team]: [title]", text: "A reply in a topic you follow." },
        { name: "[Name] shared “[file]” with [team]", text: "A file shared with your team." },
        { name: "[Name] commented on “[file]”", text: "A comment on a file, for those asked to be told." },
        { name: "What's new on your teams", text: "Only if you chose One email a day: one morning summary in place of the separate emails." },
      ],
    },
    {
      title: "Programs you register for (always sent)",
      items: [
        { name: "You're registered — [program]", text: "Your registration, with the date, place and an Add to calendar link." },
        { name: "Your dana receipt for [program]", text: "A record of your gift, for your taxes." },
        { name: "Reminder: [program]", text: "Before a program you registered for." },
      ],
    },
    {
      title: "Only for team leads",
      items: [
        { name: "[Team]: [N] sessions need a decision", text: "The lead's brief: on Mondays when there's something to decide or something changed, and on other days when a session two days away still needs someone." },
      ],
    },
  ],
};

/* ---- The four ---------------------------------------------------------- */

export const START_HERE_TUTORIALS: Tutorial[] = [
  {
    slug: "signing-in",
    title: "Signing in",
    forWhom: "For everyone",
    summary: "Your email, the code, your first visit's Welcome page, and what to do if the code doesn't come.",
    series: { name: SERIES, part: 1, of: 4 },
    nextTutorial: "finding-your-way",
    steps: signingInSteps,
    screens: { phone: signingInScreens("phone"), computer: signingInScreens("computer") },
    help: HELP,
  },
  {
    slug: "finding-your-way",
    title: "Finding your way",
    forWhom: "For everyone",
    summary: "My Home, your menu, and finding your teams.",
    series: { name: SERIES, part: 2, of: 4 },
    nextTutorial: "your-teams-space",
    steps: findingSteps,
    screens: { phone: findingScreens("phone"), computer: findingScreens("computer") },
    help: HELP,
  },
  {
    slug: "your-teams-space",
    title: "Your team's space",
    forWhom: "For everyone on a team",
    summary: "Updates and Needs you, Conversations, Files, and Members.",
    series: { name: SERIES, part: 3, of: 4 },
    nextTutorial: "emails-and-notifications",
    steps: spaceSteps,
    screens: { phone: spaceScreens("phone"), computer: spaceScreens("computer") },
    help: HELP,
  },
  {
    slug: "emails-and-notifications",
    title: "Emails and notifications",
    forWhom: "For everyone",
    summary: "What RIM emails you and why, your Notifications page, and choosing how team news reaches you.",
    series: { name: SERIES, part: 4, of: 4 },
    steps: emailSteps,
    screens: { phone: emailScreens("phone"), computer: emailScreens("computer") },
    reference: EMAILS,
    help: HELP,
  },
];
