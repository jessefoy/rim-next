/**
 * For team leads (2026-10-21, Jesse: the leads' tutorials "right after" the
 * members'): Leading your team, for every lead; The Scheduler for leads, for
 * the coordinators of the four Scheduler teams. A lead is an ACTIVE
 * coordinator (effectiveCoordinator; the Scheduler's isManager). The words are
 * the app's own, checked on 2026-10-21 against HubHomeModules, HubMembersClient,
 * FilesBrowser, HubScheduleClient, RotationsClient, RotationConflictModal and
 * lib/teamBrief.ts. Examples use the Hosting Team; where an open sign-up team
 * (greeters) works differently, the step says so.
 *
 * Wording provisional until Jesse's read-aloud.
 */

import type { ReactNode } from "react";
import type { Tutorial, TutorialStep } from "./types";
import { Dialog, Header, Page, ScheduleRow, SignUpState, TeamRail, cx } from "./drawing";
import { DialogActions, type Device } from "./screens";
import { emailScreen } from "./memberScreens";

const TEAM = "Hosting Team";
const ART = "The Art of Meditation";
const HELP = [
  "Questions about leading your team: write to support@rootedinmindfulness.org, or ask Jesse.",
];

function teamPage(device: Device, active: string, children: ReactNode, overlay?: ReactNode) {
  return (
    <div className="tut-screen tut-screen--layer">
      <Page header={<Header device={device} />} rail={<TeamRail device={device} team={TEAM} active={active} />}>
        <div className={cx("tut-stack", overlay ? "tut-dim" : null)}>{children}</div>
      </Page>
      {overlay && <Dialog>{overlay}</Dialog>}
    </div>
  );
}

/* ---- Leading your team ------------------------------------------------- */

function person(name: string, opts: { badge?: string; flag?: string; flagHl?: boolean; edit?: boolean } = {}) {
  return (
    <span className="tut-person">
      <span className="tut-person__av">{name.split(" ").map((w) => w[0]).join("")}</span>
      <span className="tut-person__main">
        <span><b>{name}</b>{opts.badge && <span className="tut-pill">{opts.badge}</span>}</span>
        {opts.flag && <small className={cx("tut-flag", opts.flagHl && "hl")}>{opts.flag}</small>}
      </span>
      {opts.edit !== false && <span className="tut-link">Edit</span>}
    </span>
  );
}

function leadHome(device: Device) {
  return teamPage(device, "Home", (
    <>
      <span className="tut-h1">{TEAM}</span>
      <span className="tut-meta">Your team&rsquo;s shared space. <span className="tut-link hl">Write this team&rsquo;s line</span></span>
      <div className="tut-card">
        <span className="tut-eyebrow">This team&rsquo;s tool</span>
        <span className="tut-h2">Scheduler</span>
        <span className="tut-meta">2 sessions in the next two weeks need a host</span>
        <span className="tut-btn">Open the Scheduler</span>
      </div>
    </>
  ));
}

function leadMembers(device: Device, stage: "list" | "add" | "edit" | "pause") {
  const list = (
    <div className="tut-list">
      {person("Sam R.")}
      {person("Jordan K.", { flag: "Hasn’t signed in yet. Team emails start when they do.", flagHl: stage === "list" })}
      {person("Alex M.")}
    </div>
  );
  if (stage === "add") {
    return teamPage(device, "Members", (
      <>
        <span className="tut-week"><span className="tut-h1">Members</span><span className="tut-btn">+ Add Member</span></span>
        <span className="tut-input">rob</span>
        <div className="tut-list"><span className="tut-list__row hl"><span><b>Robin T.</b><small>robin@example.com</small></span><span>+</span></span></div>
        <span className="tut-meta">Someone who hasn&rsquo;t signed in to the new site yet won&rsquo;t appear here. An admin or the registrar can add them from the Member Registry.</span>
      </>
    ));
  }
  if (stage === "edit") {
    return teamPage(device, "Members", (
      <>
        <span className="tut-h1">Members</span>
        <div className="tut-card">
          <span><b>Sam R.</b></span>
          <span className="tut-label">Status</span>
          <span className="tut-input">Active ▾</span>
          <span className="tut-check"><span className="tut-check__box tut-check__box--off" />Coordinator</span>
          <span className="tut-check"><span className="tut-check__box">✓</span>Can take sessions on the schedule</span>
          <span className="tut-check"><span className="tut-check__box">✓</span>Receives team notifications</span>
          <span className="tut-label">Coordinator note (private)</span>
          <span className="tut-area">Away in November.</span>
          <span className="tut-btn hl">Save</span>
        </div>
      </>
    ));
  }
  if (stage === "pause") {
    return teamPage(device, "Members", (<><span className="tut-h1">Members</span>{list}</>), (
      <>
        <span className="tut-h2 hl">Take Sam R. off the schedule?</span>
        <span className="tut-p">Sam R. has 2 upcoming sessions on this team&rsquo;s schedule. If they keep them, they won&rsquo;t be let into those sessions as host.</span>
        <span className="tut-actions"><span className="tut-link">Cancel</span><span className="tut-btn">Keep their sessions</span><span className="tut-btn">Take them off their sessions</span></span>
      </>
    ));
  }
  return teamPage(device, "Members", (
    <>
      <span className="tut-week"><span className="tut-h1">Members</span><span className="tut-btn">+ Add Member</span></span>
      {list}
    </>
  ));
}

