/**
 * Drawings for Start here: the first sign-in, the sign-in email, the team's
 * Updates, Conversations, Files and Members, Notifications and the email
 * choice. The words are the app's own, checked against the components on
 * 2026-10-21 (WelcomeForm, HubActivityClient, HubConvClient,
 * HubConvThreadClient, FilesBrowser, FileDetailActions, FileConversation,
 * HubMembersClient, NotificationsClient, EmailChoiceForm, lib/email.ts).
 */

import type { ReactNode } from "react";
import { Header, Page, PersonalRail, TeamRail, cx } from "./drawing";
import type { Device } from "./screens";

/** An email as it arrives: who it's from, the subject, the words, one button. */
export function emailScreen(device: Device, { subject, heading, lines, button, big }: { subject: string; heading?: string; lines: string[]; button: string; big?: string }) {
  return (
    <div className="tut-screen tut-mail">
      <div className="tut-mail__head">
        <span className="tut-mail__from"><b>Rooted In Mindfulness</b> <span>hello@rootedinmindfulness.org</span></span>
        <span className="tut-mail__subject">{subject}</span>
      </div>
      <div className={cx("tut-mail__body", device === "computer" && "tut-mail__body--wide")}>
        <div className="tut-mail__panel">
          <span className="tut-mail__brand"><img src="/images/Rooted-In-Mindfulness-Logo.png" alt="" />Rooted In Mindfulness</span>
          {heading && <span className="tut-h2">{heading}</span>}
          {lines.map((l) => <span key={l} className="tut-p">{l}</span>)}
          {big && <span className="tut-mail__code">{big}</span>}
          <span className="tut-btn hl">{button}</span>
        </div>
      </div>
    </div>
  );
}

/** The first sign-in's Welcome page, at its agreements and button. */
export function welcomeScreen(device: Device) {
  return (
    <Page header={<Header device={device} signedIn={false} />} center={device === "computer"}>
      <span className="tut-eyebrow">Rooted In Mindfulness</span>
      <span className="tut-h1">Welcome back</span>
      <span className="tut-p">We&rsquo;ve rebuilt Rooted In Mindfulness as a new website and home, and your membership came with you.</span>
      <span className="tut-label">First name *</span>
      <span className="tut-input">Pat</span>
      <span className="tut-label">Community Care Agreements</span>
      <span className="tut-agree">
        <span>1. Care for Yourself</span>
        <span>2. Care for Others</span>
        <span>3. Care for RIM</span>
      </span>
      <span className="tut-check"><span className="tut-check__box">✓</span>I will hold these Community Care Agreements, in a spirit of care and respect.</span>
      <span className="tut-btn hl">Step back in →</span>
    </Page>
  );
}

/** My Home on the first arrival, with its notice. */
export function arrivedScreen(device: Device) {
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail active="My Home" /> : undefined}>
      <span className="tut-meta">Tuesday, October 27</span>
      <span className="tut-h1">Good morning, Pat.</span>
      <div className="tut-card tut-card--done hl">
        <span className="tut-h2">Welcome back. You&rsquo;re all set.</span>
        <span className="tut-p">This is My Home: your gatherings for today are here.</span>
      </div>
      <span className="tut-eyebrow">Today</span>
      <span className="tut-meta">There are no more sessions today.</span>
      <span className="tut-btn tut-btn--ghost">This week&rsquo;s schedule →</span>
    </Page>
  );
}

/** A row of filter pills, as on Updates, Notifications, Conversations and Files. */
function Pills({ items, on = 0, hl }: { items: string[]; on?: number; hl?: number }) {
  return (
    <span className="tut-pills">
      {items.map((p, i) => <span key={p} className={cx(i === on && "on", i === hl && "hl")}>{p}</span>)}
    </span>
  );
}

const TEAM = "Hosting Team";

