/**
 * The screens tutorials share, drawn from components/tutorials/drawing.tsx and
 * set with each tutorial's own team, words and examples. The words on each
 * screen are the app's own (checked against the components on 2026-10-21).
 */

import type { ReactNode } from "react";
import { Dialog, Header, Page, PersonalRail, TeamRail, cx } from "./drawing";

export type Device = "phone" | "computer";

export function signInScreen(device: Device) {
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

export function codeScreen(device: Device, hl: "sign-in" | "resend" = "sign-in") {
  return (
    <Page header={<Header device={device} signedIn={false} />} center={device === "computer"}>
      <span className="tut-eyebrow">Members</span>
      <span className="tut-h1">Enter your code</span>
      <span className="tut-p">We sent a 6-digit code to pat@example.com. It expires in 30 minutes.</span>
      <span className="tut-label">6-digit code</span>
      <span className="tut-codes">{["4", "8", "1", "2", "0", "7"].map((d, i) => <span key={i}>{d}</span>)}</span>
      <span className={cx("tut-btn", hl === "sign-in" && "hl")}>Sign in →</span>
      <span className="tut-meta">Didn&rsquo;t receive it? Check your spam folder, or <span className={cx("tut-link", hl === "resend" && "hl")}>send a new code</span>.</span>
      <span className="tut-meta">Wrong email? <span className="tut-link">Start over.</span></span>
    </Page>
  );
}

/** One of Today's sessions on My Home. */
export function TodayRow({
  time,
  pill,
  open = false,
  program,
  place,
  button,
  lines = [],
  hl = false,
}: {
  time: string;
  pill: string;
  open?: boolean;
  program: string;
  place?: string;
  button?: string;
  lines?: string[];
  hl?: boolean;
}) {
  return (
    <div className={cx("tut-card", hl && !button && "hl")}>
      <div className="tut-today">
        <span className="tut-time">{time}<span className={cx("tut-pill", open && "tut-pill--open")}>{pill}</span></span>
        <span className="tut-stack">
          <span className="tut-h2">{program}</span>
          {place && <span className="tut-meta">{place}</span>}
          {button && <span className={cx("tut-btn", hl && "hl")}>{button}</span>}
          {lines.map((l) => <span key={l} className="tut-meta">{l}</span>)}
        </span>
      </div>
    </div>
  );
}

/** My Home: the day, the greeting, and Today. */
export function myHomeScreen(
  device: Device,
  { date, greeting, today, railHl, weekButton = true }: { date: string; greeting: string; today: ReactNode; railHl?: string; weekButton?: boolean },
) {
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail active="My Home" hl={railHl} /> : undefined}>
      <span className="tut-meta">{date}</span>
      <span className="tut-h1">{greeting}</span>
      <span className="tut-eyebrow">Today</span>
      {today}
      {weekButton && <span className="tut-btn tut-btn--ghost">This week&rsquo;s schedule →</span>}
    </Page>
  );
}

/** The phone's open menu, one item marked (My Teams unless said). */
export function phoneMenuScreen(hl: string = "My Teams") {
  const mine = ["My Home", "Notifications", "Library", "My Teams", "♥  Community Care", "My Profile"];
  return (
    <div className="tut-screen tut-sheet">
      <Header device="phone" open />
      <div className="tut-sheet__body">
        <span className={cx("tut-eyebrow", hl === "My RIM" && "hl")}>My RIM</span>
        {mine.map((label) => (
          <span key={label} className={cx("tut-sheet__link", label === hl && "hl")}>{label}</span>
        ))}
        <span className="tut-sheet__link tut-dim">New to RIM</span>
      </div>
      <div className="tut-sheet__foot">
        <span className={cx("tut-sheet__signout", hl === "Sign out" && "hl")}>Sign out</span>
        <span className="tut-donate tut-donate--block">Donate</span>
      </div>
    </div>
  );
}

export function myTeamsScreen(device: Device, team: string | string[]) {
  const teams = Array.isArray(team) ? team : [team];
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail active="My Teams" /> : undefined}>
      <span className="tut-h1">My Teams</span>
      <span className="tut-p">Choose a team to find its conversations, files, and shared work.</span>
      <div className="tut-list">
        {teams.map((t, i) => (
          <span key={t} className={cx("tut-list__row", i === 0 && "hl")}><b>{t}</b><span>→</span></span>
        ))}
      </div>
    </Page>
  );
}