function leadFiles(device: Device, stage: "areas" | "pending") {
  return teamPage(device, "Files", (
    <>
      <span className="tut-h1">Files</span>
      <span className="tut-tabs"><span className={cx(stage === "pending" && "on")}>Team files</span><span className={cx(stage === "areas" && "on hl")}>Leads only</span></span>
      {stage === "areas" ? (
        <>
          <span className="tut-meta">Leads only: visible to this team&rsquo;s leads. To share something with everyone, use &ldquo;Move to Team files&rdquo; in its menu.</span>
          <div className="tut-list">
            <span className="tut-list__row"><span><b>Rotation planning</b><small>Spreadsheet · Updated today</small></span><span>⋯</span></span>
            <span className="tut-list__row"><span><b>New host training notes</b><small>Document · Updated last week</small></span><span>⋯</span></span>
          </div>
        </>
      ) : (
        <>
          <span className="tut-eyebrow">Pending removal</span>
          <span className="tut-meta">Approve to remove these, or keep them for the team.</span>
          <div className="tut-card">
            <span><b>Old sign-up sheet</b></span>
            <span className="tut-meta">Requested by Alex M. · 2 days ago</span>
            <span className="tut-actions"><span className="tut-btn hl">Approve removal</span><span className="tut-link">Keep</span></span>
          </div>
        </>
      )}
    </>
  ));
}

const leadingSteps: TutorialStep[] = [
  {
    title: "Your team's line",
    words: "On your team's home, choose Write this team's line (or Edit this line). Type one sentence about the team, for everyone on it, and choose Save.",
    alt: "The team's home with Write this team's line marked.",
  },
  {
    title: "See who hasn't signed in",
    words: "On Members, anyone who hasn't signed in to the new site yet shows “Hasn't signed in yet.” Until they do, they get none of the team's emails. A friendly word from you is often all it takes.",
    tip: { lead: "Only leads see this.", text: "Members don't see each other's sign-in or email addresses." },
    alt: "Members with Hasn't signed in yet marked on one person.",
  },
  {
    title: "Add someone to the team",
    words: "Choose + Add Member, type at least three letters of their name or email, and choose them in the list.",
    tip: { lead: "Not in the list?", text: "Someone who hasn't signed in to the new site yet won't appear. An admin or the registrar can add them from the Member Registry." },
    alt: "The Add Member search with a person marked.",
  },
  {
    title: "Change a member's settings",
    words: "Choose Edit beside a name. You can set their Status, make them a Coordinator, choose Can take sessions on the schedule and Receives team notifications, and keep a private Coordinator note. Choose Save.",
    alt: "A member's settings with Save marked.",
  },
  {
    title: "Paused or Inactive",
    words: "Paused is for a break. If they have sessions coming, you're asked: Keep their sessions, or Take them off their sessions so the team can take them. Inactive means they've left the team: their sessions open, their rotations end, and the team hears about any in the next two weeks.",
    tip: { lead: "Back again?", text: "Set them to Active. Their pause note clears." },
    alt: "The Take off the schedule? question marked.",
  },
  {
    title: "Files for leads only",
    words: "In Files, you'll see Team files and Leads only. Leads only is for the team's leads. To share a file with everyone, open its ⋯ menu and choose Move to Team files (or Move to Leads only to keep one among the leads).",
    alt: "Files with the Leads only area marked.",
  },
  {
    title: "Approve or keep a removal",
    words: "When someone asks to remove a file, it waits under Pending removal. Approve removal sends it to Google's trash; if that was a mistake, write to support within 30 days to get it back. Keep leaves it in place.",
    alt: "Pending removal with Approve removal marked.",
  },
  {
    title: "Your Monday brief",
    words: "On Mondays when there's something to decide or something changed, you get one email laid out for decisions: each open session, why it's open, who on the team can take it, and what changed since last Monday. On other days it comes only when a session two days away still needs someone.",
    tip: { lead: "Every new topic too:", text: "as a lead, you're told about every new conversation on your team." },
    alt: "The lead's brief email with Open the schedule marked.",
  },
];