/** A team's Updates: Needs you above, then the history. */
export function updatesScreen(device: Device, hl: "row" | "take") {
  return (
    <Page header={<Header device={device} />} rail={<TeamRail device={device} team={TEAM} active="Updates" />}>
      <span className="tut-h1">Updates</span>
      <span className="tut-p">What&rsquo;s happening on the team, and what needs you.</span>
      <Pills items={["All", "For you 1", "Unread 3", "View: Everything ▾"]} />
      <span className="tut-eyebrow">Needs you</span>
      <div className="tut-card">
        <span className="tut-meta">Schedule</span>
        <span className="tut-p"><b>The Art of Meditation · Tue, Oct 27 at 9:30 AM</b> needs a host</span>
        <span className={cx("tut-btn", hl === "take" && "hl")}>Take this session</span>
      </div>
      <span className="tut-eyebrow">Today</span>
      <div className="tut-list">
        <span className={cx("tut-feed", hl === "row" && "hl")}><i className="tut-dot" /><span><small>Conversation</small><b>Sam R.</b> replied in <b>Hosting tips</b></span><small>9:30 AM</small></span>
        <span className="tut-feed"><i className="tut-dot" /><span><small>File</small><b>Alex M.</b> uploaded <b>Host checklist</b></span><small>8:15 AM</small></span>
      </div>
    </Page>
  );
}

/** The team's Conversations list, or one conversation with its reply box. */
export function conversationsScreen(device: Device, stage: "list" | "reply" | "new") {
  const rail = <TeamRail device={device} team={TEAM} active="Conversations" />;
  if (stage === "reply") {
    return (
      <Page header={<Header device={device} />} rail={rail}>
        <span className="tut-link">← Conversations</span>
        <span className="tut-h1">Hosting tips</span>
        <span className="tut-meta">2 replies · <span className="tut-follow">Follow</span></span>
        <div className="tut-card"><span className="tut-meta">Sam R. · 2d ago</span><span className="tut-p">What helps you settle the room before the bell?</span></div>
        <div className="tut-card"><span className="tut-meta">Alex M. · 3h ago</span><span className="tut-p">I welcome people by name as they come in.</span></div>
        <span className="tut-area">Write a reply…</span>
        <span className="tut-btn hl">Post reply</span>
      </Page>
    );
  }
  if (stage === "new") {
    return (
      <Page header={<Header device={device} />} rail={rail}>
        <span className="tut-h1">Conversations</span>
        <div className="tut-card">
          <span className="tut-eyebrow">New topic</span>
          <span className="tut-input">What would you like to discuss?</span>
          <span className="tut-area">Share your thoughts…</span>
          <span className="tut-meta">Coordinators of this team are automatically notified. You can add anyone else who should see this:</span>
          <span className="tut-label">Notify team members</span>
          <span className="tut-actions"><span className="tut-btn hl">Post topic</span><span className="tut-link">Cancel</span></span>
        </div>
      </Page>
    );
  }
  return (
    <Page header={<Header device={device} />} rail={rail}>
      <span className="tut-week"><span className="tut-h1">Conversations</span><span className="tut-btn">+ New topic</span></span>
      <Pills items={["Active 4", "Archived 2"]} />
      <div className="tut-list">
        <span className="tut-list__row hl"><span><b>Hosting tips</b><small>Sam R. · 2 replies · 3h ago</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Saturday sound check</b><small>Alex M. · 5 replies · 2d ago</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Welcome, new hosts</b><small>Jordan K. · Started Oct 12</small></span><span>→</span></span>
      </div>
    </Page>
  );
}

/** The team's Files, or one file's page. */
export function filesScreen(device: Device, stage: "list" | "file") {
  if (stage === "file") {
    return (
      <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail /> : undefined}>
        <span className="tut-link">← Back to files</span>
        <span className="tut-h1">Host checklist</span>
        <span className="tut-meta">Google Doc · Created by Alex M. · Updated yesterday</span>
        <span className="tut-actions"><span className="tut-btn hl">Edit in Google Docs</span><span className="tut-link">Remove</span></span>
        <div className="tut-doc"><span /><span /><span /><span /></div>
        <span className="tut-h2">Conversation</span>
        <span className="tut-area">Add a comment…</span>
      </Page>
    );
  }
  return (
    <Page header={<Header device={device} />} rail={<TeamRail device={device} team={TEAM} active="Files" />}>
      <span className="tut-week"><span className="tut-h1">Files</span><span className="tut-btn">+ New</span></span>
      <span className="tut-p">{TEAM}&rsquo;s shared files. Documents open right here; editing opens in Google.</span>
      <span className="tut-input">Search file names</span>
      <div className="tut-list">
        <span className="tut-list__row"><span><b>Guides</b><small>Folder</small></span><span>→</span></span>
        <span className="tut-list__row hl"><span><b>Host checklist</b><small>Document · Updated yesterday · Alex M.</small></span><span>→</span></span>
        <span className="tut-list__row"><span><b>Bell and timer settings</b><small>PDF · Updated last week · Sam R.</small></span><span>→</span></span>
      </div>
    </Page>
  );
}

