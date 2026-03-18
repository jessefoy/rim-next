/**
 * /manual — Public volunteer manual (no auth required)
 * Identical content to /admin/manual but accessible without login.
 * Intended for sharing with collaborators and AI tools for context.
 */

import Link from "next/link";

export const metadata = { title: "Volunteer Manual — Rooted In Mindfulness" };

export default function PublicManualPage() {
  return (
    <div className="man-layout">

      {/* ── Sidebar ── */}
      <nav className="man-sidebar">
        <p className="man-sidebar__heading">Volunteer Manual</p>
        <p className="man-sidebar__public-note">Public reference copy</p>
        <ul className="man-sidebar__list">

          <li>
            <a href="#introduction" className="man-sidebar__link">Introduction</a>
          </li>

          <li>
            <a href="#registration" className="man-sidebar__link">
              Registration
            </a>
            <ul className="man-sidebar__sub">
              <li><a href="#reg-overview"    className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#reg-member-exp"  className="man-sidebar__sublink">Member experience</a></li>
              <li><a href="#reg-your-tools" className="man-sidebar__sublink">Your tools</a></li>
              <li><a href="#reg-statuses"   className="man-sidebar__sublink">Status guide</a></li>
              <li><a href="#reg-dana"         className="man-sidebar__sublink">Dana</a></li>
              <li><a href="#reg-course-access" className="man-sidebar__sublink">Course access</a></li>
              <li><a href="#reg-emails"       className="man-sidebar__sublink">Automatic emails</a></li>
              <li><a href="#reg-calendar"   className="man-sidebar__sublink">Calendar links</a></li>
              <li><a href="#reg-tasks"      className="man-sidebar__sublink">Common tasks</a></li>
              <li><a href="#reg-edge-cases" className="man-sidebar__sublink">Edge cases</a></li>
            </ul>
          </li>

          <li>
            <a href="#programs" className="man-sidebar__link">
              Programs
            </a>
            <ul className="man-sidebar__sub">
              <li><a href="#prog-overview"  className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#prog-role"      className="man-sidebar__sublink">Who does this</a></li>
              <li><a href="#prog-anatomy"   className="man-sidebar__sublink">How a program comes together</a></li>
              <li><a href="#prog-creating"  className="man-sidebar__sublink">Creating a program</a></li>
              <li><a href="#prog-content"   className="man-sidebar__sublink">1 — Basics</a></li>
              <li><a href="#prog-schedule"  className="man-sidebar__sublink">2 — When &amp; Where</a></li>
              <li><a href="#prog-reg-tab"   className="man-sidebar__sublink">3 — Registration</a></li>
              <li><a href="#prog-emails"    className="man-sidebar__sublink">4 — Emails</a></li>
              <li><a href="#prog-dana-tab"  className="man-sidebar__sublink">5 — Dana</a></li>
              <li><a href="#prog-dashboard" className="man-sidebar__sublink">6 — Settings</a></li>
              <li><a href="#prog-tasks"     className="man-sidebar__sublink">Common tasks</a></li>
              <li className="man-sidebar__sub-divider" />
              <li><a href="#google-meet"        className="man-sidebar__sublink">Setting up Google Meet</a></li>
              <li><a href="#meet-how-it-works"  className="man-sidebar__sublink">How it works</a></li>
              <li><a href="#meet-before"        className="man-sidebar__sublink">Before you start</a></li>
              <li><a href="#meet-create"        className="man-sidebar__sublink">Creating a meeting</a></li>
              <li><a href="#meet-volunteer"     className="man-sidebar__sublink">What the host team does</a></li>
              <li><a href="#meet-link-appears"  className="man-sidebar__sublink">Where the link appears</a></li>
              <li><a href="#meet-issues"        className="man-sidebar__sublink">If something goes wrong</a></li>
            </ul>
          </li>

          <li>
            <a href="#members" className="man-sidebar__link">Member Accounts</a>
            <ul className="man-sidebar__sub">
              <li><a href="#mem-overview"   className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#mem-list"       className="man-sidebar__sublink">The member list</a></li>
              <li><a href="#mem-profile"    className="man-sidebar__sublink">The member profile</a></li>
              <li><a href="#mem-status"     className="man-sidebar__sublink">Member status</a></li>
              <li><a href="#mem-tags"       className="man-sidebar__sublink">Tags</a></li>
              <li><a href="#mem-notes"      className="man-sidebar__sublink">Admin notes</a></li>
              <li><a href="#mem-households" className="man-sidebar__sublink">Households</a></li>
              <li><a href="#mem-tasks"      className="man-sidebar__sublink">Common tasks</a></li>
            </ul>
          </li>
          <li>
            <a href="#courses" className="man-sidebar__link">Courses &amp; Lessons</a>
            <ul className="man-sidebar__sub">
              <li><a href="#courses-overview"   className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#courses-access"     className="man-sidebar__sublink">Access levels</a></li>
              <li><a href="#courses-course-hub" className="man-sidebar__sublink">Course Hub</a></li>
              <li><a href="#courses-linking"    className="man-sidebar__sublink">Linking courses to programs</a></li>
            </ul>
          </li>

          <li>
            <a href="#hub" className="man-sidebar__link">Host Community Hub</a>
            <ul className="man-sidebar__sub">
              <li><a href="#hub-overview"        className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#hub-schedule"        className="man-sidebar__sublink">Schedule tab</a></li>
              <li><a href="#hub-subs"            className="man-sidebar__sublink">Sub Board</a></li>
              <li><a href="#hub-conversations"   className="man-sidebar__sublink">Conversations</a></li>
              <li><a href="#hub-alerts"          className="man-sidebar__sublink">Alerts</a></li>
              <li><a href="#hub-session"         className="man-sidebar__sublink">Session tab</a></li>
            </ul>
          </li>

          <li>
            <a href="#support" className="man-sidebar__link">Support Inbox</a>
            <ul className="man-sidebar__sub">
              <li><a href="#support-overview"    className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#support-inbox"        className="man-sidebar__sublink">Using the inbox</a></li>
              <li><a href="#support-replying"      className="man-sidebar__sublink">Replying &amp; composing</a></li>
              <li><a href="#support-notes"         className="man-sidebar__sublink">Internal notes</a></li>
              <li><a href="#support-templates"     className="man-sidebar__sublink">Templates</a></li>
              <li><a href="#support-settings"      className="man-sidebar__sublink">Settings</a></li>
            </ul>
          </li>

          <li>
            <a href="#roles" className="man-sidebar__link">Volunteer Roles</a>
            <ul className="man-sidebar__sub">
              <li><a href="#roles-overview"   className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#roles-two-roles"  className="man-sidebar__sublink">Volunteer roles</a></li>
              <li><a href="#roles-assigning"  className="man-sidebar__sublink">Assigning a role</a></li>
              <li><a href="#roles-notifying"  className="man-sidebar__sublink">Notification email</a></li>
              <li><a href="#roles-removing"   className="man-sidebar__sublink">Removing a role</a></li>
              <li><a href="#roles-bootstrap"  className="man-sidebar__sublink">First Admin setup</a></li>
            </ul>
          </li>
        </ul>
      </nav>

      {/* ── Redirect to actual manual for reference ── */}
      {/* The full content of this page mirrors /admin/manual exactly.
          It is rendered here without auth so it can be shared externally. */}

      <main className="man-content">
        <div className="man-public-banner">
          This is a public reference copy of the RIM Volunteer Manual.{" "}
          <Link href="/login">Sign in</Link> to access the full member area.
        </div>

        {/* ════════ INTRODUCTION ════════ */}
        <div id="introduction" className="man-chapter">
          <h1 className="man-chapter__title">Welcome</h1>
          <p className="man-chapter__subtitle">
            This manual is for everyone who volunteers with Rooted In Mindfulness. Whatever your role, whatever brought you here — this is your reference. You don&rsquo;t need a technical background, and you don&rsquo;t need to read it all at once.
          </p>
        </div>
        <section className="man-section">
          <h2 className="man-section__title">About this manual</h2>
          <p>The RIM website is the digital heart of our community — the place where programs are shared, where people register and connect, where members access teachings and materials, and where much of the behind-the-scenes work of holding space happens. This manual documents how all of that works.</p>
          <p>It&rsquo;s written in plain language, for people doing real work in the community. Each chapter explains what a feature does, why it exists, and how to use it — so that anyone in a volunteer role can understand not just the steps, but the intention behind them.</p>
          <p>As RIM grows, so will the ways people contribute. This manual is a shared reference for all of them, and it will grow alongside the community. Every volunteer has access to the whole thing — understanding how the whole system works makes for better collaboration and a more connected community.</p>
        </section>

        <section className="man-section">
          <h2 className="man-section__title">A note on technology</h2>
          <p>This system is built to be as simple as possible for the people using it. If something feels confusing, that&rsquo;s not a reflection on you. It may mean the system can be clearer, or that this manual needs a better explanation. You&rsquo;re not expected to figure things out alone — the manual is here for exactly those moments.</p>
        </section>

        {/* ════════ NOTE ════════ */}
        <div className="man-note" style={{margin: "32px 0"}}>
          <strong>Full content available.</strong> This public page contains the complete manual. The authenticated version at <code>/admin/manual</code> is identical — it just requires a volunteer login. Use this URL to share the manual or reference it from external tools.
        </div>

        {/* The full chapter content is identical to /admin/manual/page.tsx.
            For maintainability both files share the same JSX below this point.
            When updating content, update BOTH files. */}

        {/* ════════ CHAPTER 1 — REGISTRATION ════════ */}
        <div id="registration" className="man-chapter">
          <h1 className="man-chapter__title">Registration</h1>
          <p className="man-chapter__subtitle">This chapter walks you through the registration system — what the experience looks like from a member&rsquo;s perspective, what the tools look like from the volunteer side, and how to handle every situation that comes up.</p>
        </div>

        <section id="reg-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>Registration is the process by which someone claims a spot in a program. When a program has registration enabled, a <strong>Register →</strong> button appears on the program&rsquo;s page. Members and guests fill out a short form — name, email, any custom questions the program requires — and their spot is confirmed instantly.</p>
          <p>The registration system is built into this website. There is no third-party form tool to manage. Everything lives in one place: the registrar area at <strong>/account/hub/registrar/programs</strong>.</p>
          <p>Registration is optional. Programs that don&rsquo;t need it — like open drop-in sittings — simply leave registration turned off.</p>
        </section>

        <section id="reg-member-exp" className="man-section">
          <h2 className="man-section__title">Member experience</h2>
          <p>Here is what a member or visitor sees when they register.</p>
          <h3 className="man-section__h3">The registration form</h3>
          <ol className="man-steps">
            <li>They visit the program page and click <strong>Register →</strong>, or go directly to <code>/programs/[slug]/register</code>.</li>
            <li>They fill in their name, email, and optionally phone. If they have an account and are signed in, name and email are pre-filled and locked.</li>
            <li>If the program has custom questions, those appear next.</li>
            <li>If this is their first time registering and they are not signed in, a <strong>Community Agreements</strong> section appears. They must check a box before submitting.</li>
            <li>They click <strong>Register</strong> (or <strong>Join Waitlist</strong> if full).</li>
            <li>A confirmation email arrives within a few seconds.</li>
            <li>If the program has a dana or fee step, it appears immediately after.</li>
          </ol>
          <h3 className="man-section__h3">Self-cancellation</h3>
          <p>Members can cancel their own spot directly from <strong>My Programs</strong> — they don&rsquo;t need to contact you.</p>
        </section>

        <section id="reg-statuses" className="man-section">
          <h2 className="man-section__title">Status guide</h2>
          <div className="man-status-grid">
            <div className="man-status-card"><span className="man-status-badge man-status-badge--registered">Registered</span><p>Confirmed spot. Set automatically when they submit and capacity is available.</p></div>
            <div className="man-status-card"><span className="man-status-badge man-status-badge--approved">Approved</span><p>Like Registered, but set manually. Use for programs with an application process.</p></div>
            <div className="man-status-card"><span className="man-status-badge man-status-badge--waitlisted">Waitlisted</span><p>Program was full. Promote manually when a spot opens.</p></div>
            <div className="man-status-card"><span className="man-status-badge man-status-badge--cancelled">Cancelled</span><p>Cancelled by the member or a registrar. Reversible via Restore.</p></div>
          </div>
        </section>

        <section id="reg-dana" className="man-section">
          <h2 className="man-section__title">Dana</h2>
          <p>Dana is the traditional practice of giving. For programs that use dana, the registration form includes a payment step via Stripe.</p>
          <div className="man-note"><strong>Note:</strong> Dana is never a gate on participation. A person with Pending dana is fully registered and should be welcomed.</div>
        </section>

        <section id="reg-course-access" className="man-section">
          <h2 className="man-section__title">Course access</h2>
          <p>When a program is linked to a course via the Course Hub, anyone who registers automatically receives access. For historical members or exceptions, you can grant or revoke course access manually from the member detail page (<strong>/admin/members/[id]</strong>).</p>
        </section>

        <section id="reg-emails" className="man-section">
          <h2 className="man-section__title">Automatic emails</h2>
          <p>These emails go out automatically: registration confirmation, waitlist promotion approval, cancellation notification (to registrar), scheduled reminder (at 9am Central on the reminder date), self-service edit link, edit submission notification, and dana reminder.</p>
          <div className="man-note">Some email copy is editable without a code deploy at <strong>/admin/emails</strong>.</div>
        </section>

        {/* ════════ CHAPTER 2 — PROGRAMS ════════ */}
        <div id="programs" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Programs</h1>
          <p className="man-chapter__subtitle">How to create and manage programs — every field explained, plus creating the Google Meet link once a virtual program is ready.</p>
        </div>

        <section id="prog-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>Programs are managed through the <strong>Program Editor</strong> in the Registrar Hub. When you save a program, changes appear on the website within seconds. There is no separate &ldquo;publish&rdquo; step.</p>
        </section>

        <section id="prog-anatomy" className="man-section">
          <h2 className="man-section__title">How a program comes together</h2>
          <table className="man-table">
            <thead><tr><th>Tab</th><th>What it controls</th></tr></thead>
            <tbody>
              <tr><td>1 — Basics</td><td>Name, URL slug, category, description, image, pull quote, teachers, special notes.</td></tr>
              <tr><td>2 — When &amp; Where</td><td>Dates, times, location, recurrence, Google Meet.</td></tr>
              <tr><td>3 — Registration</td><td>Registration form, capacity, deadline, custom questions, linked courses.</td></tr>
              <tr><td>4 — Emails</td><td>Confirmation message and automated reminder.</td></tr>
              <tr><td>5 — Dana</td><td>Dana mode and amounts.</td></tr>
              <tr><td>6 — Settings</td><td>Dashboard display, announcements, sort order.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ════════ GOOGLE MEET ════════ */}
        <section id="google-meet" className="man-section man-section--divider">
          <h2 className="man-section__title">Setting up a Google Meet</h2>
          <p>Google Meet is the video platform RIM uses for all virtual programs. For most virtual programs, the Meet link is created manually from the registrar area. Once set, it&rsquo;s stable for the life of the program.</p>
          <p>RIM has four shared room accounts (meet1–meet4@rootedinmindfulness.org). When you create a meeting, the system assigns a free room automatically. The host team checks the Host Area to find out which account to sign into — whoever joins from that account has full host controls.</p>
        </section>

        <section id="meet-create" className="man-section">
          <h2 className="man-section__title">Creating a meeting</h2>
          <ol className="man-steps">
            <li>In the Program Editor, set <strong>Format</strong> to Virtual or Hybrid and set a <strong>Start Date &amp; Time</strong>.</li>
            <li>Save the program.</li>
            <li>Go to the program in the Registrar Hub and click <strong>Create Google Meet</strong>.</li>
            <li>The link and room account are saved automatically.</li>
          </ol>
        </section>

        <section id="meet-link-appears" className="man-section">
          <h2 className="man-section__title">Where the link appears</h2>
          <table className="man-table man-table--perms">
            <thead><tr><th>Where</th><th>Who sees it</th></tr></thead>
            <tbody>
              <tr><td>Member dashboard <code>/account/dashboard</code></td><td>Logged-in members only — on the day of the program, about 12 minutes before start.</td></tr>
              <tr><td>Host Area <code>/account/hub/host-team</code></td><td>Host team members and Admins — always visible once created.</td></tr>
            </tbody>
          </table>
          <p>Confirmation and reminder emails direct members to their dashboard — the link itself is not included in emails.</p>
        </section>

        {/* ════════ CHAPTER 3 — MEMBER ACCOUNTS ════════ */}
        <div id="members" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Member Accounts</h1>
          <p className="man-chapter__subtitle">How to find someone, what information you can see and edit, and how to keep things organized over time.</p>
        </div>

        <section id="mem-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>Every person who has registered for a program, agreed to the community guidelines, or been added by a staff member has a member account. The member directory at <strong>/admin/members</strong> is where you can see all of them in one place, search by name or email, and open individual profiles to view or edit their information.</p>
          <p>You need the <strong>Registrar</strong> or <strong>Admin</strong> role to access this area.</p>
        </section>

        <section id="mem-status" className="man-section">
          <h2 className="man-section__title">Member status</h2>
          <table className="man-table">
            <thead><tr><th>Status</th><th>What it means</th><th>Can log in?</th></tr></thead>
            <tbody>
              <tr><td><strong>Active</strong></td><td>A regular community member</td><td>✓ Yes</td></tr>
              <tr><td><strong>Visitor</strong></td><td>Attending and exploring, not yet a full member</td><td>✓ Yes</td></tr>
              <tr><td><strong>Student</strong></td><td>Engaged in a learning track or training</td><td>✓ Yes</td></tr>
              <tr><td><strong>Volunteer</strong></td><td>Contributing in an ongoing volunteer capacity</td><td>✓ Yes</td></tr>
              <tr><td><strong>Inactive</strong></td><td>Account preserved but access suspended</td><td>✗ No</td></tr>
            </tbody>
          </table>
          <p>Inactive is the only status that blocks login. Setting it is reversible.</p>
        </section>

        <section id="mem-households" className="man-section">
          <h2 className="man-section__title">Households</h2>
          <p>The Households feature lets you group family members together — partners, parents and children, or others who live together. Grouping people into a household doesn&rsquo;t change access or registration. It&rsquo;s purely organizational.</p>
          <p>Manage households at <strong>/admin/households</strong>. Each person can only belong to one household at a time.</p>
        </section>

        {/* ════════ CHAPTER 3B — COURSES & LESSONS ════════ */}
        <div id="courses" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Series &amp; Lessons</h1>
          <p className="man-chapter__subtitle">How teaching materials are organized and delivered to community members.</p>
        </div>

        <section id="courses-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>A <strong>series</strong> is a container that groups related lessons together. A <strong>lesson</strong> is a single piece of content — text, audio recording, video, or downloadable resources.</p>
          <p>Members access series at <code>/course/[slug]</code> and individual lessons at <code>/lessons/[slug]</code>.</p>
        </section>

        <section id="courses-access" className="man-section">
          <h2 className="man-section__title">Access levels</h2>
          <table className="man-table">
            <thead><tr><th>Level</th><th>Who can view</th></tr></thead>
            <tbody>
              <tr><td><strong>All Members</strong></td><td>Any logged-in community member</td></tr>
              <tr><td><strong>Registration Required</strong></td><td>Members with an active registration for a linked program, or those manually granted access</td></tr>
              <tr><td><strong>Role Required</strong></td><td>Members with a specific volunteer role</td></tr>
            </tbody>
          </table>
        </section>

        <section id="courses-course-hub" className="man-section">
          <h2 className="man-section__title">Course Hub</h2>
          <p>Series and lessons are managed in the <strong>Course Hub</strong> at <code>/account/hub/courses</code>. Available to anyone with the TEACHER or ADMIN role (plus anyone granted direct hub access).</p>
          <p>The Course Hub has two main sections: <strong>Series</strong> (create and edit series, manage lesson order, organize into sections) and <strong>Lessons</strong> (create and edit individual lessons with rich text editor, audio/image uploads, video links, and teacher assignments).</p>
          <p>The lesson editor includes special content blocks: <strong>Verse Quote</strong>, <strong>Practice Suggestion</strong>, and <strong>Callout</strong>. Audio files up to 500 MB are supported. File uploads save automatically.</p>
        </section>

        <section id="courses-linking" className="man-section">
          <h2 className="man-section__title">Linking series to programs</h2>
          <p>To make a series available to registrants of a specific program, link them in the series editor. You can also grant individual members access from the Course Access section on their member profile at <strong>/admin/members/[id]</strong>.</p>
        </section>

        {/* ════════ CHAPTER 4 — HOST COMMUNITY HUB ════════ */}
        <div id="hub" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Host Community Hub</h1>
          <p className="man-chapter__subtitle">The Host Community Hub is your team&rsquo;s home base at <strong>/account/hub/host-team</strong>.</p>
        </div>

        <section id="hub-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>The hub has six tabs: <strong>Announcements</strong>, <strong>Schedule</strong>, <strong>Session</strong>, <strong>Documents</strong>, <strong>Conversations</strong>, and <strong>Members</strong>. Sub coverage lives inside the Schedule tab.</p>
          <table className="man-table man-table--perms">
            <thead><tr><th>Action</th><th>Meet Host</th><th>Host Manager</th><th>Admin</th></tr></thead>
            <tbody>
              <tr><td>See the full schedule</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Manage assignments</td><td></td><td>✓</td><td>✓</td></tr>
              <tr><td>Request and claim subs</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Read and post in Conversations</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Close or archive a conversation</td><td></td><td>✓</td><td>✓</td></tr>
            </tbody>
          </table>
        </section>

        <section id="hub-session" className="man-section">
          <h2 className="man-section__title">Session Tab</h2>
          <p>The Session tab at <strong>/account/hub/host-team/session</strong> is a live view of today&rsquo;s virtual programs. It updates every 60 seconds. Each program card shows its lifecycle state: Later Today, Getting Ready, Live, Post-session, or Done.</p>
          <p>During a live session, tap any attendee row to flag them for follow-up. Flagged people appear in the post-session form. The post-session form has three sections: people you noted (with routing options), session reflection, and something to share.</p>
        </section>

        {/* ════════ SUPPORT INBOX ════════ */}
        <div id="support" className="man-chapter">
          <h1 className="man-chapter__title">Support Inbox</h1>
          <p className="man-chapter__subtitle">A shared email client for <code>support@rootedinmindfulness.org</code>, built into the hub system.</p>
        </div>

        <section id="support-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>The Support Inbox lives at <strong>Your Hubs → Support → Inbox</strong>. It syncs with Gmail automatically every 5 minutes. Two roles can access it: <strong>SUPPORT</strong> (read, reply, notes, assign) and <strong>ADMIN</strong> (everything plus Gmail connection, templates, member matching).</p>
          <p>Thread statuses: <strong>Open</strong>, <strong>Claimed</strong>, <strong>Waiting</strong>, <strong>Resolved</strong>.</p>
        </section>

        <section id="support-replying" className="man-section">
          <h2 className="man-section__title">Replying &amp; composing</h2>
          <p>Click the reply prompt at the bottom of the timeline to reply. Your signature is automatically appended. Click <strong>New Email</strong> above the search field to compose a new outbound message. Both include a <strong>Use Template</strong> button.</p>
        </section>

        <section id="support-notes" className="man-section">
          <h2 className="man-section__title">Internal notes</h2>
          <p>Internal notes are private messages visible only to the support team — never sent to the sender. Click <strong>Add Note</strong> in the sidebar to open the note composer. Notes appear in the timeline with an amber border.</p>
        </section>

        {/* ════════ CHAPTER 5 — VOLUNTEER ROLES ════════ */}
        <div id="roles" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Volunteer Roles</h1>
          <p className="man-chapter__subtitle">What each role unlocks, how to grant and remove access, and how to get a new volunteer set up.</p>
        </div>

        <section id="roles-two-roles" className="man-section">
          <h2 className="man-section__title">Volunteer roles</h2>
          <h3 className="man-section__h3">Meet Host</h3>
          <p>Access to the Host Community Hub, their own schedule, sub board, and conversations. No access to registration or member data.</p>
          <h3 className="man-section__h3">Meet Host Manager</h3>
          <p>Everything Meet Host can do, plus: manage all assignments, close/archive conversations, receive unassigned-session alerts.</p>
          <h3 className="man-section__h3">Teacher</h3>
          <p>Access to the Course Hub — create and edit series and lessons, upload media, set access levels, link courses to programs.</p>
          <h3 className="man-section__h3">Registrar</h3>
          <p>Access to all program registrations, the member list (view and edit), and the Program Editor. Does not include Admin-only member actions.</p>
          <h3 className="man-section__h3">Support</h3>
          <p>Access to the Support Inbox — read threads, reply, add notes, assign threads, manage own signature and notification preferences.</p>
          <h3 className="man-section__h3">Admin</h3>
          <p>Full access to everything — all hubs, member management (including role assignment and deletion), email templates, and system configuration.</p>
        </section>

        <section id="roles-assigning" className="man-section">
          <h2 className="man-section__title">Assigning a role</h2>
          <ol className="man-steps">
            <li>Go to <strong>/admin/members</strong> and open the member&rsquo;s profile.</li>
            <li>Scroll to the <strong>Roles</strong> section.</li>
            <li>Check the box for the role you want to assign.</li>
            <li>Click <strong>Save changes</strong>.</li>
          </ol>
          <p>Roles take effect immediately — no re-login required.</p>
        </section>

        <section id="roles-bootstrap" className="man-section">
          <h2 className="man-section__title">First Admin setup</h2>
          <p>The Admin role cannot be assigned through the UI unless someone already has Admin. For the very first Admin, update the database directly via the Neon console:</p>
          <pre className="man-code">{`UPDATE "User" SET roles = '{ADMIN}' WHERE email = 'person@example.com';`}</pre>
        </section>

      </main>
    </div>
  );
}