function leadingScreens(device: Device) {
  return [
    leadHome(device),
    leadMembers(device, "list"),
    leadMembers(device, "add"),
    leadMembers(device, "edit"),
    leadMembers(device, "pause"),
    leadFiles(device, "areas"),
    leadFiles(device, "pending"),
    emailScreen(device, {
      subject: "Hosting Team: 2 sessions need a decision",
      lines: [
        "Hi Pat,",
        "Here is the Hosting Team for the next two weeks.",
        "Needs your decision",
        "The Art of Meditation · Tue, Oct 27 at 9:30 AM. No host yet. Can take it: Sam R. and Alex M.",
        "All set: 6 of 8 sessions in the next two weeks have a host.",
      ],
      button: "Open the schedule",
    }),
  ];
}

/* ---- The Scheduler for leads ------------------------------------------- */

function leadSchedule(device: Device, rows: ReactNode, { alertHl = false, overlay }: { alertHl?: boolean; overlay?: ReactNode } = {}) {
  return teamPage(device, "Scheduler", (
    <>
      <span className="tut-tabs"><span className="on">Schedule</span><span>Rotations</span></span>
      <span className="tut-h1">October 2026</span>
      <span className="tut-pills"><span className="on">All 16</span><span className={cx("tut-pill-alert", alertHl && "hl")}>Needs help 2</span><span>My schedule 3 ▾</span></span>
      <span className="tut-week"><span className="tut-h2">This week</span><span className="tut-meta">4 sessions</span></span>
      {rows}
    </>
  ), overlay);
}

const row = (day: string, date: string, program: string, tag: string, state: ReactNode) => ({ day, date, time: "9:30 AM", program, tag, state });

function openRow(device: Device, hl: boolean) {
  return (
    <ScheduleRow device={device} {...row("TUE", "27", ART, "In-person and virtual",
      <span className="tut-row__stack">
        <span className="tut-state">Host needed</span>
        <span className="tut-btn">Yes, I can host this</span>
        <span className={cx("tut-link", hl && "hl")}>Assign someone…</span>
      </span>)} />
  );
}

function coveredRow(device: Device, menu: boolean, hl: boolean) {
  return (
    <ScheduleRow device={device} {...row("THU", "29", "Essential Dharma Study", "Virtual · via rotation",
      <span className="tut-row__stack">
        <span className="tut-meta">Host: Sam R.</span>
        <span className={cx("tut-link", hl && !menu && "hl")}>Manage coverage ▾</span>
        {menu && (
          <span className="tut-menu-list hl">
            <span>Ask the team to cover</span><span>Remove host</span><span>Reassign to me</span>
          </span>
        )}
      </span>)} />
  );
}

function askedRow(device: Device, hl: boolean) {
  return (
    <ScheduleRow device={device} {...row("SAT", "31", "Meditation and Dharma Talk", "In-person and virtual",
      <span className="tut-row__stack">
        <span className="tut-state">Alex M. needs help</span>
        <span className="tut-btn">Yes, I can cover</span>
        <span className={cx("tut-link", hl && "hl")}>Clear request</span>
      </span>)} />
  );
}

function greeterRow(device: Device) {
  return teamPage(device, "Scheduler", (
    <>
      <span className="tut-tabs"><span className="on">Schedule</span><span>Rotations</span></span>
      <span className="tut-h1">October 2026</span>
      <ScheduleRow device={device} {...row("TUE", "27", ART, "In-person and virtual",
        <span className="tut-row__stack">
          <SignUpState header="We have 2 greeters" names={["Sam R.", "Alex M."]} removable="Alex M." hlRemove={false} />
        </span>)} />
    </>
  ), (
    <>
      <span className="tut-h2">Remove this sign-up?</span>
      <span className="tut-p">This takes Alex M. off {ART} on Tuesday, October 27. They&rsquo;ll be notified.</span>
      <DialogActions yes="Yes, remove" no="Keep them on" />
    </>
  ));
}