/** A team's Home: its line, the Scheduler card (`needs` is its summary), the destinations. */
export function teamHomeScreen(device: Device, team: string, needs: string, { hlCard = false, railHl }: { hlCard?: boolean; railHl?: string } = {}) {
  return (
    <Page header={<Header device={device} />} rail={<TeamRail device={device} team={team} active="Home" hl={railHl} />}>
      <span className="tut-h1">{team}</span>
      <span className="tut-meta">Your team&rsquo;s shared space.</span>
      <div className={cx("tut-card", hlCard && "hl")}>
        <span className="tut-eyebrow">This team&rsquo;s tool</span>
        <span className="tut-h2">Scheduler</span>
        <span className="tut-meta">{needs}</span>
        <span className={cx("tut-btn", !hlCard && !railHl && "hl")}>Open the Scheduler</span>
      </div>
      <div className="tut-list">
        <span className="tut-list__row"><span><b>Conversations</b><small>Read and join team discussions</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Files</b><small>Find documents and shared resources</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Members</b><small>Find the people on your team</small></span><span>→</span></span>
      </div>
    </Page>
  );
}

/** The Scheduler's list, with a dialog over it when there is one. */
export function schedulerScreen(
  device: Device,
  team: string,
  rows: ReactNode,
  { dialog, pillHl = false, counts = { all: 22, needs: 2, mine: 4, week: 12 } }: { dialog?: ReactNode; pillHl?: boolean; counts?: { all: number; needs: number; mine: number; week: number } } = {},
) {
  return (
    <div className="tut-screen tut-screen--layer">
      <Page header={<Header device={device} />} rail={<TeamRail device={device} team={team} active="Scheduler" />}>
        <div className={cx("tut-stack", dialog ? "tut-dim" : null)}>
          <span className="tut-h1">October 2026</span>
          <span className="tut-pills">
            <span className="on">All {counts.all}</span>
            <span>Needs help {counts.needs}</span>
            <span className={cx(pillHl && "hl")}>My schedule {counts.mine} ▾</span>
          </span>
          <span className="tut-week"><span className="tut-h2">This week</span><span className="tut-meta">{counts.week} sessions</span></span>
          {rows}
        </div>
      </Page>
      {dialog && <Dialog>{dialog}</Dialog>}
    </div>
  );
}

/** A dialog's buttons: the one to choose, and the way out. */
export function DialogActions({ yes, no = "Not yet" }: { yes: string; no?: string }) {
  return (
    <span className="tut-actions"><span className="tut-btn hl">{yes}</span><span className="tut-btn tut-btn--ghost">{no}</span></span>
  );
}

/** A team's Updates, with one session under Needs you. */
export function needsYouScreen(device: Device, team: string, { what, needs, button }: { what: string; needs: string; button: string }) {
  return (
    <Page header={<Header device={device} />} rail={<TeamRail device={device} team={team} active="Updates" />}>
      <span className="tut-h1">Updates</span>
      <span className="tut-p">What&rsquo;s happening on the team, and what needs you.</span>
      <span className="tut-eyebrow">Needs you</span>
      <span className="tut-meta">Sessions in the next two weeks that need someone. They leave this list once someone takes them.</span>
      <div className="tut-card">
        <span className="tut-meta">Schedule</span>
        <span className="tut-p"><b>{what}</b> {needs}</span>
        <span className="tut-btn hl">{button}</span>
      </div>
    </Page>
  );
}

/** The host's page at the Zoom door. */
export function doorScreen(
  device: Device,
  { eyebrow, program, hostLine, join, intro }: { eyebrow: string; program: string; hostLine?: string; join: string; intro: string },
) {
  return (
    <Page header={<Header device={device} />} center>
      <div className="tut-card tut-card--door">
        <span className="tut-eyebrow">{eyebrow}</span>
        <span className="tut-h1">{program}</span>
        {hostLine && <span className="tut-meta">{hostLine}</span>}
        <span className="tut-btn hl">{join}</span>
        <span className="tut-hostbox">
          You&rsquo;ll join under your own name. {intro}
          <span className="tut-code">••••••</span>
        </span>
      </div>
    </Page>
  );
}

/** Zoom opening for the first time: it asks for a name. Zoom's screen, not RIM's. */
export function zoomNameScreen(device: Device) {
  return (
    <div className={cx("tut-screen tut-zoom", device === "computer" && "tut-zoom--wide")}>
      <div className="tut-scrim tut-scrim--zoom">
        <div className="tut-zoom__dialog">
          <b>Enter your name</b>
          <span className="tut-zoom__field tut-zoom__field--name">Pat L.</span>
          <span className="tut-zoom__actions"><span>Cancel</span><span className="tut-zoom__primary hl">Join</span></span>
        </div>
      </div>
    </div>
  );
}

/** Zoom with its toolbar (Participants marked), or with the list open and Claim Host. */
export function zoomScreen(device: Device, stage: "toolbar" | "claim") {
  const people = ["Pat L.", "Sam R.", "Alex M.", "Jordan K."];
  if (device === "phone") {
    return (
      <div className="tut-screen tut-zoom">
        <div className="tut-zoom__stage">{people.map((p) => <span key={p} className="tut-zoom__tile">{p}</span>)}</div>
        {stage === "claim" && (
          <div className="tut-zoom__panel tut-zoom__panel--sheet">
            <span className="tut-zoom__panel-head"><b>Participants (4)</b><span className="tut-zoom__more">•••</span></span>
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
