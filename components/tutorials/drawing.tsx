/**
 * The pieces tutorial drawings are made of (CSS prefix tut-). A drawing is
 * RIM's screen redrawn at the app's own sizes with the app's tokens, then
 * scaled to fit its frame (components/TutorialSteps.tsx), so what a person
 * reads in the picture is what they will see. Not the real components: those
 * need a signed-in person's data, and a picture must never show anyone's.
 * `hl` marks the one place to tap.
 */

import type { ReactNode } from "react";

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

const LOGO = "/images/Rooted-In-Mindfulness-Logo.png";

export function Brand() {
  return (
    <span className="tut-brand">
      <img src={LOGO} alt="" />
      Rooted In Mindfulness
    </span>
  );
}

/** The site header. On a phone: the logo and Menu. On a computer: the bar. */
export function Header({
  device,
  signedIn = true,
  hl,
  open = false,
}: {
  device: "phone" | "computer";
  signedIn?: boolean;
  hl?: "menu" | "members";
  open?: boolean;
}) {
  if (device === "phone") {
    return (
      <div className="tut-head">
        <Brand />
        <span className={cx("tut-menu", hl === "menu" && "hl")}>
          {open ? "× Close" : (<><i aria-hidden="true" />Menu</>)}
        </span>
      </div>
    );
  }
  return (
    <div className="tut-head tut-head--wide">
      <Brand />
      <span className="tut-bar">
        <span>New to RIM</span>
        <span>Practice ▾</span>
        <span>Programs ▾</span>
        <span>About ▾</span>
        <span>Get Involved ▾</span>
        <span className={cx(hl === "members" && "hl")}>{signedIn ? "My Home" : "Members ▾"}</span>
        <span className="tut-donate">Donate</span>
      </span>
    </div>
  );
}

/** The personal rail beside a member's own pages, on a computer. */
export function PersonalRail({ active, hl }: { active?: string; hl?: string }) {
  const top = ["My Home", "Notifications", "Library", "My Teams"];
  const care = ["♥  Community Care", "My Profile"];
  const link = (label: string) => (
    <span key={label} className={cx("tut-rail__link", active === label && "tut-rail__link--on", hl === label && "hl")}>
      {label}
    </span>
  );
  return (
    <div className="tut-rail">
      <span className="tut-rail__label">My RIM</span>
      {top.map(link)}
      <span className="tut-rail__rule" />
      {care.map(link)}
      <span className="tut-rail__rule" />
      {link("Sign out")}
    </div>
  );
}

/** A team's rail, on a computer. */
export function TeamRail({ team, active, hl }: { team: string; active: string; hl?: string }) {
  const links = ["Home", "Scheduler", "Updates", "Conversations", "Files", "Members"];
  return (
    <div className="tut-rail">
      <span className="tut-rail__label">Team</span>
      <span className="tut-rail__team">{team}</span>
      {links.map((label) => (
        <span key={label} className={cx("tut-rail__link", active === label && "tut-rail__link--on", hl === label && "hl")}>{label}</span>
      ))}
      <span className="tut-rail__rule" />
      <span className="tut-rail__link">My Teams</span>
      <span className="tut-rail__link">My Profile</span>
    </div>
  );
}

/** A page: the header, an optional rail, and the page's own content. */
export function Page({
  header,
  rail,
  children,
  center = false,
}: {
  header: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div className="tut-screen">
      {header}
      <div className={cx("tut-frame", rail ? "tut-frame--rail" : null)}>
        {rail}
        <div className={cx("tut-main", center && "tut-main--center")}>{children}</div>
      </div>
    </div>
  );
}

/** A Scheduler row: the date block, the program, its state and action. */
export function ScheduleRow({
  day,
  date,
  time = "6:30 AM",
  program = "Good Morning Silent Meditation",
  tag,
  state,
  action,
  quiet,
  hl,
  device,
}: {
  day: string;
  date: string;
  time?: string;
  program?: string;
  tag: string;
  state: ReactNode;
  action?: string;
  quiet?: boolean;
  hl?: boolean;
  device: "phone" | "computer";
}) {
  return (
    <div className={cx("tut-row", device === "computer" && "tut-row--wide")}>
      <span className="tut-date">
        <b>{day}</b>
        <strong>{date}</strong>
        <small>{time}</small>
      </span>
      <span className="tut-row__what">
        <span className="tut-row__title">{program}</span>
        <span className="tut-meta">{tag}</span>
      </span>
      <span className="tut-row__state">
        {state}
        {action && <span className={cx("tut-btn", quiet && "tut-btn--quiet", hl && "hl")}>{action}</span>}
      </span>
    </div>
  );
}

/** An open sign-up team's state (greeters): who is signed up, "you" marked. */
export function SignUpState({ header, names, mine }: { header: string; names: string[]; mine?: string }) {
  return (
    <span className="tut-signups">
      <span className="tut-state">{header}</span>
      {names.map((n) => (
        <span key={n} className={cx("tut-signups__name", n === mine && "tut-signups__name--mine")}>
          {n}{n === mine && <span className="tut-signups__you">you</span>}
        </span>
      ))}
    </span>
  );
}

/** A dialog over a dimmed page. */
export function Dialog({ children }: { children: ReactNode }) {
  return (
    <div className="tut-scrim">
      <div className="tut-dialog">{children}</div>
    </div>
  );
}