function rotationsPage(device: Device, children: ReactNode, overlay?: ReactNode) {
  return teamPage(device, "Scheduler", (
    <>
      <span className="tut-tabs"><span>Schedule</span><span className="on">Rotations</span></span>
      <span className="tut-meta">Standing rotations automatically schedule people for sessions matching a recurring pattern. Saving a rotation applies it immediately to future sessions.</span>
      {children}
    </>
  ), overlay);
}

function rotationGrid(hl: "set-up" | "reset" | null, saved = false) {
  return (
    <div className="tut-card">
      <span className="tut-week"><span className="tut-h2">{ART}</span><span className="tut-pill">Hybrid</span></span>
      <div className="tut-grid">
        <span className="tut-grid__head" /><span className="tut-grid__head">1st</span><span className="tut-grid__head">2nd</span><span className="tut-grid__head">3rd</span><span className="tut-grid__head">4th</span><span className="tut-grid__head">5th</span>
        {/* Set up shows only on a day with no rotation yet (RotationsClient). */}
        {hl === "set-up"
          ? (<><span className="tut-grid__day">Tuesday</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></>)
          : (<><span className="tut-grid__day">Tuesday</span><span>Sam R.</span><span>Alex M.</span><span>Sam R.</span><span>Alex M.</span><span>—</span></>)}
      </div>
      <span className="tut-actions">
        {hl === "set-up" ? <span className="tut-link hl">Set up</span> : (<><span className="tut-link">Edit</span><span className={cx("tut-link", hl === "reset" && "hl")}>Reset Tuesday</span></>)}
      </span>
      {saved && (
        <span className="tut-saved hl">
          <b>✓ Tuesday&rsquo;s rotation saved</b>
          <span className="tut-meta">3 sessions filled across this month and next</span>
          <span className="tut-meta">Next sessions: Oct 27 Sam R. · Nov 3 Alex M. · Nov 10 Sam R.</span>
        </span>
      )}
    </div>
  );
}

function rotationForm(device: Device, pattern: "every-week" | "other-week") {
  const choices = [
    ["Same every week", "The same person every week"],
    ["Every other week", "Two people take turns, week by week, from the date you choose"],
    ["Alternate by week of the month", "Two people, 1st & 3rd / 2nd & 4th of the month"],
    ["Custom", "Set each week of the month independently"],
  ];
  const on = pattern === "every-week" ? 0 : 1;
  return rotationsPage(device, (
    <div className="tut-card">
      <span className="tut-label">Pattern</span>
      {choices.map(([t, h], i) => (
        <span key={t} className={cx("tut-choice", i === on && "tut-choice--on")}><b>{t}</b><small>{h}</small></span>
      ))}
      {pattern === "every-week" ? (
        <>
          <span className="tut-label">Every week</span>
          <span className="tut-input">Sam R. ▾</span>
          <span className="tut-actions"><span className="tut-btn hl">Save &amp; apply</span><span className="tut-link">Cancel</span></span>
        </>
      ) : (
        <>
          <span className="tut-label">Starting</span>
          <span className="tut-input hl">Tue, Oct 27 ▾</span>
          <span className="tut-label">First person</span>
          <span className="tut-input">Sam R. ▾</span>
          <span className="tut-label">Second person</span>
          <span className="tut-input">Alex M. ▾</span>
        </>
      )}
    </div>
  ));
}

