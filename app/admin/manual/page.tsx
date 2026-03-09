import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Volunteer Manual — Rooted In Mindfulness" };

export default async function ManualPage() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN", "REGISTRAR", "HOST"].includes(r))) {
    redirect("/login");
  }

  return (
    <div className="man-layout">

      {/* ── Sidebar ── */}
      <nav className="man-sidebar">
        <p className="man-sidebar__heading">Volunteer Manual</p>
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
              Programs &amp; Sanity Studio
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
          <li className="man-sidebar__soon-group">
            <span className="man-sidebar__link man-sidebar__link--soon">Courses &amp; Materials</span>
            <span className="man-soon-badge">Coming soon</span>
          </li>

          <li>
            <a href="#roles" className="man-sidebar__link">Volunteer Roles</a>
            <ul className="man-sidebar__sub">
              <li><a href="#roles-overview"   className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#roles-two-roles"  className="man-sidebar__sublink">Volunteer roles</a></li>
              <li><a href="#roles-assigning"  className="man-sidebar__sublink">Assigning a role</a></li>
              <li><a href="#roles-notifying"  className="man-sidebar__sublink">Notification email</a></li>
              <li><a href="#roles-sanity"     className="man-sidebar__sublink">Sanity Studio access</a></li>
              <li><a href="#roles-removing"   className="man-sidebar__sublink">Removing a role</a></li>
              <li><a href="#roles-bootstrap"  className="man-sidebar__sublink">First Admin setup</a></li>
            </ul>
          </li>
        </ul>
      </nav>

      {/* ── Main content ── */}
      <main className="man-content">

        {/* ════════════════════════════════════════
            INTRODUCTION
            ════════════════════════════════════════ */}

        <div id="introduction" className="man-chapter">
          <h1 className="man-chapter__title">Welcome</h1>
          <p className="man-chapter__subtitle">
            This manual is for everyone who volunteers with Rooted In Mindfulness. Whatever your role, whatever brought you here — this is your reference. You don&rsquo;t need a technical background, and you don&rsquo;t need to read it all at once.
          </p>
        </div>

        <section className="man-section">
          <h2 className="man-section__title">About this manual</h2>
          <p>
            The RIM website is the digital heart of our community — the place where programs are shared, where people register and connect, where members access teachings and materials, and where much of the behind-the-scenes work of holding space happens. This manual documents how all of that works.
          </p>
          <p>
            It&rsquo;s written in plain language, for people doing real work in the community. Each chapter explains what a feature does, why it exists, and how to use it — so that anyone in a volunteer role can understand not just the steps, but the intention behind them.
          </p>
          <p>
            As RIM grows, so will the ways people contribute — as registrars, program coordinators, community group facilitators, and roles that haven&rsquo;t been defined yet. This manual is a shared reference for all of them, and it will grow alongside the community. Every volunteer has access to the whole thing, not just the sections that touch their immediate work. That&rsquo;s intentional: understanding how the whole system works — even the parts outside your own role — makes for better collaboration and a more connected community.
          </p>
        </section>

        <section className="man-section">
          <h2 className="man-section__title">How to use it</h2>
          <p>
            Use the sidebar on the left to navigate. Each chapter covers one area of the system. You can start anywhere — you don&rsquo;t need to begin at the beginning.
          </p>
          <p>
            The person who invited you into your volunteer role will let you know which chapters are most directly relevant to what you&rsquo;ll be doing. But you&rsquo;re welcome — and encouraged — to explore any of it. Knowing the full picture, even parts you may never touch directly, is part of what it means to hold this work together.
          </p>
          <div className="man-note">
            This is a living document. It will be updated as the website grows and as new features are added. If something here is unclear, confusing, or out of date, that&rsquo;s always worth mentioning — this manual is only as good as the care that goes into maintaining it.
          </div>
        </section>

        <section className="man-section">
          <h2 className="man-section__title">A note on technology</h2>
          <p>
            This system is built to be as simple as possible for the people using it. Most things work the way you&rsquo;d expect. But technology can feel unfamiliar, and that&rsquo;s completely understandable.
          </p>
          <p>
            If something feels confusing, please know: that&rsquo;s not a reflection on you. It may mean the system can be clearer, or that this manual needs a better explanation. You&rsquo;re not expected to figure things out alone — the manual is here for exactly those moments, and so is the rest of your community.
          </p>
        </section>

        {/* ════════════════════════════════════════
            CHAPTER 1 — REGISTRATION
            ════════════════════════════════════════ */}

        <div id="registration" className="man-chapter">
          <h1 className="man-chapter__title">Registration</h1>
          <p className="man-chapter__subtitle">
            This chapter walks you through the registration system — what the experience looks like from a member&rsquo;s perspective, what the tools look like from the volunteer side, and how to handle every situation that comes up.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="reg-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            Registration is the process by which someone claims a spot in a program. When a program has registration enabled, a <strong>Register →</strong> button appears on the program&rsquo;s page. Members and guests fill out a short form — name, email, any custom questions the program requires — and their spot is confirmed instantly.
          </p>
          <p>
            The registration system is built into this website. There is no third-party form tool to manage. Everything lives in one place: the registrar area at <strong>/account/registrar</strong>.
          </p>
          <p>
            Registration is optional. Programs that don&rsquo;t need it — like open drop-in sittings — simply leave registration turned off. Those programs have no registration button and no list to manage.
          </p>
          <p>
            There is also a standalone registration page at <strong>/programs/[slug]/register</strong> for each program. This is useful when you want to send someone directly to the form without them scrolling through the program description. It&rsquo;s also the page that approval emails link to, so promoted waitlist members land directly on the dana step.
          </p>
        </section>

        {/* ── Member experience ── */}
        <section id="reg-member-exp" className="man-section">
          <h2 className="man-section__title">Member experience</h2>
          <p>
            Here is what a member or visitor sees when they register. The form adapts based on whether the person has an account and whether they&rsquo;ve registered with RIM before.
          </p>

          <h3 className="man-section__h3">The registration form</h3>
          <ol className="man-steps">
            <li>They visit the program page and click <strong>Register →</strong>, or go directly to <code>/programs/[slug]/register</code>.</li>
            <li>They fill in their name, email, and optionally phone. If they have an account and are signed in, name and email are pre-filled and locked.</li>
            <li>If the program has custom questions (e.g. &ldquo;Do you have any accessibility needs?&rdquo;), those appear next. Questions can be short text, long text, yes/no, or multiple choice.</li>
            <li>If this is their first time registering with RIM and they are not signed in, a <strong>Community Agreements</strong> section appears. They must check a box before they can submit.</li>
            <li>They click <strong>Register</strong> (or <strong>Join Waitlist</strong> if full). If 5 or fewer spots remain, a &ldquo;filling up&rdquo; warning shows above the form.</li>
            <li>A confirmation email arrives within a few seconds. If waitlisted, the email says so and gives their position in the queue.</li>
            <li>If the program has a dana or fee step, it appears immediately after. They can complete it now or return later.</li>
          </ol>

          <h3 className="man-section__h3">Email recognition — returning members</h3>
          <p>
            When someone types an email address that belongs to an existing RIM account, the form looks them up quietly. If a match is found:
          </p>
          <ul className="man-list">
            <li>Their name fields are filled in from their account and locked. A &ldquo;Welcome back, [Name]&rdquo; message appears.</li>
            <li>Their registration is linked to their account, so it shows up in their My Programs history.</li>
            <li>If they have already agreed to the community agreements, that section is hidden — they won&rsquo;t see it again.</li>
          </ul>
          <p>
            This prevents name inconsistencies — the system uses the name in their account, not whatever they type in a hurry.
          </p>
          <div className="man-note">
            <strong>If a member says their name is locked:</strong> That means they were recognized by email and their account name is being used. If it&rsquo;s wrong, you can fix it directly in the registrar table using the Edit button, or they can update it themselves at <strong>/account/my-profile</strong> once signed in.
          </div>

          <h3 className="man-section__h3">Community agreements</h3>
          <p>
            The registration form includes a community agreements section for anyone who has not yet agreed to them. It only appears when the person is not signed in AND has not already agreed on a previous registration. They must check a box — &ldquo;I&rsquo;m entering this community in a spirit of care and respect&rdquo; — before submitting.
          </p>
          <p>
            Once agreed, this is recorded on their account and they will never be asked again. Members who are signed in have already passed through this threshold and see no agreements section at all.
          </p>

          <h3 className="man-section__h3">After registering</h3>
          <p>
            Once confirmed, the program page shows <strong>✓ You&rsquo;re registered</strong> instead of a button. If calendar dates are set on the program, members also see links to add the event to Google Calendar or download an .ics file for Apple Calendar or Outlook.
          </p>
          <p>
            Members can see all their registrations — status, dana status, and any notes shared with them — at <strong>/account/programs</strong> (linked as &ldquo;My Programs&rdquo; in the navigation). If they have a pending dana offering, their dashboard homepage shows a reminder card with a link to complete it. The card disappears once dana is received.
          </p>
          <h3 className="man-section__h3">Self-cancellation</h3>
          <p>
            Members can cancel their own spot directly from <strong>My Programs</strong> — they don&rsquo;t need to contact you. Each active registration has a small <strong>Cancel registration</strong> link at the bottom of the card. Clicking it shows a confirmation step — &ldquo;Cancel your spot? This cannot be undone.&rdquo; — so accidental taps aren&rsquo;t possible. Once cancelled, the card updates immediately to show &ldquo;✓ Registration cancelled.&rdquo;
          </p>
          <p>
            When a member cancels, you receive a cancellation notification email at the registrar inbox (the same email you get when you cancel someone from the table). The member does not receive an automatic email. The waitlist does not auto-promote — you check <strong>/account/registrar</strong> and promote who you choose.
          </p>
        </section>

        {/* ── Your tools ── */}
        <section id="reg-your-tools" className="man-section">
          <h2 className="man-section__title">Your tools</h2>

          <h3 className="man-section__h3">The program list — /account/registrar</h3>
          <p>
            Your workspace starts at <strong>/account/registrar</strong>. This page shows all programs that have registration enabled, in sort order.
          </p>
          <p>Each card shows:</p>
          <ul className="man-list">
            <li>Program name and tagline</li>
            <li>A capacity bar — turns yellow when nearly full, red when full</li>
            <li>A <strong>green &ldquo;↑ Spot open&rdquo; badge</strong> when the program has a confirmed spot available AND people on the waitlist — this means a cancellation has opened a gap and someone is waiting. This takes priority over the regular waitlist badge so you notice it immediately.</li>
            <li>An amber badge for waitlisted people when the program is still at or above capacity (normal waitlist, no open gap)</li>
            <li>An amber badge for registrants with pending dana</li>
            <li>A green count if everything is in order</li>
          </ul>
          <p>
            Cards with anything needing attention — including open spots — are highlighted in amber so you can spot them at a glance.
          </p>

          <h3 className="man-section__h3">The registrar table — /account/registrar/[slug]</h3>
          <p>
            Click any card to open its full registration list. From the table you can:
          </p>
          <ul className="man-list">
            <li>See all registrants: name, email, phone, status, dana status, amount paid, date registered, and any custom question responses</li>
            <li>Change a registrant&rsquo;s status — promote from waitlist, cancel a registration, restore a cancelled registration</li>
            <li>Edit a registrant&rsquo;s custom question responses directly in the table</li>
            <li>Send a self-service edit link to a registrant (they get an email with a secure link — no account required)</li>
            <li>Send an individual reminder email, or bulk-send to everyone who hasn&rsquo;t received one yet</li>
            <li>Send a dana reminder to a specific registrant with pending dana</li>
            <li>Resend a confirmation email to any registrant</li>
            <li>Add or edit a private note (visible only to volunteers — never sent to the member)</li>
            <li>Export the full list as a CSV file</li>
          </ul>
          <p>
            If a reminder date is set on the program, a banner appears at the top of the table showing the scheduled date and a button to send reminders to anyone who hasn&rsquo;t received one yet.
          </p>
          <p>
            If the program has capacity set and a confirmed spot is open while the waitlist is non-empty — meaning a cancellation has freed a gap — a warm <strong>&ldquo;A spot has opened&rdquo; alert banner</strong> appears above the table. It tells you how many people are waiting and reminds you to use the Promote button to choose who gets the spot. The banner disappears once capacity is full again.
          </p>
        </section>

        {/* ── Status guide ── */}
        <section id="reg-statuses" className="man-section">
          <h2 className="man-section__title">Status guide</h2>
          <p>Every registration has a status. Here is what each one means.</p>

          <div className="man-status-grid">
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--registered">Registered</span>
              <p>The person has a confirmed spot. Set automatically when they submit and capacity is available. This is the normal state.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--approved">Approved</span>
              <p>Like Registered, but set manually by a volunteer. Use this to distinguish personally approved participants from self-registered ones — for example, programs with an application or interview process. Both count toward capacity.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--waitlisted">Waitlisted</span>
              <p>The program was full when they registered. They are in the queue, ordered by submission time. Promote them manually when a spot opens — the system sends an approval email. Dana is not collected while waitlisted.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--cancelled">Cancelled</span>
              <p>Cancelled by the member or by a registrar. Does not count toward capacity. You can restore it by clicking Restore. The system does not auto-promote the waitlist on cancellation — you do that manually.</p>
            </div>
          </div>
        </section>

        {/* ── Dana ── */}
        <section id="reg-dana" className="man-section">
          <h2 className="man-section__title">Dana</h2>
          <p>
            Dana is the traditional practice of giving — offering what you can, freely and without obligation, in support of the teachings and the center. For programs that use dana, the registration form includes a payment step via Stripe (credit or debit card).
          </p>
          <p>
            Each program has a <strong>Dana Mode</strong> set by whoever configured it in Sanity Studio:
          </p>
          <table className="man-table">
            <thead>
              <tr><th>Mode</th><th>What it means</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>None</td>
                <td>No dana step. The form skips it entirely. Most drop-in programs use this.</td>
              </tr>
              <tr>
                <td>Voluntary</td>
                <td>A suggested amount is shown. The member can change it to any amount or skip it entirely with &ldquo;No thank you.&rdquo; No obligation.</td>
              </tr>
              <tr>
                <td>Base + Dana</td>
                <td>A required base fee (to cover costs) plus an optional voluntary dana on top.</td>
              </tr>
              <tr>
                <td>Fixed</td>
                <td>A set price. Used for programs with a firm cost, like a retreat with accommodation.</td>
              </tr>
            </tbody>
          </table>
          <p>
            The <strong>Dana Status</strong> column in your table tells you where each person stands:
          </p>
          <table className="man-table">
            <thead>
              <tr><th>Status</th><th>What it means</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Waived</td>
                <td>No dana was expected for this program (mode is None), or no amount was configured.</td>
              </tr>
              <tr>
                <td>Pending</td>
                <td>Dana is expected but not completed. The member can return to <code>/programs/[slug]/register</code> to complete it at any time. You can send them a dana reminder from the table.</td>
              </tr>
              <tr>
                <td>Completed</td>
                <td>Dana received via Stripe. The amount is recorded.</td>
              </tr>
              <tr>
                <td>Not Required</td>
                <td>The person is on the waitlist. Dana is not collected until they are confirmed.</td>
              </tr>
            </tbody>
          </table>
          <p>
            When a member has pending dana, their dashboard shows a reminder card automatically. It links them to the program&rsquo;s register page where they can complete their offering. The card disappears once dana is received.
          </p>
          <div className="man-note">
            <strong>Note:</strong> Dana is never a gate on participation. A person with Pending dana is fully registered and should be welcomed. The reminder is a gentle invitation, not a requirement.
          </div>
        </section>

        {/* ── Course access ── */}
        <section id="reg-course-access" className="man-section">
          <h2 className="man-section__title">Course access</h2>
          <p>
            Some programs include access to online materials — audio recordings, readings, or structured courses — hosted in the Members Area. When a program is linked to a course in Sanity Studio, anyone who registers for that program automatically receives access. You don&rsquo;t need to do anything.
          </p>
          <p>
            For situations where automatic access doesn&rsquo;t apply, you can grant or revoke course access manually from the member detail page (<strong>/admin/members/[id]</strong>).
          </p>

          <h3 className="man-section__h3">When to use manual grants</h3>
          <ul className="man-list">
            <li><strong>Historical members</strong> — someone participated before the course was linked to the program. Automatic access only applies to registrations made <em>after</em> the link was added in Sanity Studio.</li>
            <li><strong>Exceptions</strong> — a member who couldn&rsquo;t attend but should still have access to the materials.</li>
            <li><strong>One-off access</strong> — a course not tied to any program, granted directly to a specific person.</li>
          </ul>

          <h3 className="man-section__h3">How to grant or revoke access</h3>
          <ol className="man-steps">
            <li>Go to <strong>/admin/members</strong> and open the member&rsquo;s detail page.</li>
            <li>Scroll to the <strong>Course Access</strong> section.</li>
            <li>Each course is listed with its current status — <em>All Members</em>, <em>Via Registration</em>, <em>Manual Grant</em>, or <em>No Access</em>.</li>
            <li>To grant access, click <strong>Grant Access</strong> on the course. A confirmation step appears — read the note about any registration-based access already in place, then confirm.</li>
            <li>To revoke a manual grant, click <strong>Revoke Access</strong> and confirm. This only removes the manual grant — if the member has registration-based access to the same course, that remains in effect.</li>
          </ol>
          <div className="man-note">
            <strong>Registration-based access is separate from manual grants.</strong> If a member registered for a program that links to a course, they have access through that registration regardless of whether a manual grant exists. Revoking a manual grant does not remove registration-based access.
          </div>
        </section>

        {/* ── Automatic emails ── */}
        <section id="reg-emails" className="man-section">
          <h2 className="man-section__title">Automatic emails</h2>
          <p>
            These emails go out automatically — you don&rsquo;t need to trigger them.
          </p>

          <div className="man-email-list">
            <div className="man-email-item">
              <div className="man-email-item__trigger">When someone registers<br /><em>→ to registrant</em></div>
              <div className="man-email-item__desc">
                A confirmation email goes out immediately. It includes the program name, date, time, location (if set), any custom confirmation message you wrote, and links to add the event to their calendar. If they were waitlisted, the email says so and gives their queue position.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When you promote from waitlist<br /><em>→ to registrant</em></div>
              <div className="man-email-item__desc">
                An approval email goes out automatically when you click <strong>Promote</strong>. It confirms their spot. If the program has dana, the email includes a button linking them to the register page to complete their offering.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a registration is cancelled<br /><em>→ to registrar inbox</em></div>
              <div className="man-email-item__desc">
                You (the registrar inbox) receive a notification. The member does not receive an automatic email — contact them directly if appropriate. The notification includes a link straight to the program&rsquo;s registrar table.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">On the scheduled reminder date<br /><em>→ to all confirmed registrants</em></div>
              <div className="man-email-item__desc">
                If a Reminder Date is set on the program, the system sends a reminder at 9:00 AM Central on that day. Goes to Registered and Approved registrants only — not waitlisted. Includes date, time, location, meeting link, and any custom reminder message. You can also send reminders manually at any time.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When you send a self-service edit link<br /><em>→ to registrant</em></div>
              <div className="man-email-item__desc">
                Clicking <strong>Send Edit Link</strong> emails the registrant a secure, time-limited link. They can update their form responses without needing an account. Valid for 7 days.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a registrant uses their edit link<br /><em>→ to registrar inbox</em></div>
              <div className="man-email-item__desc">
                When a registrant submits changes through their edit link, you receive a notification showing their name, the program, and what they changed.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When you send a dana reminder<br /><em>→ to registrant</em></div>
              <div className="man-email-item__desc">
                Clicking <strong>Send Dana Reminder</strong> on a row where Dana Status is Pending sends a gentle nudge with a direct link to complete their offering. This is manually triggered — it does not send automatically.
              </div>
            </div>
          </div>
          <p>
            You can also manually <strong>Resend Confirmation</strong> to any registrant from the table — useful when someone says they never received the original.
          </p>
        </section>

        {/* ── Calendar links ── */}
        <section id="reg-calendar" className="man-section">
          <h2 className="man-section__title">Calendar links</h2>
          <p>
            When a program has a <strong>Start Date &amp; Time</strong> set, registered members see two calendar links on the program page: one for Google Calendar and one for Apple Calendar / Outlook (downloaded as a .ics file). These links also appear in the confirmation email.
          </p>
          <p>
            For programs that meet more than once, a recurrence pattern can be set in Sanity Studio using four fields:
          </p>
          <table className="man-table">
            <thead>
              <tr><th>Field</th><th>What it controls</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Repeats</td>
                <td>Daily, Weekly, or Monthly. Leave blank for a single event.</td>
              </tr>
              <tr>
                <td>Every</td>
                <td>The interval. 1 = every week, 2 = every other week.</td>
              </tr>
              <tr>
                <td>On Days</td>
                <td>For Weekly programs, which days of the week the program meets.</td>
              </tr>
              <tr>
                <td>Number of Sessions</td>
                <td>Total count including the first. An 8-week course = 8.</td>
              </tr>
            </tbody>
          </table>
          <p>
            When recurrence is set, the <strong>.ics file</strong> includes all sessions — members download the whole course in one click. The <strong>Google Calendar link</strong> only adds the first session (a Google limitation, not ours) — it&rsquo;s labeled &ldquo;first session only&rdquo; so members understand.
          </p>
          <div className="man-note">
            <strong>Retreat tip:</strong> For a retreat that runs as one continuous block (e.g. Friday evening through Sunday afternoon), leave Recurrence blank. Set Start Date &amp; Time to Friday evening and End Date &amp; Time to Sunday afternoon. The calendar entry spans the full retreat.
          </div>
        </section>

        {/* ── Common tasks ── */}
        <section id="reg-tasks" className="man-section">
          <h2 className="man-section__title">Common tasks</h2>

          <div className="man-task">
            <h3 className="man-task__title">Turning on registration for a program</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio → <strong>Registration</strong> tab.</li>
              <li>Turn on <strong>Enable Registration</strong>.</li>
              <li>Set a <strong>Capacity</strong> if the program has a maximum size. Leave blank for unlimited.</li>
              <li>Optionally set a <strong>Registration Deadline</strong> — the form closes automatically at that time.</li>
              <li>Add any <strong>Custom Questions</strong> the program needs.</li>
              <li>Write a <strong>Confirmation Email Message</strong> — the warm, personal note in the confirmation email.</li>
              <li>Go to the <strong>2 — When &amp; Where</strong> tab and set the <strong>Start Date &amp; Time</strong> so members get calendar links.</li>
              <li>Publish. The Register button appears on the program page immediately.</li>
            </ol>
            <p className="man-task__note">If you don&rsquo;t have Sanity Studio access, ask your program coordinator to do this step.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Promoting someone from the waitlist</h3>
            <ol className="man-steps">
              <li>Go to <strong>/account/registrar</strong>. If a spot has opened, you&rsquo;ll see a green <strong>&ldquo;↑ Spot open&rdquo;</strong> badge on the program card — click it.</li>
              <li>Inside the program, the <strong>&ldquo;A spot has opened&rdquo;</strong> alert tells you how many people are waiting.</li>
              <li>Find the waitlisted person you want to promote and click <strong>Promote</strong>.</li>
              <li>Their status changes to Registered and they receive an approval email automatically.</li>
              <li>If the program has dana, the approval email includes a link for them to complete their offering — their Dana Status becomes Pending.</li>
            </ol>
            <p className="man-task__note">The waitlist does not auto-promote when a spot opens. You choose who gets the spot — it&rsquo;s your call whether to go in order or consider other factors.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Cancelling a registration (as registrar)</h3>
            <ol className="man-steps">
              <li>Find the registrant in the table and click <strong>Cancel Registration</strong>, then confirm.</li>
              <li>Their spot is freed. You receive a cancellation notification email.</li>
              <li>The member does not receive an automatic email — contact them directly if appropriate.</li>
              <li>To undo, find them in the table and click <strong>Restore</strong>.</li>
            </ol>
            <p className="man-task__note">Members can also cancel themselves from their <strong>My Programs</strong> page. When they do, you receive the same notification email. Either way, you check <strong>/account/registrar</strong> and decide whether to promote someone from the waitlist.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a reminder email</h3>
            <ol className="man-steps">
              <li>Go to <strong>/account/registrar</strong> and open the program.</li>
              <li>To send to everyone who hasn&rsquo;t received a reminder yet, click <strong>Send to Remaining</strong> in the banner at the top of the table.</li>
              <li>To send to one person, find them and click <strong>Send Reminder</strong>.</li>
            </ol>
            <p className="man-task__note">The table shows &ldquo;Reminder sent [date]&rdquo; for each row already sent. You can re-send — it delivers again and updates the timestamp.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a dana reminder</h3>
            <ol className="man-steps">
              <li>Find the registrant whose Dana Status is <strong>Pending</strong>.</li>
              <li>Click <strong>Send Dana Reminder</strong> — they receive an email with a link to complete their offering.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Editing a registrant&rsquo;s responses</h3>
            <ol className="man-steps">
              <li>Find the registrant and click <strong>Edit</strong>.</li>
              <li>Update the field directly in the table and click <strong>Save</strong>.</li>
              <li>Or click <strong>Send Edit Link</strong> to email them a secure self-service link. You receive a notification when they submit changes.</li>
            </ol>
            <p className="man-task__note">Edit links expire after 7 days. Send a new one if needed.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Adding a note to a registration</h3>
            <ol className="man-steps">
              <li>Click <strong>Edit</strong> on the registrant&rsquo;s row, update the Notes field, and save.</li>
              <li>Notes are visible only to volunteers — never sent to the member or shown anywhere public.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Exporting the registration list</h3>
            <ol className="man-steps">
              <li>Open the program in <strong>/account/registrar</strong> and click <strong>Export CSV</strong>.</li>
              <li>A spreadsheet downloads with all registrant information: name, email, phone, status, dana status, custom question responses, and notes. Open in Excel, Numbers, or Google Sheets.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Closing registration early</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio → <strong>Registration</strong> tab.</li>
              <li>Turn on <strong>Registration Closed</strong> and publish.</li>
              <li>The Register button disappears from the program page immediately.</li>
            </ol>
            <p className="man-task__note">You can also set a <strong>Registration Deadline</strong> to close automatically at a specific date and time — no need to remember to do it manually.</p>
          </div>
        </section>

        {/* ── Edge cases ── */}
        <section id="reg-edge-cases" className="man-section">
          <h2 className="man-section__title">Edge cases</h2>

          <div className="man-task">
            <h3 className="man-task__title">Someone registers with the wrong email address</h3>
            <p>Ask them to re-register with the correct email. Cancel the incorrect registration. If the program is now full, promote them manually after they join via the waitlist.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone didn&rsquo;t receive their confirmation email</h3>
            <p>Click <strong>Resend Confirmation</strong> in their row. Ask them to check spam. Confirm the email address is correct in the table.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone says their name is locked and they can&rsquo;t change it</h3>
            <p>The form recognized their email and pulled the name from their account. If the name is wrong, fix it in the registrar table using Edit, or they can update it at <strong>/account/my-profile</strong> once signed in.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A program is full but you want to add someone directly</h3>
            <p>Have them register normally — they go to the waitlist. Then immediately promote them. This keeps capacity accounting accurate and sends the proper emails.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member cancels their spot</h3>
            <p>Members can cancel from their <strong>My Programs</strong> page without contacting you. When they do, you receive a cancellation notification email. If the program has capacity set and people on the waitlist, the <strong>/account/registrar</strong> index card shows a green <strong>&ldquo;↑ Spot open&rdquo;</strong> badge. Open the program — the &ldquo;A spot has opened&rdquo; banner tells you how many people are waiting — then promote who you choose.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">You want to register someone who doesn&rsquo;t want to do it themselves</h3>
            <p>Fill out the registration form on their behalf using their email. A confirmation email goes to them automatically. If they don&rsquo;t have an account, one is created silently — they can sign in any time via magic link to that email address.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A previously archived member re-registers</h3>
            <p>The system automatically restores their account on registration. Their email is recognized, name pre-filled. After submitting, their account is active again. No action needed on your part.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member says they can&rsquo;t access their account</h3>
            <p>All sign-in uses a <strong>magic link</strong> — no passwords. They go to <strong>/login</strong>, enter their email, and receive a one-click sign-in link. Ask them to check spam. If their email address has changed, they need to re-register with the new address and contact an admin to link their history.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member has pending dana but doesn&rsquo;t know how to complete it</h3>
            <p>Their dashboard shows a reminder card with a link. You can also click <strong>Send Dana Reminder</strong> in the table — the email links them directly to <code>/programs/[slug]/register</code> where the dana step appears immediately.</p>
          </div>
        </section>


        {/* ════════════════════════════════════════
            CHAPTER 2 — PROGRAMS & SANITY STUDIO
            ════════════════════════════════════════ */}

        <div id="programs" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Programs &amp; Sanity Studio</h1>
          <p className="man-chapter__subtitle">
            This chapter covers how to create and manage programs — from every tab and field in Sanity Studio, to creating the Google Meet link once a virtual program is ready.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="prog-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            All content on the website — programs, courses, teacher bios, and more — is managed through <strong>Sanity Studio</strong>, a separate content editor at <a href="https://rooted-in-mindfulness.sanity.studio/" target="_blank" rel="noopener noreferrer">rooted-in-mindfulness.sanity.studio</a>. You can also reach it from the Sanity Studio card on your dashboard.
          </p>
          <p>
            When you save and publish a program in Sanity, it appears on the website within seconds. There is no separate &ldquo;send to website&rdquo; step — publishing is it.
          </p>
          <div className="man-note">
            <strong>Drafts vs. published:</strong> Every document in Sanity starts as a draft. Drafts are only visible to you inside Sanity — they do not appear on the website. Click <strong>Publish</strong> to make it live. If you edit a published document, your changes are saved as a draft until you publish again. You can work on a draft for as long as you need before publishing. There is no risk of showing a half-finished program to members while you are working on it.
          </div>
        </section>

        {/* ── How a program comes together ── */}
        <section id="prog-anatomy" className="man-section">
          <h2 className="man-section__title">How a program comes together</h2>
          <p>
            A program in Sanity is organized into six tabs. Each tab controls a different part of how the program functions. You don&rsquo;t need to fill in every field — a program can exist at any level of completeness.
          </p>
          <table className="man-table">
            <thead>
              <tr><th>Tab</th><th>What it controls</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>1 — Basics</td>
                <td>The public-facing page: name, URL slug, category, description, image, pull quote, teachers, and special notes.</td>
              </tr>
              <tr>
                <td>2 — When &amp; Where</td>
                <td>Dates, times, location, recurrence, and the Google Meet setup for virtual programs.</td>
              </tr>
              <tr>
                <td>3 — Registration</td>
                <td>Turns the registration form on, sets capacity and deadline, custom questions, and links to online courses.</td>
              </tr>
              <tr>
                <td>4 — Emails</td>
                <td>The confirmation email message and the automated reminder — what it says and when it sends.</td>
              </tr>
              <tr>
                <td>5 — Dana</td>
                <td>Controls whether and how dana or payment is collected during registration.</td>
              </tr>
              <tr>
                <td>6 — Settings</td>
                <td>How the program appears on the member dashboard (day, announcements, early arrival note) and where it appears in public listings.</td>
              </tr>
            </tbody>
          </table>

          <div className="man-note">
            <strong>Minimum to maximum:</strong><br />
            <strong>Page exists (but not public):</strong> Name + Slug + Publish.<br />
            <strong>Appears in public listing:</strong> + Category (required).<br />
            <strong>Complete public page:</strong> + Tagline, Image, Description, Teachers, Start Date &amp; Time (auto-generates the schedule label).<br />
            <strong>Calendar links in emails:</strong> + Start Date &amp; Time.<br />
            <strong>Registration enabled:</strong> + Enable Registration, Confirmation Email Message.<br />
            <strong>Dana enabled:</strong> + Dana Mode + amounts.<br />
            <strong>Multi-session calendar:</strong> + Recurrence fields.
          </div>
        </section>

        {/* ── Creating a program ── */}
        <section id="prog-creating" className="man-section">
          <h2 className="man-section__title">Creating a program</h2>
          <ol className="man-steps">
            <li>Open Sanity Studio and click <strong>Programs</strong> in the left sidebar.</li>
            <li>Click the <strong>+</strong> button (or &ldquo;Create new document&rdquo;) to start a new program.</li>
            <li>You start on the <strong>1 — Basics</strong> tab. Enter the program <strong>Name</strong> — this is the only required field.</li>
            <li>Click <strong>Generate</strong> next to the Slug field to create the URL from the name. The slug becomes the URL path: a program called &ldquo;Morning Sitting&rdquo; gets the URL <code>/programs/morning-sitting</code>.</li>
            <li>Fill in the remaining tabs one at a time. You do not need to complete everything before publishing — you can publish a minimal program and add to it over time.</li>
            <li>When ready for the program to appear on the website, click <strong>Publish</strong>.</li>
          </ol>
          <div className="man-note">
            <strong>Do not change the slug after publishing.</strong> The slug is the program&rsquo;s permanent URL. If you change it after people have bookmarked the page or received it in emails, those links will break. You can freely change the Name — only the slug affects URLs. If you must change a slug, contact an admin — a redirect can be set up to catch old links.
          </div>
        </section>

        {/* ── 1 — Basics tab ── */}
        <section id="prog-content" className="man-section">
          <h2 className="man-section__title">1 — Basics</h2>
          <p>
            Everything that defines what the program <em>is</em> — its name, URL, category, public-facing description, image, pull quote, teachers, and special notes.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Name</div>
              <div className="man-field__desc">
                <p>The program&rsquo;s full name as it appears on the website, in emails, and on registration confirmations. Use the official name — avoid abbreviations unless they are widely understood.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Slug</div>
              <div className="man-field__desc">
                <p>The URL path for this program — auto-generated from the name. Click <strong>Generate</strong> to create it. <strong>Do not change the slug after the program is live</strong> — existing links and bookmarks will break. If a slug change is unavoidable, contact an Admin so a redirect can be set up.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Program Category</div>
              <div className="man-field__desc">
                <p><strong>Required for the program to appear on the public Programs &amp; Events listing page.</strong> Click and start typing to search, or press Backspace to see all categories. Categories include things like Meditation, Retreats, Classes.</p>
                <p>If no existing category fits, ask an Admin to create a new one in Sanity → Program Categories. If this field is left blank, the program page still exists and is accessible by direct link — it just won&rsquo;t appear in the listings.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Tagline</div>
              <div className="man-field__desc">
                <p>A single sentence shown on listing cards and in search results. Keep it to one line. Aim for something that gives a newcomer an immediate sense of what the program is.</p>
                <p><em>Example: &ldquo;A quiet space for sitting practice, open to all levels.&rdquo;</em></p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Program Image</div>
              <div className="man-field__desc">
                <p>The large image at the top of the program page. After uploading, click the <strong>hotspot icon</strong> to choose which part of the image stays in frame when it gets cropped for different screen sizes. Landscape images work best.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Program Description</div>
              <div className="man-field__desc">
                <p>The main body of the program page. This is a rich text editor. You can use:</p>
                <ul className="man-list">
                  <li><strong>H2</strong> for main section headings, <strong>H3</strong> for sub-sections</li>
                  <li>Bold, italic, links, bullet lists, numbered lists</li>
                  <li><strong>Practice Suggestion</strong> — a teal callout box for guided instructions or &ldquo;try this&rdquo; prompts (add with the + button)</li>
                  <li><strong>Body Quote</strong> — a warm tinted quote box with an attribution line</li>
                  <li><strong>Verse Quote</strong> — centered, styled quotation for poems or short verse</li>
                  <li><strong>Callout Text</strong> — larger serif text for a highlighted passage</li>
                </ul>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Pull Quote</div>
              <div className="man-field__desc">
                <p>A short phrase displayed prominently between the program details card and the description — styled with large decorative quotation marks. Use a line that captures the spirit of the program. Leave blank if not needed.</p>
                <p><em>Example: &ldquo;The practice is simply being present.&rdquo;</em></p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Quote Source</div>
              <div className="man-field__desc">
                <p>Attribution shown below the pull quote. A teacher name, tradition, or text. Leave blank for unattributed quotes.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Special Notes</div>
              <div className="man-field__desc">
                <p>Shown below the description. Use for practical reminders that don&rsquo;t belong in the main narrative — for example: &ldquo;Please arrive 5 minutes early. Cushions and chairs are provided.&rdquo; Supports basic formatting.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Teacher / Facilitator(s)</div>
              <div className="man-field__desc">
                <p>Choose one or more teachers from the Team list. Their names and photos appear on the program page. If a teacher isn&rsquo;t in the list yet, ask an Admin to add them in Sanity → Team.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2 — When & Where tab ── */}
        <section id="prog-schedule" className="man-section">
          <h2 className="man-section__title">2 — When &amp; Where</h2>
          <p>
            Everything about when and how the program meets — dates, times, recurrence, location, and the full Google Meet setup for virtual programs.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Date &amp; Time Label (override)</div>
              <div className="man-field__desc">
                <p><strong>Leave this blank for most programs.</strong> The website automatically generates a schedule label from the Start Date &amp; Time, End Date &amp; Time, and recurrence fields — for example, &ldquo;Thursdays · 7–9pm CT&rdquo; or &ldquo;Mondays &amp; Wednesdays · 6:30–8pm CT&rdquo;. This label appears on the program page, listing cards, member dashboard, and in confirmation and reminder emails.</p>
                <p>Only fill this in when the auto-generated label isn&rsquo;t right for your program — for example, a retreat with a custom date range like &ldquo;June 7–9, 2025 · 9am–5pm each day&rdquo; that doesn&rsquo;t fit the structured fields. Whatever you type here overrides the auto-generated version everywhere it appears.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Start Date &amp; Time</div>
              <div className="man-field__desc">
                <p>The machine-readable date and time used to generate <strong>Add-to-Calendar links</strong> and — for virtual programs — to check room availability when creating the Google Meet. Use the date picker and enter time in Central Time.</p>
                <p>For recurring programs, enter the date of the next session. Leave blank for open-ended programs that don&rsquo;t need calendar links or automatic Meet creation.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">End Date &amp; Time</div>
              <div className="man-field__desc">
                <p>Optional end time for the calendar event. If left blank, calendar events default to 1 hour after the start time.</p>
                <p>For retreats, set this to the actual end of the retreat so the calendar event spans the full block rather than just the first day.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Repeats</div>
              <div className="man-field__desc">
                <p>Whether the program recurs. Choose <strong>Daily</strong>, <strong>Weekly</strong>, or <strong>Monthly</strong>. Leave blank (use the × button to clear) for a single event or a retreat that runs as one continuous block.</p>
                <p>When this is set, the other three recurrence fields become visible.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Every</div>
              <div className="man-field__desc">
                <p>How often the program repeats. 1 = every week, 2 = every other week, 3 = every third week, and so on. Defaults to 1 if left blank.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">On Days</div>
              <div className="man-field__desc">
                <p>Visible only for <strong>Weekly</strong> recurrence. Check each day of the week the program meets — for example, just Wednesday, or both Monday and Thursday.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Number of Sessions</div>
              <div className="man-field__desc">
                <p>The total number of sessions, including the first one. An 8-week Wednesday course = 8. A 6-month monthly group = 6.</p>
                <p>The .ics file download will include all sessions. The Google Calendar link only adds the first session (a Google limitation — labeled clearly for members).</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Format</div>
              <div className="man-field__desc">
                <p>How does this program meet? Choose one:</p>
                <ul className="man-list">
                  <li><strong>In-person</strong> — everyone attends at a physical location. Location fields are shown; Google Meet section is hidden.</li>
                  <li><strong>Virtual</strong> — online only. Location fields are hidden; Google Meet panel appears in the registrar area.</li>
                  <li><strong>Hybrid</strong> — some participants at the center, others join via Google Meet. Both location and Google Meet fields are shown.</li>
                </ul>
                <p>Defaults to <strong>In-person</strong>. Setting Format to In-person and republishing automatically removes any existing Google Calendar room booking and clears the Meet link.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Venue</div>
              <div className="man-field__desc">
                <p>Where does this program meet in person? Only visible for In-person and Hybrid programs.</p>
                <ul className="man-list">
                  <li><strong>At RIM (16905 W. Bluemound Rd., Brookfield)</strong> — the default. The system automatically fills in the RIM name, address, and a Google Maps link on the program page and in all emails. No extra steps needed.</li>
                  <li><strong>Other location</strong> — for retreats or off-site events. Two additional fields appear: Location Name and Location Link.</li>
                </ul>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Location Name</div>
              <div className="man-field__desc">
                <p>Only shown when Venue is set to <strong>Other location</strong>. The venue name and/or address for off-site programs — shown on the program page and in reminder emails.</p>
                <p><em>Example: Forest Refuge, 99 Woodland St., Barre, MA</em></p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Location Link</div>
              <div className="man-field__desc">
                <p>Only shown when Venue is set to <strong>Other location</strong>. A Google Maps or venue website URL. When set, the location name on the program page becomes a clickable link. Paste the full URL including <code>https://</code>.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Meeting Link</div>
              <div className="man-field__desc">
                <p>The Google Meet URL members use to join. Only visible for Virtual and Hybrid programs. When set, the link is automatically included in reminder emails.</p>
                <p>Fill this in by clicking <strong>Create Google Meet</strong> in the registrar area — the system finds a free room account and saves the link here automatically. You can also paste a URL manually if needed.</p>
                <p>Make sure this is set before your reminder date arrives — if it&rsquo;s blank when the reminder goes out, members won&rsquo;t receive a join link in that email.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3 — Registration tab ── */}
        <section id="prog-reg-tab" className="man-section">
          <h2 className="man-section__title">3 — Registration</h2>
          <p>
            Turns registration on and configures the form — capacity, deadline, custom questions, and which online courses registrants receive access to. See the Registration chapter for a full explanation of how the form works in practice.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Enable Registration</div>
              <div className="man-field__desc">
                <p>Turns the registration form on. When off, no Register button appears on the program page and no registration is accepted.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Registration Closed</div>
              <div className="man-field__desc">
                <p>Manually closes registration even if capacity remains and no deadline has passed. Use when you want to stop new registrations immediately — for example, a day before the program when you need to finalize the list.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Capacity</div>
              <div className="man-field__desc">
                <p>Maximum number of confirmed registrants (Registered + Approved combined). When this number is reached, new submissions automatically go to the waitlist. Leave blank for unlimited capacity.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Registration Deadline</div>
              <div className="man-field__desc">
                <p>The form closes automatically at this date and time. Useful for programs that need to finalize numbers ahead of time — e.g., a retreat that needs a headcount three days before. No manual action needed.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Custom Registration Questions</div>
              <div className="man-field__desc">
                <p>Additional questions added to the form after the standard name/email/phone fields. Each question has a type and can be marked required:</p>
                <ul className="man-list">
                  <li><strong>Short Text</strong> — single-line input (e.g. &ldquo;What brings you to this retreat?&rdquo;)</li>
                  <li><strong>Long Text</strong> — multi-line textarea for longer answers</li>
                  <li><strong>Yes / No</strong> — a dropdown with Yes and No options</li>
                  <li><strong>Multiple Choice</strong> — a dropdown with custom options you define</li>
                </ul>
                <p>Answers appear in the registrar table and CSV export.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Linked Courses (Online Materials)</div>
              <div className="man-field__desc">
                <p>If this program has an associated online course in the Members Area — audio recordings, readings, or other materials — link it here. Members who register for this program will <em>automatically</em> receive access to all linked courses without any manual action on your part.</p>
                <p>Click the field and type to search for a course by name, or press Backspace to see all available courses. You can link more than one course.</p>
                <div className="man-note" style={{margin: "8px 0 0"}}>
                  <strong>Important:</strong> Access is granted automatically to people who register <em>after</em> you add the link. Members who registered before you made the change will not get automatic access — an Admin can grant it manually from the member detail page.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4 — Emails tab ── */}
        <section id="prog-emails" className="man-section">
          <h2 className="man-section__title">4 — Emails</h2>
          <p>
            Controls what registrants receive by email — a custom message in the confirmation that goes out immediately after registration, and an automated reminder that sends on a date you choose.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Confirmation Email Message</div>
              <div className="man-field__desc">
                <p>A personal note included in the confirmation email — this is often the first substantial communication a registrant receives from RIM about the program. Make it warm, practical, and welcoming.</p>
                <p>What to include: directions, where to park, what to bring, what to expect on the first day, a note about the teacher, or simply a warm welcome.</p>
                <p>Formatting tips: Bold and italic work well. Bullet lists are good for practical details. Links are supported. <strong>Avoid headings</strong> — they render large and awkward in email clients. Keep paragraphs short. 3–4 brief paragraphs is usually enough.</p>
                <p>If this field is left blank, the confirmation email still goes out — it just won&rsquo;t have a personal message from the program.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Reminder Email Date</div>
              <div className="man-field__desc">
                <p>On this date, the system automatically sends a reminder email to all confirmed registrants at 9:00 AM Central. Set it one or two days before the program starts — Goes to Registered and Approved only, not waitlisted members.</p>
                <p><strong>For virtual programs:</strong> make sure the Meeting Link (Step 2) is set before this date. Members are directed to their dashboard to find it — but if the field is empty when the reminder sends, there will be nothing to direct them to.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Reminder Email Message</div>
              <div className="man-field__desc">
                <p>The custom message in the reminder email — directions, what to bring, a warm note. If left blank, the reminder still goes out with standard program details.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5 — Dana tab ── */}
        <section id="prog-dana-tab" className="man-section">
          <h2 className="man-section__title">5 — Dana</h2>
          <p>
            Controls whether and how dana (financial offerings) are collected during registration. See the Dana section in the Registration chapter for a full explanation of how each mode works in practice.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Dana Mode</div>
              <div className="man-field__desc">
                <p>Determines the dana step in the registration form:</p>
                <ul className="man-list">
                  <li><strong>None</strong> — no dana step at all. Registration completes without any payment prompt. Use for drop-ins and programs where offering is not part of the registration experience.</li>
                  <li><strong>Voluntary</strong> — a suggested amount is shown, but the member can change it to any amount or skip it entirely with &ldquo;No thank you.&rdquo; No obligation whatsoever.</li>
                  <li><strong>Base + Dana</strong> — a required base fee (to cover costs) plus an optional additional dana on top. The member cannot skip the base, but the extra is voluntary.</li>
                  <li><strong>Fixed</strong> — a set price. The member pays this amount or cannot complete registration. Use for programs with firm costs like retreats with accommodation.</li>
                </ul>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Suggested Dana Amount</div>
              <div className="man-field__desc">
                <p>Used in Voluntary and Base + Dana modes. Pre-fills the dana input with this amount. The member can change it freely. Enter a number — for example, <code>25</code> for $25.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Base Amount</div>
              <div className="man-field__desc">
                <p>Used in Base + Dana mode only. The required fee the member must pay. They cannot skip or reduce this amount. Enter a number.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Fixed Price</div>
              <div className="man-field__desc">
                <p>Used in Fixed mode only. The exact amount the member is charged — displayed clearly before they confirm. Enter a number.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Dana Step Message</div>
              <div className="man-field__desc">
                <p>A short note shown directly on the dana step of the registration form. Use it to explain this program&rsquo;s dana practice or how funds are used. Keep it brief and warm — two or three sentences at most.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Dana Info (Program Page)</div>
              <div className="man-field__desc">
                <p>A one-line note displayed on the program&rsquo;s public page, separate from the registration form. Optional. Example: <em>This program is offered on a dana basis.</em></p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6 — Settings tab ── */}
        <section id="prog-dashboard" className="man-section">
          <h2 className="man-section__title">6 — Settings</h2>
          <p>
            Controls how the program appears on the <strong>member dashboard</strong> and where it shows up in public listings.
          </p>
          <p>
            Recurring programs like weekly sittings appear on the dashboard as a persistent card. These fields let you add timely messages to those cards and control where in the listing the program sits.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Day of Week</div>
              <div className="man-field__desc">
                <p>Select the day(s) this program meets. The dashboard groups programs by day — this field controls which day-column the program appears under. It also drives the <strong>Today</strong> highlight for members on the day the program runs.</p>
                <p>Leave blank for programs without a fixed recurring day — retreats, one-time events, or anything where day-grouping doesn&rsquo;t apply.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Special Announcement</div>
              <div className="man-field__desc">
                <p>A short message displayed in <strong>bold red</strong> on the program&rsquo;s dashboard card — visible to all logged-in members. Use only for urgent, time-sensitive notices: a room change, a one-time cancellation, a guest teacher.</p>
                <p><em>Example: Tonight&rsquo;s sitting is moved to Room B due to an event in the main hall.</em></p>
                <p><strong>Remember to clear it after the event passes</strong> — update the field to blank and republish so the announcement doesn&rsquo;t linger and lose its urgency.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Early Arrival Message</div>
              <div className="man-field__desc">
                <p>A quiet, standing note shown in muted grey on the dashboard card. Use for stable, recurring guidance that applies week to week — not for urgent announcements (use Special Announcement for those).</p>
                <p><em>Example: Doors open at 6:45pm. Please arrive a few minutes early to get settled before we begin.</em></p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Hide from Member Dashboard</div>
              <div className="man-field__desc">
                <p>When checked, this program does not appear in the member dashboard&rsquo;s program listing. The program&rsquo;s own page is still accessible by direct link. Use for internal or invitation-only programs not meant for the general membership.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Sort Order</div>
              <div className="man-field__desc">
                <p>A number controlling the display order on the public listing and in the registrar area. Lower numbers appear first.</p>
                <p>Use round numbers — 10, 20, 30 — so you can insert new programs between existing ones later without renumbering everything.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Hide from Programs &amp; Events Page</div>
              <div className="man-field__desc">
                <p>When checked, this program does not appear on the public <code>/programs</code> listing page, but its own page is still reachable at its direct URL.</p>
                <p>Use this for programs that are invitation-only, still in draft, or not meant to be discovered by browsing — for example, a private retreat where you share the link directly.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Common tasks ── */}
        <section id="prog-tasks" className="man-section">
          <h2 className="man-section__title">Common tasks</h2>

          <div className="man-task">
            <h3 className="man-task__title">Creating a new program from scratch</h3>
            <ol className="man-steps">
              <li>Sanity Studio → <strong>Programs</strong> → <strong>+</strong> (Create).</li>
              <li>Enter the <strong>Name</strong> and click <strong>Generate</strong> next to the Slug field.</li>
              <li><strong>1 — Basics:</strong> Set the <strong>Category</strong> (required for public listing), add the tagline, upload an image, choose teachers, and write the description.</li>
              <li><strong>2 — When &amp; Where:</strong> Set the <strong>Start Date &amp; Time</strong> and <strong>End Date &amp; Time</strong> — the schedule label is generated automatically. Set the <strong>Format</strong> (In-person / Virtual / Hybrid), and add the location or venue. Set recurrence fields if this program meets more than once.</li>
              <li><strong>3 — Registration:</strong> If this program needs registration, turn on <strong>Enable Registration</strong>, set a capacity, and add any custom questions.</li>
              <li><strong>4 — Emails:</strong> Write the <strong>Confirmation Email Message</strong> and set a <strong>Reminder Email Date</strong> if you want an automated reminder to go out.</li>
              <li><strong>5 — Dana:</strong> Set the Dana Mode if this program collects offerings.</li>
              <li><strong>6 — Settings:</strong> Set a <strong>Sort Order</strong> number and a <strong>Day of Week</strong> so the program appears correctly on the dashboard and listing.</li>
              <li>Click <strong>Publish</strong>. The program is live on the website.</li>
            </ol>
            <p className="man-task__note"><strong>Virtual programs:</strong> Set <strong>Format</strong> to <strong>Virtual</strong> or <strong>Hybrid</strong> in the <strong>2 — When &amp; Where</strong> tab and set a <strong>Start Date &amp; Time</strong> before publishing. After publishing, open the program in <strong>/account/registrar</strong> and click <strong>Create Google Meet</strong> to generate the link. See <a href="#google-meet">Setting up a Google Meet</a> for the full picture.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Updating dates or times</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>2 — When &amp; Where</strong> tab.</li>
              <li>Update the <strong>Start Date &amp; Time</strong> field — the schedule label on the page, listing cards, and emails updates automatically. Also update <strong>End Date &amp; Time</strong> if needed.</li>
              <li>Publish.</li>
            </ol>
            <p className="man-task__note">If confirmation emails have already gone out with the old date, consider sending a reminder with the corrected date, or reach out to registered members directly.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Adding a special announcement to the member dashboard</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>6 — Settings</strong> tab.</li>
              <li>Type the announcement in <strong>Special Announcement</strong>.</li>
              <li>Publish. It appears in red on the member dashboard immediately.</li>
              <li>After the event passes, clear the field and publish again to remove it.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Setting up a multi-session course with calendar recurrence</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>2 — When &amp; Where</strong> tab.</li>
              <li>Set <strong>Start Date &amp; Time</strong> to the first session.</li>
              <li>Set <strong>Repeats</strong> — e.g., Weekly.</li>
              <li>Set <strong>Every</strong> to 1 (every week) or 2 (every other week).</li>
              <li>If Weekly, check the appropriate days under <strong>On Days</strong>.</li>
              <li>Set <strong>Number of Sessions</strong> — total count including the first. An 8-week course = 8.</li>
              <li>Publish. The .ics calendar download will now include all sessions.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Hiding a program from the public listing</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>6 — Settings</strong> tab.</li>
              <li>Check <strong>Hide from Programs &amp; Events Listing</strong>.</li>
              <li>Publish. The program disappears from the listing but its page is still reachable by direct link.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Linking a program to an online course</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>3 — Registration</strong> tab.</li>
              <li>Click the <strong>Linked Courses</strong> field and search for the course by name.</li>
              <li>Select it and publish.</li>
              <li>From this point on, new registrants will automatically receive access to that course. Members who registered before this change will need access granted manually by an Admin from the member detail page.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Changing the display order of programs</h3>
            <ol className="man-steps">
              <li>Open each program you want to reorder → <strong>6 — Settings</strong> tab.</li>
              <li>Update the <strong>Sort Order</strong> number — lower numbers appear first.</li>
              <li>Publish each one.</li>
            </ol>
            <p className="man-task__note">Use round numbers (10, 20, 30) so you can insert a new program between two existing ones without renumbering.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Retiring or archiving a program</h3>
            <ol className="man-steps">
              <li>If the program should no longer be discoverable: open it → <strong>6 — Settings</strong> tab → check <strong>Hide from Programs &amp; Events Page</strong> → publish. The page still exists but won&rsquo;t be found by browsing.</li>
              <li>If registration should close: open it → <strong>3 — Registration</strong> tab → turn on <strong>Registration Closed</strong> → publish.</li>
              <li>If the program should be fully removed from the website: contact an Admin — deleting a published document in Sanity is a destructive action that should be done intentionally.</li>
            </ol>
          </div>
        </section>

        {/* ── Google Meet (integrated into Programs chapter) ── */}

        {/* ── Google Meet: overview ── */}
        <section id="google-meet" className="man-section man-section--divider">
          <h2 className="man-section__title">Setting up a Google Meet</h2>
          <p>
            Google Meet is the video platform RIM uses for all virtual programs — drop-in sittings, community groups, Foundations, and any other program that happens over video. It replaced Zoom because managing separate accounts and links outside of the website made it harder for volunteers to run sessions reliably, and meeting RIM&rsquo;s needs on Zoom would have required ongoing subscription costs.
          </p>
          <p>
            For most virtual programs, <strong>the Meet link is created automatically</strong> — you don&rsquo;t need to do anything extra. When you toggle on <strong>Virtual Program</strong> in Sanity Studio, set a <strong>Start Date &amp; Time</strong>, and publish the program, the system creates the Meet link, assigns a room account, and saves everything back to the program. The link appears in confirmation emails, reminder emails, and the Host Area — all without copy-pasting.
          </p>
          <p>
            The <strong>Meet Host team</strong> — the volunteers who hold the container of the session — check the <strong>Host Area</strong> at <code>/account/host</code> to find out which shared account to sign into. When they join from that account, they automatically have full host controls.
          </p>
        </section>

        {/* ── How it works ── */}
        <section id="meet-how-it-works" className="man-section">
          <h2 className="man-section__title">How it works</h2>
          <p>
            You don&rsquo;t need to understand all of this to use the system — but it helps to have a mental picture of what&rsquo;s happening behind the scenes, especially if something goes wrong.
          </p>

          <h3 className="man-section__h3">Virtual rooms</h3>
          <p>
            Think of it like a building with four identical meeting rooms, numbered 1–4. Each room is a shared Google account:
          </p>
          <ul className="man-list">
            <li><code>meet1@rootedinmindfulness.org</code></li>
            <li><code>meet2@rootedinmindfulness.org</code></li>
            <li><code>meet3@rootedinmindfulness.org</code></li>
            <li><code>meet4@rootedinmindfulness.org</code></li>
          </ul>
          <p>
            When you create a meeting for a program, the system checks which room is free at that time and assigns the program to it automatically. The assigned account is saved to the program and shown in the <strong>Host Area</strong> so the host team knows which one to use.
          </p>
          <p>
            This means multiple programs can run at the same time on the same night without any conflict — each gets its own room and its own link.
          </p>

          <h3 className="man-section__h3">How the host gets host controls</h3>
          <p>
            Whoever signs into the assigned room account and joins the meeting automatically becomes the meeting owner — with full host controls (blue shield, mute all, remove participant, end meeting). The host team checks the <strong>Host Area</strong> at <code>/account/host</code> before each session to find out which account is assigned to their program, signs into it as a secondary browser account, and joins from there.
          </p>
          <p>
            This is different from the way Zoom worked. There is no host key to share and no one needs to &ldquo;grant&rdquo; anything at session time — the account itself is the host.
          </p>
        </section>

        {/* ── Before you start ── */}
        <section id="meet-before" className="man-section">
          <h2 className="man-section__title">Before you start</h2>
          <p>
            Two things need to be set in Sanity Studio before you can create a Meet link:
          </p>
          <ul className="man-list">
            <li><strong>Format must be set to Virtual or Hybrid</strong> — this tells the system the program needs a Meet link.</li>
            <li><strong>Start Date &amp; Time must be set</strong> — the system uses it to check which meeting rooms are available.</li>
          </ul>
          <p>
            If either is missing, the Google Meet panel in the registrar area will show a notice rather than a button. Go to <strong>Sanity Studio → Programs → [program name] → 2 — When &amp; Where</strong> tab and fill in both fields, then publish.
          </p>
          <p>
            For recurring programs (e.g. every Wednesday evening), set the Start Date &amp; Time to the date of the <em>next</em> upcoming session. The Meet link itself doesn&rsquo;t expire — it works for all future sessions.
          </p>
        </section>

        {/* ── Creating a meeting ── */}
        <section id="meet-create" className="man-section">
          <h2 className="man-section__title">Creating a meeting</h2>

          <p>
            Meet links are created manually from the registrar area — there is no automatic creation. Once a link is set, it&rsquo;s stable for the life of the program.
          </p>
          <ol className="man-steps">
            <li>In Sanity Studio, open the program and go to the <strong>2 — When &amp; Where</strong> tab.</li>
            <li>Set <strong>Format</strong> to <strong>Virtual</strong> or <strong>Hybrid</strong>.</li>
            <li>Set a <strong>Start Date &amp; Time</strong> (required — the system needs it to check room availability).</li>
            <li>Publish the program.</li>
            <li>Go to <strong>/account/registrar</strong> and open the program.</li>
            <li>At the top, above the registrations table, you&rsquo;ll see the <strong>Google Meet</strong> panel.</li>
            <li>Click <strong>Create Google Meet</strong>.</li>
            <li>Wait a few seconds — the panel will show the Meet link and assigned room account when done.</li>
          </ol>
          <p>
            The link and assigned room account are saved to Sanity automatically. From that point forward, the link appears in reminder emails and on the Host Area page.
          </p>
          <p>
            <strong>Time changes:</strong> If you update the Start Date &amp; Time and republish, the calendar room booking updates automatically. The Meet link itself does not change.
          </p>

          <h3 className="man-section__h3">Removing a Meet (rescheduling or cancelling)</h3>
          <p>
            If a program is being rescheduled or cancelled, use the <strong>Remove Meet</strong> button in the Google Meet panel. This does two things in one step:
          </p>
          <ol className="man-steps">
            <li>Deletes the Google Calendar room booking, freeing the room account for other programs.</li>
            <li>Clears the Meet link, room account, and calendar event ID from the program in Sanity.</li>
          </ol>
          <p>
            After removing, update the date in Sanity and click <strong>Create Google Meet</strong> again when the new date is confirmed.
          </p>
          <div className="man-note man-note--warn">
            ⚠ Members who already received a confirmation email will have a link that no longer works. If the program is being rescheduled (not cancelled), send an update to registrants after the new link is set up.
          </div>
        </section>

        {/* ── What the host team does ── */}
        <section id="meet-volunteer" className="man-section">
          <h2 className="man-section__title">What the host team does</h2>
          <p>
            Once a Google Meet link exists for a program, the host team handles the rest. They don&rsquo;t need anything from you at session time — they have their own starting point at <code>/account/host</code>. But here&rsquo;s the overview in case you need to walk someone through it.
          </p>

          <h3 className="man-section__h3">Before the session</h3>
          <ol className="man-steps">
            <li>Go to <strong>/account/host</strong> (the Host Area).</li>
            <li>Find the program and note the <strong>host account</strong> listed — for example, <code>meet2@rootedinmindfulness.org</code>.</li>
            <li>Add that account to your browser as a secondary Google account — you don&rsquo;t need to log out of your own account. In Chrome: click your profile photo → <em>Add another account</em>.</li>
            <li>Click the <strong>Join on Google Meet</strong> link from the Host Area while signed in as that account.</li>
            <li>Join a few minutes before the session starts.</li>
          </ol>

          <h3 className="man-section__h3">During the session</h3>
          <p>
            When they join from the room account, they will see a small <strong>blue shield icon</strong> in the bottom-right area of the screen. This is the host controls indicator — it means they have full control of the meeting.
          </p>
          <p>
            As the host, they can:
          </p>
          <ul className="man-list">
            <li><strong>Mute anyone</strong> — hover over a participant and click the microphone icon, or use <em>Mute all</em> from the People panel</li>
            <li><strong>Remove a participant</strong> — hover over their name in the People panel and click the three-dot menu</li>
            <li><strong>End the meeting for everyone</strong> — click the red hang-up button and choose <em>End meeting for all</em></li>
          </ul>

          <h3 className="man-section__h3">After the session</h3>
          <p>
            After clicking <em>End meeting for all</em>, they switch back to their own Google account. The room account is now free for the next program that uses it.
          </p>

          <h3 className="man-section__h3">If they don&rsquo;t see the blue shield</h3>
          <p>
            This means they joined from their personal account rather than the room account. Remind them to check which account they are signed in as at the top-right of the Google Meet screen. If they need host controls urgently, any other volunteer in the meeting who has a <code>@rootedinmindfulness.org</code> account can grant them from the People panel: hover over their name → three-dot menu → <strong>Give host controls</strong>.
          </p>
        </section>

        {/* ── Where the link appears ── */}
        <section id="meet-link-appears" className="man-section">
          <h2 className="man-section__title">Where the link appears</h2>
          <p>
            Once a meeting link is saved to a program, it appears in one place for members and one place for the host team. You don&rsquo;t need to add it manually anywhere.
          </p>
          <table className="man-table man-table--perms">
            <thead>
              <tr>
                <th>Where</th>
                <th>Who sees it</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Member dashboard <code>/account/dashboard</code></td>
                <td>Logged-in members only</td>
                <td>Under &ldquo;Today&rsquo;s Sessions&rdquo; on the day of the program</td>
              </tr>
              <tr>
                <td>Host Area <code>/account/host</code></td>
                <td>HOST, REGISTRAR, and ADMIN roles</td>
                <td>Always visible once the link is created</td>
              </tr>
            </tbody>
          </table>
          <p>
            Confirmation and reminder emails direct members to their dashboard — the link itself is not included in emails. This keeps virtual sessions private and accessible to logged-in members only.
          </p>
          <div className="man-note">
            The <strong>Host Area</strong> at <code>/account/host</code> shows the same link alongside the room account to sign into. Members never see the room account; they only see the Join link on their dashboard.
          </div>
        </section>

        {/* ── If something goes wrong ── */}
        <section id="meet-issues" className="man-section">
          <h2 className="man-section__title">If something goes wrong</h2>

          <h3 className="man-section__h3">&ldquo;Add a Start Date &amp; Time in Sanity Studio first&rdquo;</h3>
          <p>
            The Google Meet panel is showing a notice instead of the button. This means the program doesn&rsquo;t have a scheduled time set. Go to <strong>Sanity Studio → Programs → [program] → 2 — When &amp; Where</strong> and fill in <strong>Start Date &amp; Time</strong>. Then come back to the registrar area and try again.
          </p>

          <h3 className="man-section__h3">&ldquo;All meeting rooms are booked at that time&rdquo;</h3>
          <p>
            All four virtual rooms are already in use during the requested time slot. This happens when four or more programs are scheduled at the same time. A few options:
          </p>
          <ul className="man-list">
            <li>Check whether the start times can be offset slightly so they don&rsquo;t overlap exactly.</li>
            <li>Ask a developer to add a fifth room account — it&rsquo;s a quick process.</li>
            <li>If the conflict is permanent (programs always overlap), adding a room is the right long-term solution.</li>
          </ul>

          <h3 className="man-section__h3">&ldquo;Meet created but Sanity write-back failed&rdquo;</h3>
          <p>
            The meeting was created successfully, but saving the link to the program in Sanity encountered a temporary error. The link is shown in the panel — copy it. Then go to <strong>Sanity Studio → Programs → [program] → 2 — When &amp; Where</strong>, paste it into the <strong>Meeting Link</strong> field, and publish. Contact a developer if this happens more than once.
          </p>

          <h3 className="man-section__h3">Something else went wrong</h3>
          <p>
            If the button shows a general error or nothing seems to happen, try refreshing the page and attempting again. If the problem persists, contact a developer and describe what the error message said.
          </p>
        </section>

        {/* ── Future editions ── */}
        <section className="man-future">
          <h2 className="man-future__title">Future editions of this manual</h2>
          <p className="man-future__intro">
            The following chapters are planned and will be added as each area of the system matures.
          </p>
          <ul className="man-future__list">
            <li>
              <strong>Member Accounts</strong> — how members sign in (magic link, no passwords), the onboarding flow, community agreements, account management, and what to do when someone can&rsquo;t get in.
            </li>
            <li>
              <strong>Courses &amp; Online Materials</strong> — the member-facing side: browsing the course library, accessing lessons and recordings, and how open courses differ from registration-required ones. (The admin side — granting and revoking access — is already covered in the <a href="#reg-course-access">Course access</a> section of Chapter 1.)
            </li>
          </ul>
        </section>

        {/* ════════════════════════════════════════
            CHAPTER 3 — MEMBER ACCOUNTS
            ════════════════════════════════════════ */}

        <div id="members" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Member Accounts</h1>
          <p className="man-chapter__subtitle">
            This chapter walks you through the member directory — how to find someone, what information you can see and edit, and how to keep things organized over time. You don&rsquo;t need any technical experience to use these tools.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="mem-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            Every person who has registered for a program, agreed to the community guidelines, or been added by a staff member has a member account. The member directory at <strong>/admin/members</strong> is where you can see all of them in one place, search for anyone by name or email, and open individual profiles to view or edit their information.
          </p>
          <p>
            Think of it like a contact book that lives alongside the registration system. When someone registers for a program, their account is created automatically — you rarely need to create one from scratch. What this area is mostly used for is <em>maintaining</em> those records over time: updating a phone number, noting that someone&rsquo;s situation has changed, or linking family members together.
          </p>
          <p>
            You need the <strong>Registrar</strong> or <strong>Admin</strong> role to access this area. Most tasks can be done by either role. A few things — like assigning volunteer roles or permanently deleting an account — require Admin.
          </p>
        </section>

        {/* ── The member list ── */}
        <section id="mem-list" className="man-section">
          <h2 className="man-section__title">The member list</h2>
          <p>
            When you go to <strong>/admin/members</strong>, you&rsquo;ll see a table of everyone in the system — their name, email address, status, any volunteer roles they hold, the number of programs they&rsquo;ve registered for, and the date they joined. Click any row to open that person&rsquo;s profile.
          </p>

          <h3 className="man-section__h3">Searching and filtering</h3>
          <p>
            The search bar at the top filters the list as you type. It searches across names, email addresses, and tags — so if you&rsquo;ve tagged someone &ldquo;scholarship&rdquo; and search for that word, they&rsquo;ll appear.
          </p>
          <p>
            You can also filter by:
          </p>
          <ul className="man-list">
            <li><strong>Role</strong> — show only Admins, Registrars, Hosts, or people with no role at all</li>
            <li><strong>Status</strong> — show only Active members, Visitors, Students, Volunteers, or Inactive members</li>
          </ul>
          <p>
            These filters work together, so you can search for &ldquo;sarah&rdquo; and filter by Visitor status at the same time.
          </p>

          <h3 className="man-section__h3">Sorting</h3>
          <p>
            Click any column header — First name, Last name, Email, Joined, or Regs — to sort by that field. Click it again to reverse the order. An arrow next to the column name shows the current sort direction.
          </p>

          <h3 className="man-section__h3">Archived members</h3>
          <p>
            Members whose status was set to <strong>Inactive</strong> don&rsquo;t appear in the regular list — they&rsquo;re tucked away so they don&rsquo;t clutter your view. If you need to find someone who has been deactivated, look for the <strong>Archived (N)</strong> button in the upper right of the list. Clicking it switches the view to show only those members. Click <strong>Show Active</strong> to go back.
          </p>
          <div className="man-note">
            The count only appears when there are archived members to show. If you don&rsquo;t see the button, nobody has been archived yet.
          </div>
        </section>

        {/* ── The member profile ── */}
        <section id="mem-profile" className="man-section">
          <h2 className="man-section__title">The member profile</h2>
          <p>
            Opening a member&rsquo;s profile takes you to a page where you can see and edit all of their information. Everything is organized into sections. When you&rsquo;ve made changes, scroll to the <strong>Save changes</strong> button — changes are only saved when you click it, not as you type.
          </p>

          <h3 className="man-section__h3">Profile — name and email</h3>
          <p>
            The top section holds their first name, last name, and a <strong>Preferred name</strong> field. Preferred name is for a nickname or the name they actually go by — for example, if their legal name is Katherine but they go by Kate, put Kate in the Preferred name field. The preferred name shows up in parentheses in the member list so you can always find them either way.
          </p>
          <p>
            Their email address is shown here too. Email is their login — be careful when changing it. If you update it, they&rsquo;ll be signed out immediately and will need to use the new address to log back in. A warning appears if you change this field so you don&rsquo;t do it accidentally.
          </p>

          <h3 className="man-section__h3">Contact — phone and address</h3>
          <p>
            This section holds their phone number and mailing address. These are optional — not every member will have them. If a member belongs to a household (see the Households section below), and they don&rsquo;t have their own address on file, a note will appear here letting you know that the household address will be used instead.
          </p>

          <h3 className="man-section__h3">Status — membership level and first visit</h3>
          <p>
            This is where you set their <strong>member status</strong> and, optionally, the date they first came to RIM. See the next section for a full explanation of what each status means.
          </p>
        </section>

        {/* ── Member status ── */}
        <section id="mem-status" className="man-section">
          <h2 className="man-section__title">Member status</h2>
          <p>
            Every member has a status that reflects their relationship with the community. Status affects what they can access — specifically, whether they can log in to the member area. Here&rsquo;s what each one means:
          </p>

          <table className="man-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>What it means</th>
                <th>Can log in?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Active</strong></td>
                <td>A regular community member — fully part of the community, with access to the member area</td>
                <td>✓ Yes</td>
              </tr>
              <tr>
                <td><strong>Visitor</strong></td>
                <td>Attending programs and exploring, but not yet a full community member</td>
                <td>✓ Yes</td>
              </tr>
              <tr>
                <td><strong>Student</strong></td>
                <td>Engaged in a particular learning track or training program</td>
                <td>✓ Yes</td>
              </tr>
              <tr>
                <td><strong>Volunteer</strong></td>
                <td>Contributing to the community in an ongoing volunteer capacity</td>
                <td>✓ Yes</td>
              </tr>
              <tr>
                <td><strong>Inactive</strong></td>
                <td>No longer actively participating — account is preserved but access is suspended</td>
                <td>✗ No</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: "16px" }}>
            The most important thing to know: <strong>Inactive is the only status that blocks login.</strong> All other statuses let the member sign in and use the member area normally. If you need to temporarily or permanently suspend someone&rsquo;s access, set them to Inactive and save. They will be signed out immediately.
          </p>

          <div className="man-note">
            Setting someone to Inactive is reversible. If you need to restore their access, simply change their status back to Active (or whichever status fits) and save.
          </div>

          <h3 className="man-section__h3">First visit date</h3>
          <p>
            Next to the status field is a <strong>First visit date</strong> field. This is just a record-keeping field — it does nothing to access or permissions. It&rsquo;s useful for knowing when someone first came to RIM, especially for members who have been around for years before the digital system existed.
          </p>
        </section>

        {/* ── Tags ── */}
        <section id="mem-tags" className="man-section">
          <h2 className="man-section__title">Tags</h2>
          <p>
            Tags are short labels you can attach to a member&rsquo;s profile. They&rsquo;re flexible — you decide what they mean. Some ideas for how to use them:
          </p>
          <ul className="man-list">
            <li>Mark someone as <strong>scholarship</strong> so you can filter for that group easily</li>
            <li>Note <strong>newsletter</strong> for people who&rsquo;ve asked to be added to a mailing list</li>
            <li>Track <strong>dsg</strong> for Dharma Study Group participants</li>
            <li>Flag <strong>follow-up</strong> as a reminder to check in with someone</li>
          </ul>
          <p>
            Tags are searchable from the member list — type a tag word in the search bar and anyone with that tag will appear.
          </p>

          <h3 className="man-section__h3">How to add a tag</h3>
          <ol className="man-steps">
            <li>Open the member&rsquo;s profile.</li>
            <li>Scroll to the <strong>Tags</strong> section.</li>
            <li>Click in the tag input field and type a word.</li>
            <li>Press <strong>Enter</strong> or <strong>comma</strong> to add it. It becomes a small blue-green chip.</li>
            <li>Add as many as you like. To remove one, click the &times; on the chip or press Backspace when the input is empty.</li>
            <li>Click <strong>Save changes</strong> when done.</li>
          </ol>
          <div className="man-note">
            Tags are shared — they&rsquo;re visible to all Registrars and Admins, not just the person who added them. Keep them brief and professional.
          </div>
        </section>

        {/* ── Admin notes ── */}
        <section id="mem-notes" className="man-section">
          <h2 className="man-section__title">Admin notes</h2>
          <p>
            The <strong>Admin notes</strong> field is a private text area for internal notes about a member. It is only visible to people with the Admin role — Registrars cannot see it, and the member themselves will never see it.
          </p>
          <p>
            Use it for anything you need to remember that doesn&rsquo;t fit anywhere else: context about a sensitive situation, a note from a conversation, something to be aware of when interacting with this person. Think of it like a sticky note attached to their file.
          </p>
          <div className="man-note man-note--warn">
            Admin notes are private, but they are still part of the system. Write them as you would anything in a shared organizational record — thoughtfully and professionally.
          </div>
        </section>

        {/* ── Households ── */}
        <section id="mem-households" className="man-section">
          <h2 className="man-section__title">Households</h2>
          <p>
            Many people come to RIM as part of a family — partners, parents and children, or others who live together. The <strong>Households</strong> feature lets you group those members together so you can see their connection at a glance, share an address across the group, and note how each person relates to the others.
          </p>
          <p>
            Grouping people into a household doesn&rsquo;t change what they can access or how registration works. It&rsquo;s purely organizational — a way of keeping the community picture clear as membership grows.
          </p>

          <h3 className="man-section__h3">The household section on a member&rsquo;s profile</h3>
          <p>
            Scroll down to the <strong>Household</strong> section on any member&rsquo;s profile. If they&rsquo;re already in a household, you&rsquo;ll see a card showing the household name, any household address on file, their relationship label, and the other members in the group. If they&rsquo;re not in one, you&rsquo;ll see two buttons: <strong>Create new household</strong> and <strong>Add to existing household</strong>.
          </p>

          <h3 className="man-section__h3">Creating a new household</h3>
          <ol className="man-steps">
            <li>Open the profile of any member who will be in the household.</li>
            <li>Scroll to the <strong>Household</strong> section and click <strong>Create new household</strong>.</li>
            <li>Give the household a name if you like — for example, &ldquo;The Garcia Family.&rdquo; This is optional.</li>
            <li>Choose a relationship label for this person — Spouse, Partner, Parent, Child, Sibling, or Other. If you choose Other, you can type in a description (like &ldquo;guardian&rdquo;).</li>
            <li>Click <strong>Create household</strong>. The household is created and this person is added as the primary contact.</li>
          </ol>
          <p>
            Once the household exists, you can add other members to it from their own profile pages — or from the household detail page at <strong>/admin/households</strong>.
          </p>

          <h3 className="man-section__h3">Adding a member to an existing household</h3>
          <ol className="man-steps">
            <li>Open the profile of the person you want to add.</li>
            <li>Scroll to the <strong>Household</strong> section and click <strong>Add to existing household</strong>.</li>
            <li>Search for another member who is already in the household you want to join. The system will find their household for you.</li>
            <li>Choose a relationship label for this person.</li>
            <li>Click <strong>Join household</strong>.</li>
          </ol>
          <div className="man-note">
            Each person can only belong to one household at a time. If you try to add someone who is already in a different household, the system will tell you and ask you to remove them from the first one before adding them to the new one.
          </div>

          <h3 className="man-section__h3">The primary contact</h3>
          <p>
            Every household has a <strong>primary contact</strong> — the person to reach out to on behalf of the group. The first member added is automatically set as primary, but you can change this at any time. On the household detail page, each member row has a <strong>Set primary</strong> button. Setting a new primary contact automatically removes the designation from whoever had it before.
          </p>

          <h3 className="man-section__h3">The household address</h3>
          <p>
            You can add a shared address to the household itself (rather than to each person individually) from the household detail page. If a member has no personal address on their own profile, their household&rsquo;s address will be used instead. When this is happening, a small note appears in their Contact section: &ldquo;No individual address — household address will be used.&rdquo;
          </p>

          <h3 className="man-section__h3">The household directory</h3>
          <p>
            You can see all households at <strong>/admin/households</strong>. Each row shows the household name, the primary contact, the total number of members, and a summary of their shared address. Click any household to open its detail page, where you can edit the name, address, notes, manage members, and (if you have Admin access) delete the household.
          </p>
          <p>
            At the bottom of the households page, there&rsquo;s a small table showing any custom relationship labels that have been used (the ones typed in when &ldquo;Other&rdquo; is selected). This is just for reference — it helps identify whether any custom label is common enough to be worth adding as a standard option in the future.
          </p>

          <h3 className="man-section__h3">Removing someone from a household</h3>
          <p>
            On a member&rsquo;s profile, scroll to the Household card and click <strong>Remove from household</strong>. This removes just that person — it does not delete the household or affect the other members in it. Their profile will then show the &ldquo;no household&rdquo; state, and you can add them to a different household if needed.
          </p>
        </section>

        {/* ── Common tasks ── */}
        <section id="mem-tasks" className="man-section">
          <h2 className="man-section__title">Common tasks</h2>

          <h3 className="man-section__h3">Updating a member&rsquo;s status</h3>
          <ol className="man-steps">
            <li>Go to <strong>/admin/members</strong> and search for the person.</li>
            <li>Click their name to open their profile.</li>
            <li>Scroll to the <strong>Status</strong> section.</li>
            <li>Use the dropdown to choose the new status.</li>
            <li>Click <strong>Save changes</strong>.</li>
          </ol>
          <p>
            If you set status to <strong>Inactive</strong>, they will be signed out immediately and will no longer be able to log in. A warning appears in the form to remind you of this before you save.
          </p>

          <h3 className="man-section__h3">Updating contact information</h3>
          <ol className="man-steps">
            <li>Open the member&rsquo;s profile.</li>
            <li>Scroll to <strong>Contact</strong>.</li>
            <li>Update the phone number or address fields as needed.</li>
            <li>Click <strong>Save changes</strong>.</li>
          </ol>

          <h3 className="man-section__h3">Adding a tag to a member</h3>
          <ol className="man-steps">
            <li>Open the member&rsquo;s profile and scroll to <strong>Tags</strong>.</li>
            <li>Click in the input field, type the tag word, and press Enter.</li>
            <li>Click <strong>Save changes</strong>.</li>
          </ol>

          <h3 className="man-section__h3">Grouping two members into a household</h3>
          <ol className="man-steps">
            <li>Open the profile of one of the members.</li>
            <li>Scroll to <strong>Household</strong> and click <strong>Create new household</strong>.</li>
            <li>Give the household a name (optional), choose a relationship, and click <strong>Create household</strong>.</li>
            <li>Now open the second member&rsquo;s profile.</li>
            <li>Scroll to <strong>Household</strong> and click <strong>Add to existing household</strong>.</li>
            <li>Search for the first member&rsquo;s name, select them, choose a relationship, and click <strong>Join household</strong>.</li>
          </ol>

          <h3 className="man-section__h3">Looking up a member&rsquo;s registration history</h3>
          <ol className="man-steps">
            <li>Open the member&rsquo;s profile.</li>
            <li>Scroll to the bottom — there&rsquo;s a <strong>Registration History</strong> section showing every program they&rsquo;ve registered for, with the status of each one.</li>
          </ol>

          <h3 className="man-section__h3">Updating a member&rsquo;s preferred name</h3>
          <ol className="man-steps">
            <li>Open the member&rsquo;s profile.</li>
            <li>In the <strong>Profile</strong> section, find the <strong>Preferred name</strong> field.</li>
            <li>Enter the name they go by.</li>
            <li>Click <strong>Save changes</strong>. It will appear in parentheses in the member list.</li>
          </ol>
        </section>

        {/* ════════════════════════════════════════
            CHAPTER 4 — VOLUNTEER ROLES
            ════════════════════════════════════════ */}

        <div id="roles" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Volunteer Roles</h1>
          <p className="man-chapter__subtitle">
            This chapter covers volunteer roles — what each one unlocks, how to grant and remove access, and how to get a new volunteer set up from scratch.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="roles-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            Every member of the RIM community who logs in has a basic account. By default, accounts have no special access — they can only see their own dashboard, registrations, and courses.
          </p>
          <p>
            Volunteer access is granted by assigning one or more <strong>roles</strong> to a member&rsquo;s account. There are currently three roles: <strong>Meet Host</strong>, <strong>Registrar</strong>, and <strong>Admin</strong>. A person can hold more than one — having multiple roles gives them everything each role includes.
          </p>
          <p>
            Roles take effect immediately. As soon as you save a role change, the next page the member loads will reflect their new access. No re-login is required (though if they are logged in, they may need to reload the page).
          </p>
        </section>

        {/* ── The two roles ── */}
        <section id="roles-two-roles" className="man-section">
          <h2 className="man-section__title">Volunteer roles</h2>

          <h3 className="man-section__h3">Meet Host</h3>
          <p>
            A Meet Host is a volunteer who helps hold virtual programs by hosting the Google Meet session. This is the host team — the people trained to care for the container of a virtual sitting, group, or program.
          </p>
          <p>What a Meet Host can do:</p>
          <ul className="man-list">
            <li>View the <strong>Host Area</strong> at <strong>/account/host</strong> — a list of all virtual programs with the room account to sign into for each session</li>
            <li>Access the <strong>Volunteer Manual</strong></li>
          </ul>
          <p>
            Meet Hosts do not have access to registration management or member data — only the host area and its information.
          </p>

          <h3 className="man-section__h3">Registrar</h3>
          <p>
            A Registrar manages day-to-day program registrations. This role is intended for the person (or people) handling waitlists, sending reminders, promoting members, and keeping registration lists accurate.
          </p>
          <p>What a Registrar can do:</p>
          <ul className="man-list">
            <li>View and manage all program registrations at <strong>/account/registrar</strong></li>
            <li>Promote waitlisted members, cancel and restore registrations</li>
            <li>Send edit-request links and reminder emails to registrants</li>
            <li>View and edit member profiles at <strong>/admin/members</strong> — name, email, phone</li>
            <li>Grant or revoke course access for individual members</li>
            <li>Access <strong>Sanity Studio</strong> — create and edit programs, lessons, and other site content (if invited — see below)</li>
          </ul>
          <p>What a Registrar <em>cannot</em> do:</p>
          <ul className="man-list">
            <li>Assign or remove roles</li>
            <li>Archive, restore, or delete member accounts</li>
            <li>Import members from CSV</li>
          </ul>

          <h3 className="man-section__h3">Admin</h3>
          <p>
            An Admin has full access to the entire volunteer area. This role is for the person (or people) responsible for the health of the system — managing member accounts, overseeing access, and handling anything a Registrar cannot.
          </p>
          <p>What an Admin can do (in addition to everything a Registrar can do):</p>
          <ul className="man-list">
            <li>View all member accounts at <strong>/admin/members</strong></li>
            <li>Edit member profiles — name, email, phone</li>
            <li>Assign and remove roles</li>
            <li>Invite members to Sanity Studio or revoke their Sanity access</li>
            <li>Archive, restore, and delete member accounts</li>
            <li>Grant or revoke course access manually</li>
            <li>Import members from CSV</li>
          </ul>

          <h3 className="man-section__h3">Dashboard shortcuts per role</h3>
          <p>
            When a member with a volunteer role logs in, a <strong>Volunteer Access</strong> panel appears on their dashboard. The links in that panel depend on their role:
          </p>
          <table className="man-table man-table--perms">
            <thead>
              <tr>
                <th>Link</th>
                <th>Host</th>
                <th>Registrar</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Host Area <code>/account/host</code></td>
                <td>✓</td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Registrations <code>/account/registrar</code></td>
                <td></td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Members <code>/admin/members</code></td>
                <td></td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Sanity Studio (external)</td>
                <td></td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Volunteer Manual <code>/admin/manual</code></td>
                <td>✓</td>
                <td>✓</td>
                <td>✓</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── Assigning a role ── */}
        <section id="roles-assigning" className="man-section">
          <h2 className="man-section__title">Assigning a role</h2>
          <p>
            You must have the <strong>Admin</strong> role to assign roles. If you need to grant access to someone who doesn&rsquo;t yet have an account, they need to sign in at least once (via magic link) before you can assign a role to them.
          </p>
          <ol className="man-steps">
            <li>Go to <strong>/admin/members</strong>.</li>
            <li>Search for the person by name or email.</li>
            <li>Click their name to open their member detail page.</li>
            <li>Scroll to the <strong>Roles</strong> section. You&rsquo;ll see checkboxes for each available role.</li>
            <li>Check the role(s) you want to assign.</li>
            <li>Click <strong>Save changes</strong>.</li>
          </ol>
          <p>
            The role takes effect immediately. If the person is currently logged in, they may need to reload the page to see their updated dashboard.
          </p>
          <div className="man-note">
            Assigning the <strong>Meet Host</strong> or <strong>Registrar</strong> role triggers an automatic notification email. Assigning Registrar also causes a <strong>Sanity Studio Access</strong> panel to appear on their member detail page. See the sections below.
          </div>
        </section>

        {/* ── Notification email ── */}
        <section id="roles-notifying" className="man-section">
          <h2 className="man-section__title">Notification email</h2>
          <p>
            When you assign someone the <strong>Meet Host</strong> or <strong>Registrar</strong> role and save, they automatically receive a notification email from Rooted In Mindfulness. The email tells them what the role means, links them to the relevant area of the site, and points them to this manual.
          </p>
          <p>
            You don&rsquo;t need to do anything extra — no need to manually forward instructions or copy a URL. The email goes out the moment you save.
          </p>
          <p>
            A few things to know:
          </p>
          <ul className="man-list">
            <li>Each notification fires exactly once, when the role is <em>first</em> added. It does not re-send if you save their record again with the role already checked.</li>
            <li>The <strong>Meet Host</strong> email links to the Host Area at <strong>/account/host</strong> and to this manual.</li>
            <li>The <strong>Registrar</strong> email links to the volunteer dashboard at <strong>/account/registrar</strong> and to this manual. It does <em>not</em> include Sanity Studio instructions — that&rsquo;s a separate step with its own invite.</li>
            <li>No notification is sent when the Admin role is assigned. Admins are typically people already deeply involved in the organization — a quiet system-level change is appropriate.</li>
          </ul>
        </section>

        {/* ── Sanity Studio access ── */}
        <section id="roles-sanity" className="man-section">
          <h2 className="man-section__title">Sanity Studio access</h2>
          <p>
            <strong>Sanity Studio</strong> is the content management system where programs, lessons, and site content are created and edited. Access to Sanity is separate from the RIM website — it requires its own invitation through Sanity&rsquo;s system.
          </p>
          <p>
            Not every Registrar needs Sanity access. A Registrar whose job is managing registrations (promoting waitlisted members, sending reminders) doesn&rsquo;t need to edit site content. Sanity access is for people who <em>create and maintain programs and pages</em>.
          </p>

          <h3 className="man-section__h3">Sending a Sanity invitation</h3>
          <ol className="man-steps">
            <li>Make sure the person has the <strong>Registrar</strong> role saved on their account. The Sanity panel only appears after that role is persisted.</li>
            <li>On their member detail page, scroll past the Roles section to find <strong>Sanity Studio Access</strong>.</li>
            <li>Click <strong>Invite to Sanity Studio</strong>. A confirmation dialog will explain what access they&rsquo;ll receive.</li>
            <li>Confirm the invite. An invitation email arrives in their inbox from <code>no-reply@sanity.io</code>.</li>
            <li>They click the link in that email to accept and create a Sanity account (or log in with an existing one).</li>
            <li>Once accepted, they can access <a href="https://rooted-in-mindfulness.sanity.studio/" target="_blank" rel="noopener noreferrer">rooted-in-mindfulness.sanity.studio</a> with Editor-level access.</li>
          </ol>

          <h3 className="man-section__h3">What &ldquo;Editor&rdquo; access means in Sanity</h3>
          <p>
            Editor access lets them create, edit, and publish all content types — programs, lessons, teacher profiles, and anything else in the Studio. They cannot change project settings, manage billing, or invite others to Sanity (only the Sanity project owner can do those things).
          </p>

          <h3 className="man-section__h3">If they don&rsquo;t receive the invite</h3>
          <ul className="man-list">
            <li>Ask them to check their spam folder for an email from <code>no-reply@sanity.io</code>.</li>
            <li>If the invite has expired (they are valid for a limited time), you can send a new one from the member detail page — the button resets after a revocation/re-invite cycle.</li>
            <li>If the email address on their RIM account doesn&rsquo;t match their preferred Sanity email, that&rsquo;s a known limitation — Sanity invites are sent to the address on file. Contact a developer if this becomes an issue.</li>
          </ul>
        </section>

        {/* ── Removing a role ── */}
        <section id="roles-removing" className="man-section">
          <h2 className="man-section__title">Removing a role</h2>
          <p>
            To remove a role, uncheck it on their member detail page and click <strong>Save changes</strong>.
          </p>

          <h3 className="man-section__h3">When Sanity access is involved</h3>
          <p>
            If you uncheck <strong>Registrar</strong> for someone who was previously invited to Sanity Studio, a warning appears in the save bar before you confirm:
          </p>
          <div className="man-note man-note--warn">
            ⚠ Saving will also revoke this member&rsquo;s Sanity Studio access.
          </div>
          <p>
            If you save, two things happen automatically:
          </p>
          <ul className="man-list">
            <li>Any <em>pending</em> Sanity invitation (not yet accepted) is cancelled.</li>
            <li>If they already accepted and have an active Sanity account, they are removed from the project and can no longer access Sanity Studio.</li>
          </ul>
          <p>
            This is immediate and cannot be undone through the website. If you need to restore their Sanity access, re-assign the Registrar role and send a new invitation.
          </p>

          <h3 className="man-section__h3">Removing Admin access</h3>
          <p>
            Removing the Admin role works the same way — uncheck it and save. Be careful not to remove the Admin role from every Admin account at once, as that would leave no one able to manage roles. The system does not prevent this.
          </p>
        </section>

        {/* ── First Admin setup ── */}
        <section id="roles-bootstrap" className="man-section">
          <h2 className="man-section__title">First Admin setup</h2>
          <p>
            The Admin role cannot be assigned through the website&rsquo;s UI unless someone already has Admin. For the very first Admin — or to recover from a situation where no admins remain — you&rsquo;ll need to update the database directly.
          </p>
          <p>
            This is done through the <strong>Neon console</strong> (the database provider). A developer or technically confident person with access to the Neon project can run this SQL query in the Neon SQL editor:
          </p>
          <pre className="man-code">{`UPDATE "User" SET roles = '{ADMIN}' WHERE email = 'person@example.com';`}</pre>
          <p>
            Replace <code>person@example.com</code> with the email address of the account to promote. The change takes effect immediately — the person can log in and will have full Admin access.
          </p>
          <div className="man-note">
            The person must already have an account (they must have signed in at least once) for this to work. If they haven&rsquo;t signed in yet, have them use the magic link login first, then run the query.
          </div>
          <p>
            After the first Admin is set up via SQL, all future role assignments can be done through the website as described above.
          </p>
        </section>

      </main>
    </div>
  );
}