/** The team's Members, as a member sees it. */
export function membersScreen(device: Device) {
  const person = (name: string, extra?: ReactNode) => (
    <span className="tut-person"><span className="tut-person__av">{name.split(" ").map((w) => w[0]).join("")}</span><span><b>{name}</b>{extra}</span></span>
  );
  return (
    <Page header={<Header device={device} />} rail={<TeamRail device={device} team={TEAM} active="Members" />}>
      <span className="tut-h1">Members</span>
      <span className="tut-eyebrow hl">Coordinators</span>
      <div className="tut-list">
        {person("Robin T.", <span className="tut-pill">Coordinator</span>)}
        {person("Jordan K.", <span className="tut-pill">Coordinator</span>)}
      </div>
      <span className="tut-eyebrow">Members</span>
      <div className="tut-list">
        {person("Sam R.")}
        {person("Alex M.")}
        {person("Pat L.")}
      </div>
    </Page>
  );
}

/** Notifications: the list, one opened, or the From picker open. */
export function notificationsScreen(device: Device, stage: "list" | "open" | "from") {
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail active="Notifications" /> : undefined}>
      <span className="tut-h1">Notifications</span>
      <span className="tut-p">News about you, your teams, your programs and your account. Tap one to read it.</span>
      <span className="tut-pills">
        <span className="on">All</span><span>Unread 2</span>
        <span className={cx(stage === "from" && "hl")}>From: Everywhere ▾</span>
        <span>View: Everything ▾</span>
      </span>
      {stage === "from" && (
        <div className="tut-menu-list">
          <span>Everywhere</span><span>Hosting Team</span><span>Greeter</span>
        </div>
      )}
      <span className="tut-eyebrow">Today</span>
      <div className="tut-list">
        <span className={cx("tut-feed", stage === "list" && "hl")}><i className="tut-dot" /><span><small>Hosting Team · Schedule</small>Needs a host: The Art of Meditation</span><small>8:00 AM</small></span>
        {stage === "open" && (
          <span className="tut-feed__open">
            <span className="tut-meta">The Art of Meditation, Tue, Oct 27 at 9:30 AM, has no host now.</span>
            <span className="tut-btn hl">Open the schedule</span>
          </span>
        )}
        <span className="tut-feed"><i className="tut-dot" /><span><small>Hosting Team</small>Welcome to the Hosting Team</span><small>Yesterday</small></span>
      </div>
    </Page>
  );
}

/** My Profile's Notifications section: how team news is emailed. */
export function emailChoiceScreen(device: Device) {
  return (
    <Page header={<Header device={device} />} rail={device === "computer" ? <PersonalRail active="My Profile" /> : undefined}>
      <span className="tut-h1">My Profile</span>
      <span className="tut-h2">Notifications</span>
      <span className="tut-p">Every notice we send you is also in Notifications. Choose how news from your teams reaches you by email.</span>
      <span className="tut-label">Email about your teams</span>
      <span className="tut-choice tut-choice--on"><b>Email me each one</b><small>As it happens, as now.</small></span>
      <span className="tut-choice"><b>One email a day</b><small>A short summary each morning of what&rsquo;s new on your teams.</small></span>
      <span className="tut-choice"><b>Don&rsquo;t email me team news</b><small>I&rsquo;ll check Notifications here.</small></span>
      <span className="tut-meta">Emails about you, your sessions, your registrations and your account always come.</span>
      <span className="tut-btn hl">Save email choice</span>
    </Page>
  );
}

/** A team on a phone with its ☰ menu: closed (☰ marked) or open (one page marked). */
export function teamDrawerScreen(hl: string) {
  const open = hl !== "☰";
  return (
    <Page header={<Header device="phone" />} rail={<TeamRail device="phone" team={TEAM} active="Home" hl={hl} open={open} />}>
      <span className="tut-h1">{TEAM}</span>
      <span className="tut-meta">Your team&rsquo;s shared space.</span>
    </Page>
  );
}

/** A team page on a computer with the way back to My Teams marked. */
export function teamRailBackScreen() {
  return (
    <Page header={<Header device="computer" />} rail={<TeamRail team={TEAM} active="Home" hl="My Teams" />}>
      <span className="tut-h1">{TEAM}</span>
      <span className="tut-meta">Your team&rsquo;s shared space.</span>
    </Page>
  );
}