const leadSchedulerSteps: TutorialStep[] = [
  {
    title: "What a lead sees",
    words: "As a lead, the Scheduler has two tabs: Schedule and Rotations. On Schedule, Needs help turns amber when sessions still need someone; choose it to see just those.",
    tip: { lead: "Greeter leads:", text: "the amber Needs help is for teams with one person per session. On an open sign-up team, people sign up themselves." },
    alt: "The lead's Scheduler with the amber Needs help marked.",
  },
  {
    title: "Assign someone to an open session",
    words: "On a session marked Host needed (in your team's words), choose Assign someone…, then choose a person from the list. They're emailed a confirmation.",
    alt: "An open session with Assign someone… marked.",
  },
  {
    title: "Manage coverage",
    words: "On a session someone has, choose Manage coverage. Ask the team to cover asks for a replacement while they stay on it. Remove takes them off, and Reassign to me puts you on it instead.",
    alt: "The Manage coverage choices marked.",
  },
  {
    title: "Remove someone from a session",
    words: "Remove asks first. The session opens again, the person is told, and if it's within two weeks the team hears that it needs someone. Choose Yes, remove, or Keep them on.",
    alt: "The Remove them from this session? box with Yes, remove marked.",
  },
  {
    title: "Clear a cover request",
    words: "When someone asked for cover but will make it after all, choose Clear request on their session, then Yes, clear the request. The request closes and they keep the session.",
    alt: "A cover request with Clear request marked.",
  },
  {
    title: "Greeter leads: remove a sign-up",
    words: "On an open sign-up team, there's no assigning or cover requests. Choose Remove beside a person's name, then Yes, remove. They're told, and if no one is left and the session is within two weeks, the team hears.",
    alt: "A greeter session with a sign-up's Remove marked.",
  },
  {
    title: "Rotations: the regular turns",
    words: "Rotations fill sessions automatically from a pattern. Each program shows a row for each day it meets, with who has each week of the month. Choose Set up on a day with no rotation yet, or Edit on one already set.",
    alt: "The Rotations tab with Set up marked.",
  },
  {
    title: "Set up a rotation",
    words: "Choose a Pattern: Same every week, Every other week, Alternate by week of the month, or Custom. Choose the person (or people), check the Preview, and choose Save & apply.",
    tip: { lead: "5th weeks", text: "are optional: add a 5th-week person, or leave it and that week is covered or skipped as the form says." },
    alt: "The rotation form with Save & apply marked.",
  },
  {
    title: "Every other week",
    words: "For two people taking turns week by week, choose Every other week. Under Starting, choose the first person's first session; then choose the First person and the Second person.",
    alt: "The Every other week choices with Starting marked.",
  },
  {
    title: "Saved, and what it filled",
    words: "After Save & apply, a note says the day's rotation is saved, how many sessions it filled, and who has the next ones.",
    tip: { lead: "Someone already on a date?", text: "You're asked first: Leave them alone, Replace all, or Decide one by one. Cover requests and people who took a session themselves are kept unless you choose otherwise." },
    alt: "The rotation saved note marked.",
  },
  {
    title: "Change or end a rotation",
    words: "Choose Reset Tuesday (the day's name) to change it: Remove from rotation takes one person off, Set end date keeps sessions up to a date, and Reset that day's rotation clears it. Everyone affected is emailed.",
    tip: { lead: "Just one date?", text: "If someone can't make one session, they use Ask the team to cover on the Schedule tab instead (greeters cancel that sign-up)." },
    alt: "A rotation with Reset Tuesday marked.",
  },
];

function leadSchedulerScreens(device: Device) {
  return [
    leadSchedule(device, <>{openRow(device, false)}{coveredRow(device, false, false)}</>, { alertHl: true }),
    leadSchedule(device, <>{openRow(device, true)}{coveredRow(device, false, false)}</>),
    leadSchedule(device, <>{openRow(device, false)}{coveredRow(device, true, true)}</>),
    leadSchedule(device, <>{coveredRow(device, false, false)}</>, {
      overlay: (
        <>
          <span className="tut-h2">Remove them from this session?</span>
          <span className="tut-p">This takes Sam R. off Essential Dharma Study on Thursday, October 29. The session reopens as needing coverage, and they&rsquo;ll be notified. The team will hear that it needs a host.</span>
          <DialogActions yes="Yes, remove" no="Keep them on" />
        </>
      ),
    }),
    leadSchedule(device, <>{askedRow(device, true)}</>),
    greeterRow(device),
    rotationsPage(device, rotationGrid("set-up")),
    rotationForm(device, "every-week"),
    rotationForm(device, "other-week"),
    rotationsPage(device, rotationGrid(null, true)),
    rotationsPage(device, rotationGrid("reset")),
  ];
}

export const LEAD_TUTORIALS: Tutorial[] = [
  {
    slug: "leading-your-team",
    title: "Leading your team",
    forWhom: "For team leads",
    summary: "Your team's line, Members (who hasn't signed in, adding, pausing), Leads only files, removal requests, and your Monday brief.",
    nextTutorial: "scheduler-for-leads",
    steps: leadingSteps,
    screens: { phone: leadingScreens("phone"), computer: leadingScreens("computer") },
    help: HELP,
  },
  {
    slug: "scheduler-for-leads",
    title: "The Scheduler for leads",
    forWhom: "For leads of the Scheduler teams",
    summary: "Assigning and removing, cover requests, greeters' sign-ups, and setting up, changing and ending rotations.",
    steps: leadSchedulerSteps,
    screens: { phone: leadSchedulerScreens("phone"), computer: leadSchedulerScreens("computer") },
    help: HELP,
  },
];
