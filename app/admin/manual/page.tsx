import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Staff Manual — Rooted In Mindfulness" };

export default async function ManualPage() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN", "REGISTRAR"].includes(r))) {
    redirect("/login");
  }

  return (
    <div className="man-layout">

      {/* ── Sidebar ── */}
      <nav className="man-sidebar">
        <p className="man-sidebar__heading">Staff Manual</p>
        <ul className="man-sidebar__list">

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
              <li><a href="#prog-content"   className="man-sidebar__sublink">Content tab</a></li>
              <li><a href="#prog-schedule"  className="man-sidebar__sublink">Schedule &amp; Location tab</a></li>
              <li><a href="#prog-reg-tab"   className="man-sidebar__sublink">Registration tab</a></li>
              <li><a href="#prog-dana-tab"  className="man-sidebar__sublink">Dana &amp; Payment tab</a></li>
              <li><a href="#prog-dashboard" className="man-sidebar__sublink">Dashboard tab</a></li>
              <li><a href="#prog-sorting"   className="man-sidebar__sublink">Sorting &amp; Visibility tab</a></li>
              <li><a href="#prog-tasks"     className="man-sidebar__sublink">Common tasks</a></li>
            </ul>
          </li>

          <li className="man-sidebar__soon-group">
            <span className="man-sidebar__link man-sidebar__link--soon">Member Accounts</span>
            <span className="man-soon-badge">Coming soon</span>
          </li>
          <li className="man-sidebar__soon-group">
            <span className="man-sidebar__link man-sidebar__link--soon">Courses &amp; Materials</span>
            <span className="man-soon-badge">Coming soon</span>
          </li>
          <li>
            <a href="#google-meet" className="man-sidebar__link">Google Meet</a>
            <ul className="man-sidebar__sub">
              <li><a href="#meet-overview"      className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#meet-how-it-works"  className="man-sidebar__sublink">How it works</a></li>
              <li><a href="#meet-before"        className="man-sidebar__sublink">Before you start</a></li>
              <li><a href="#meet-create"        className="man-sidebar__sublink">Creating a meeting</a></li>
              <li><a href="#meet-volunteer"     className="man-sidebar__sublink">What the volunteer does</a></li>
              <li><a href="#meet-link-appears"  className="man-sidebar__sublink">Where the link appears</a></li>
              <li><a href="#meet-issues"        className="man-sidebar__sublink">If something goes wrong</a></li>
            </ul>
          </li>
          <li>
            <a href="#roles" className="man-sidebar__link">Staff &amp; Roles</a>
            <ul className="man-sidebar__sub">
              <li><a href="#roles-overview"   className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#roles-two-roles"  className="man-sidebar__sublink">The two roles</a></li>
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
            CHAPTER 1 — REGISTRATION
            ════════════════════════════════════════ */}

        <div id="registration" className="man-chapter">
          <h1 className="man-chapter__title">Registration</h1>
          <p className="man-chapter__subtitle">
            This chapter walks you through the registration system — what members see when they sign up, what you see as a registrar, and how to handle every situation that comes up.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="reg-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            Registration is the process by which someone claims a spot in a program. When a program has registration enabled, a <strong>Register →</strong> button appears on the program&rsquo;s page. Members and guests fill out a short form — name, email, any custom questions the program requires — and their spot is confirmed instantly.
          </p>
          <p>
            The registration system is built into this website. There is no third-party form tool to manage. Everything lives in one place: the registrar area at <strong>/volunteer</strong>.
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
            Members can see all their registrations — status, dana status, and staff notes — at <strong>/account/dashboard-my-registrations</strong> (linked as &ldquo;My Programs&rdquo; in the navigation). If they have a pending dana offering, their dashboard homepage shows a reminder card with a link to complete it. The card disappears once dana is received.
          </p>
          <h3 className="man-section__h3">Self-cancellation</h3>
          <p>
            Members can cancel their own spot directly from <strong>My Programs</strong> — they don&rsquo;t need to contact you. Each active registration has a small <strong>Cancel registration</strong> link at the bottom of the card. Clicking it shows a confirmation step — &ldquo;Cancel your spot? This cannot be undone.&rdquo; — so accidental taps aren&rsquo;t possible. Once cancelled, the card updates immediately to show &ldquo;✓ Registration cancelled.&rdquo;
          </p>
          <p>
            When a member cancels, you receive a cancellation notification email at the registrar inbox (the same email you get when you cancel someone from the table). The member does not receive an automatic email. The waitlist does not auto-promote — you check <strong>/volunteer</strong> and promote who you choose.
          </p>
        </section>

        {/* ── Your tools ── */}
        <section id="reg-your-tools" className="man-section">
          <h2 className="man-section__title">Your tools</h2>

          <h3 className="man-section__h3">The program list — /volunteer</h3>
          <p>
            Your workspace starts at <strong>/volunteer</strong>. This page shows all programs that have registration enabled, in sort order.
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

          <h3 className="man-section__h3">The registrar table — /volunteer/programs/[slug]</h3>
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
            <li>Add or edit a private staff note (visible only to staff — never sent to the member)</li>
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
              <p>Like Registered, but set manually by a registrar. Use this to distinguish staff-approved participants from self-registered ones — for example, programs with an application process. Both count toward capacity.</p>
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
              <li>Go to the <strong>Schedule &amp; Location</strong> tab and set the <strong>Start Date &amp; Time</strong> so members get calendar links.</li>
              <li>Publish. The Register button appears on the program page immediately.</li>
            </ol>
            <p className="man-task__note">If you don&rsquo;t have Sanity Studio access, ask your program coordinator to do this step.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Promoting someone from the waitlist</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong>. If a spot has opened, you&rsquo;ll see a green <strong>&ldquo;↑ Spot open&rdquo;</strong> badge on the program card — click it.</li>
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
            <p className="man-task__note">Members can also cancel themselves from their <strong>My Programs</strong> page. When they do, you receive the same notification email. Either way, you check <strong>/volunteer</strong> and decide whether to promote someone from the waitlist.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a reminder email</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
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
              <li>Notes are visible only to staff — never sent to the member or shown anywhere public.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Exporting the registration list</h3>
            <ol className="man-steps">
              <li>Open the program in <strong>/volunteer</strong> and click <strong>Export CSV</strong>.</li>
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
            <p>Members can cancel from their <strong>My Programs</strong> page without contacting you. When they do, you receive a cancellation notification email. If the program has capacity set and people on the waitlist, the <strong>/volunteer</strong> index card shows a green <strong>&ldquo;↑ Spot open&rdquo;</strong> badge. Open the program — the &ldquo;A spot has opened&rdquo; banner tells you how many people are waiting — then promote who you choose.</p>
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
            This chapter covers every tab and field in Sanity Studio so you can set up a program from scratch, edit a live one, or close registration when you&rsquo;re ready.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="prog-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            All content on the website — programs, courses, teacher bios, and more — is managed through <strong>Sanity Studio</strong>, a separate content editor at <a href="https://rooted-in-mindfulness.sanity.studio/" target="_blank" rel="noopener noreferrer">rooted-in-mindfulness.sanity.studio</a>. You can also reach it from the Sanity Studio card on your staff dashboard.
          </p>
          <p>
            When you save and publish a program in Sanity, it appears on the website within seconds. There is no separate &ldquo;send to website&rdquo; step — publishing is it.
          </p>
          <div className="man-note">
            <strong>Drafts vs. published:</strong> Every document in Sanity starts as a draft. Drafts are only visible to you inside Sanity — they do not appear on the website. Click <strong>Publish</strong> to make it live. If you edit a published document, your changes are saved as a draft until you publish again. You can work on a draft for as long as you need before publishing. There is no risk of showing a half-finished program to members while you are working on it.
          </div>
        </section>

        {/* ── Who does this ── */}
        <section id="prog-role" className="man-section">
          <h2 className="man-section__title">Who does this</h2>
          <p>
            Creating and managing programs is a <strong>Registrar</strong> task. In the current system, the Registrar role is really a <em>program coordinator</em> role — the same person who sets up a program in Sanity also manages who registers for it through <strong>/volunteer</strong>. At RIM&rsquo;s current scale, one person handling both makes sense.
          </p>
          <p>
            To access Sanity Studio, a Registrar needs an invitation email from an Admin. Once accepted, you&rsquo;ll have an editor-level account in Sanity. Your dashboard shows a <strong>Sanity Studio</strong> card once this access is set up.
          </p>
          <div className="man-note">
            <strong>If roles are ever split:</strong> If RIM grows to the point where a dedicated content or communications person manages the website separately from the person handling day-to-day registration logistics, these can become two distinct roles. The system supports that — it would require a new role type and a separate Sanity access path. Until then, the Registrar role covers both.
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
                <td>Content</td>
                <td>The public-facing page: name, description, image, pull quote, and any linked online courses.</td>
              </tr>
              <tr>
                <td>Schedule &amp; Location</td>
                <td>Dates, times, teachers, location, meeting link, calendar links (Start Date &amp; Time), and recurrence for multi-session programs.</td>
              </tr>
              <tr>
                <td>Registration</td>
                <td>Turns the registration form on, sets capacity, custom questions, and the confirmation email message.</td>
              </tr>
              <tr>
                <td>Dana &amp; Payment</td>
                <td>Controls whether and how payments are collected during registration.</td>
              </tr>
              <tr>
                <td>Dashboard</td>
                <td>Controls how the program appears on the member dashboard, including time-sensitive announcements.</td>
              </tr>
              <tr>
                <td>Sorting &amp; Visibility</td>
                <td>Controls where the program appears in the public listings and in what order.</td>
              </tr>
            </tbody>
          </table>

          <div className="man-note">
            <strong>Minimum to maximum:</strong><br />
            <strong>Page exists (but not public):</strong> Name + Slug + Publish.<br />
            <strong>Appears in public listing:</strong> + Category (required).<br />
            <strong>Complete public page:</strong> + Tagline, Image, Description, Teachers, Date text.<br />
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
            <li>Enter the program <strong>Name</strong>. This is the only required field.</li>
            <li>Click <strong>Generate</strong> next to the Slug field to create the URL from the name. The slug becomes the URL path: a program called &ldquo;Morning Sitting&rdquo; gets the URL <code>/programs/morning-sitting</code>.</li>
            <li>Fill in the tabs one at a time. You do not need to complete everything before publishing — you can publish a minimal program and add to it over time.</li>
            <li>When ready for the program to appear on the website, click <strong>Publish</strong>.</li>
          </ol>
          <div className="man-note">
            <strong>Do not change the slug after publishing.</strong> The slug is the program&rsquo;s permanent URL. If you change it after people have bookmarked the page or received it in emails, those links will break. You can freely change the Name — only the slug affects URLs. If you must change a slug, contact an admin — a redirect can be set up to catch old links.
          </div>
        </section>

        {/* ── Content tab ── */}
        <section id="prog-content" className="man-section">
          <h2 className="man-section__title">Content tab</h2>
          <p>
            The Content tab is what members read on the program&rsquo;s page. It covers the description, image, pull quote, and whether this program grants access to any online courses.
          </p>

          <div className="man-field-list">
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
              <div className="man-field__name">Linked Courses</div>
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

        {/* ── Schedule & Location tab ── */}
        <section id="prog-schedule" className="man-section">
          <h2 className="man-section__title">Schedule &amp; Location tab</h2>
          <p>
            This tab controls dates, times, teachers, location, and the meeting link. It also controls what calendar events members receive and whether the program appears in the public listing.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Program Category</div>
              <div className="man-field__desc">
                <p><strong>Required for the program to appear on the public Programs &amp; Events listing page.</strong> Click and start typing to search, or press Backspace to see all categories. Categories include things like Meditation, Retreats, Classes.</p>
                <p>If no existing category fits, ask an Admin to create a new one in Sanity → Program Categories. If this field is left blank, the program page still exists and is accessible by direct link — it just won&rsquo;t appear in the listings.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Teacher / Facilitator(s)</div>
              <div className="man-field__desc">
                <p>Choose one or more teachers from the Team list. Their names and photos appear on the program page. If a teacher isn&rsquo;t in the list yet, ask an Admin to add them in Sanity → Team.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Date</div>
              <div className="man-field__desc">
                <p>The human-readable date shown on the program page and listing cards. Write it exactly as you want it displayed.</p>
                <p><em>Examples: Every Wednesday — June 7–9, 2025 — Ongoing — Fourth Sunday of each month</em></p>
                <p>This field is for display only. It does not affect calendar links or any automation.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Time</div>
              <div className="man-field__desc">
                <p>The human-readable time shown on the program page.</p>
                <p><em>Example: 7:00–8:30 PM CT</em></p>
                <p>Display only — not used for automation.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Start Date &amp; Time</div>
              <div className="man-field__desc">
                <p>The machine-readable date and time used to generate the <strong>Add-to-Calendar links</strong> in confirmation emails and on the program page. Use the date picker — enter the time as it will appear on your schedule (Central Time; Sanity handles the timezone).</p>
                <p>Leave blank for recurring or open-ended programs that don&rsquo;t need calendar links.</p>
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
              <div className="man-field__name">Listing Day &amp; Time</div>
              <div className="man-field__desc">
                <p>A very short version shown on listing cards only — for example: <em>Wednesdays, 7–8:30 PM</em>. One line. Leave blank and nothing appears on listing cards.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Location</div>
              <div className="man-field__desc">
                <p>The location name and/or address, shown on the program page and in reminder emails.</p>
                <p><em>Example: RIM Meditation Hall, 16905 W. Bluemound Rd., Brookfield, WI</em></p>
                <p>For online-only programs, you might write &ldquo;Online via Zoom&rdquo; or leave it blank.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Location Link</div>
              <div className="man-field__desc">
                <p>A Google Maps or website URL. When set, the location text on the program page becomes a clickable link. Paste the full URL including <code>https://</code>.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Meeting Link</div>
              <div className="man-field__desc">
                <p>A Zoom or Google Meet URL for online or hybrid programs. When set, a join button appears on the program page, and <strong>the link is automatically included in reminder emails</strong>.</p>
                <p>Set this field before you send reminders — if it&rsquo;s blank when the reminder goes out, members won&rsquo;t receive a join link in that email.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Meeting Button Text</div>
              <div className="man-field__desc">
                <p>The label on the join button — for example: <em>Join on Zoom</em> or <em>Join Google Meet</em>. Leave blank for generic text.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Registration tab ── */}
        <section id="prog-reg-tab" className="man-section">
          <h2 className="man-section__title">Registration tab</h2>
          <p>
            This tab is where registration is turned on and configured. The Registration chapter of this manual covers everything in more detail — here is a complete field reference.
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
                <p>On this date, the system automatically sends a reminder email to all confirmed registrants at 9:00 AM Central. Set it one or two days before the program starts. Goes to Registered and Approved only — not waitlisted members.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Reminder Email Message</div>
              <div className="man-field__desc">
                <p>The custom message in the reminder email — directions, what to bring, the meeting link (also included automatically if set), a warm note. If left blank, the reminder still goes out with standard program details.</p>
                <p>The meeting link from the Schedule &amp; Location tab is automatically appended — make sure that field is set before this reminder date arrives.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Dana & Payment tab ── */}
        <section id="prog-dana-tab" className="man-section">
          <h2 className="man-section__title">Dana &amp; Payment tab</h2>
          <p>
            This tab controls whether and how dana (financial offerings) are collected during registration. See the Dana section in the Registration chapter for a full explanation of how each mode works in practice.
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

        {/* ── Dashboard tab ── */}
        <section id="prog-dashboard" className="man-section">
          <h2 className="man-section__title">Dashboard tab</h2>
          <p>
            This tab controls how the program appears on the <strong>member dashboard</strong> — the page members see when they log in. This is separate from the public program page.
          </p>
          <p>
            Recurring programs like weekly sittings and ongoing classes appear on the dashboard as a persistent card so members can easily access the meeting link without re-registering each session. These settings let you add timely messages to those cards.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Special Announcement</div>
              <div className="man-field__desc">
                <p>A short message displayed in <strong>red</strong> on the program&rsquo;s dashboard card. Use this for urgent, time-sensitive changes — a room change, a guest teacher, a one-time cancellation.</p>
                <p><em>Example: Tonight&rsquo;s sitting is moved to Room B due to an event in the main hall.</em></p>
                <p><strong>Remember to clear it after the event passes</strong> — update the field to blank and republish so the announcement doesn&rsquo;t linger on the dashboard.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Early Arrival Message</div>
              <div className="man-field__desc">
                <p>A short message shown in muted grey below the program details on the dashboard card. Use for a persistent, calm reminder.</p>
                <p><em>Example: Please arrive 5–10 minutes early to get settled before we begin.</em></p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Remove from Dashboard Program List</div>
              <div className="man-field__desc">
                <p>When checked, this program does not appear in the member dashboard&rsquo;s program listing. The program&rsquo;s own page is still accessible by direct link. Use for programs that are not relevant to the general membership — for example, internal staff programs or programs managed outside of this system.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Day Filtering</div>
              <div className="man-field__desc">
                <p>Controls which day(s) of the week this program&rsquo;s dashboard card is visible, so members only see it on the days it actually meets. This is a text field used internally. Leave blank unless you have a specific reason to filter by day — most programs don&rsquo;t need this.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sorting & Visibility tab ── */}
        <section id="prog-sorting" className="man-section">
          <h2 className="man-section__title">Sorting &amp; Visibility tab</h2>
          <p>
            This tab controls where the program shows up in listings and whether it&rsquo;s publicly visible.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Day of the Week</div>
              <div className="man-field__desc">
                <p>Select the day(s) this program meets. Programs on the public listing are grouped and sorted by day of week — this field drives that grouping. It references built-in weekday documents, not a free-text field, so you must select from the list.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Sort Order</div>
              <div className="man-field__desc">
                <p>A number controlling the display order within a day group on the public listing and within the registrar area. Lower numbers appear first.</p>
                <p>Use round numbers — 10, 20, 30 — so you can insert new programs between existing ones later without renumbering everything.</p>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Hide from Programs &amp; Events Listing</div>
              <div className="man-field__desc">
                <p>When checked, this program does not appear on the public <code>/programs</code> listing page, but its own page is still reachable at its direct URL.</p>
                <p>Use this for programs that are invitation-only, still in draft, or not meant to be discovered by browsing — for example, a private retreat or a staff-only program where you share the link directly.</p>
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
              <li><strong>Content tab:</strong> Add the tagline, upload an image, write the description.</li>
              <li><strong>Schedule &amp; Location tab:</strong> Select a <strong>Category</strong> (required for public listing), choose teachers, write the date text and time text, set the Start Date &amp; Time, and add the location.</li>
              <li><strong>Registration tab:</strong> If this program needs registration, turn on <strong>Enable Registration</strong>, set a capacity, add custom questions, and write the <strong>Confirmation Email Message</strong>.</li>
              <li><strong>Dana &amp; Payment tab:</strong> Set the Dana Mode if this program collects offerings.</li>
              <li><strong>Sorting &amp; Visibility tab:</strong> Set a <strong>Sort Order</strong> number so the program appears in the right position in the listing.</li>
              <li>Click <strong>Publish</strong>. The program is live on the website.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Updating dates or times</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>Schedule &amp; Location</strong> tab.</li>
              <li>Update the <strong>Date</strong> text field (what displays on the page) and the <strong>Start Date &amp; Time</strong> field (what generates calendar links).</li>
              <li>Update <strong>Listing Day &amp; Time</strong> if needed.</li>
              <li>Publish.</li>
            </ol>
            <p className="man-task__note">If confirmation emails have already gone out with the old date, consider sending a reminder with the corrected date, or reach out to registered members directly.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Adding a special announcement to the member dashboard</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>Dashboard</strong> tab.</li>
              <li>Type the announcement in <strong>Special Announcement</strong>.</li>
              <li>Publish. It appears in red on the member dashboard immediately.</li>
              <li>After the event passes, clear the field and publish again to remove it.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Setting up a multi-session course with calendar recurrence</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>Schedule &amp; Location</strong> tab.</li>
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
              <li>Open the program → <strong>Sorting &amp; Visibility</strong> tab.</li>
              <li>Check <strong>Hide from Programs &amp; Events Listing</strong>.</li>
              <li>Publish. The program disappears from the listing but its page is still reachable by direct link.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Linking a program to an online course</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>Content</strong> tab.</li>
              <li>Click the <strong>Linked Courses</strong> field and search for the course by name.</li>
              <li>Select it and publish.</li>
              <li>From this point on, new registrants will automatically receive access to that course. Members who registered before this change will need access granted manually by an Admin from the member detail page.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Changing the display order of programs</h3>
            <ol className="man-steps">
              <li>Open each program you want to reorder → <strong>Sorting &amp; Visibility</strong> tab.</li>
              <li>Update the <strong>Sort Order</strong> number — lower numbers appear first.</li>
              <li>Publish each one.</li>
            </ol>
            <p className="man-task__note">Use round numbers (10, 20, 30) so you can insert a new program between two existing ones without renumbering.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Retiring or archiving a program</h3>
            <ol className="man-steps">
              <li>If the program should no longer be discoverable: open it → <strong>Sorting &amp; Visibility</strong> tab → check <strong>Hide from Programs &amp; Events Listing</strong> → publish. The page still exists but won&rsquo;t be found by browsing.</li>
              <li>If registration should close: open it → <strong>Registration</strong> tab → turn on <strong>Registration Closed</strong> → publish.</li>
              <li>If the program should be fully removed from the website: contact an Admin — deleting a published document in Sanity is a destructive action that should be done intentionally.</li>
            </ol>
          </div>
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
              <strong>Courses &amp; Online Materials</strong> — the member-facing side: browsing the course library, accessing lessons and recordings, and how open courses differ from registration-required ones. (The admin side — granting and revoking access — is already covered in the <a href="#reg-course-access">Course access</a> section of this chapter.)
            </li>
            <li>
              <strong>Google Meet Integration</strong> — once built: how to generate a Google Meet link directly from Sanity Studio and have it appear in emails and on the program page automatically.
            </li>
          </ul>
        </section>

        {/* ════════════════════════════════════════
            CHAPTER 3 — GOOGLE MEET
            ════════════════════════════════════════ */}

        <div id="google-meet" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Google Meet</h1>
          <p className="man-chapter__subtitle">
            This chapter walks you through setting up Google Meet video calls for virtual programs — what to do before a session, how to create the meeting link, and what the volunteer host needs to know.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="meet-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            Google Meet is the video platform RIM uses for virtual programs — drop-in sittings, community groups, Foundations, and any other program that happens over video. It replaced Zoom, which had a 40-minute limit on the free plan and required managing separate accounts and links outside of the website.
          </p>
          <p>
            With this system, creating a meeting link is a two-step process: you open the program in the registrar area, type the volunteer&rsquo;s email address, and click one button. That&rsquo;s it. The link is created automatically, saved to the program, and appears in all confirmation and reminder emails without you having to copy or paste anything.
          </p>
          <p>
            The volunteer host receives a Google Calendar invite. They click the link from their own Google account, join the meeting, and automatically have full host controls — they can mute participants, admit people from the waiting area, and end the session when it&rsquo;s complete. They never need to log into a shared account or do anything special.
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
            Think of it like a building with a few named meeting rooms. We have three:
          </p>
          <ul className="man-list">
            <li><strong>Core Programs Room</strong> — used for Foundations, courses, and teacher-led programs</li>
            <li><strong>Community Group Room</strong> — used for community circles and support groups</li>
            <li><strong>Silent Meditation Room</strong> — used for morning and evening sits and community-led drop-ins</li>
          </ul>
          <p>
            Each of these rooms is a Google account in the background. When you create a meeting for a program, the system checks which room is free at that time and assigns the program to it automatically. You never see which room was chosen, and neither does anyone else — it all happens behind the scenes.
          </p>
          <p>
            This means two programs can run at the same time on the same night without any conflict. Each gets its own room and its own link.
          </p>

          <h3 className="man-section__h3">The volunteer as host</h3>
          <p>
            When a meeting is created, the volunteer&rsquo;s email address is pre-registered as a co-host before anyone even joins. This is different from Zoom, where the host had to be present first or share a host key. With Google Meet, the volunteer joins from their own Google account and immediately sees the blue host controls shield in the corner of their screen — mute all, remove participant, end call. Nobody needs to grant them anything at the time of the session.
          </p>
          <div className="man-note">
            The volunteer must have a <strong>@rootedinmindfulness.org</strong> Google account for the automatic co-host setup to work. If they use a personal Gmail address, the meeting link will still be created and they will still be able to join, but they may need to request host controls from someone inside the meeting.
          </div>
        </section>

        {/* ── Before you start ── */}
        <section id="meet-before" className="man-section">
          <h2 className="man-section__title">Before you start</h2>
          <p>
            Before you can create a Google Meet link for a program, two things need to be in place:
          </p>

          <h3 className="man-section__h3">1. A Start Date &amp; Time must be set in Sanity Studio</h3>
          <p>
            The system uses the program&rsquo;s scheduled start time to check which meeting rooms are available. Without a start time, it has no way to know whether a room is free.
          </p>
          <p>
            If the program doesn&rsquo;t have a Start Date &amp; Time set, the Google Meet panel in the registrar area will show a notice telling you to add one. Go to <strong>Sanity Studio → Programs → [program name] → Schedule tab</strong> and fill in the <strong>Start Date &amp; Time</strong> field. Then come back and create the meeting.
          </p>
          <p>
            If the program is recurring (e.g. every Wednesday evening), the Start Date &amp; Time should be the date of the <em>next</em> session. The meeting link itself doesn&rsquo;t expire — you can reuse it across sessions.
          </p>

          <h3 className="man-section__h3">2. The volunteer must have a @rootedinmindfulness.org email</h3>
          <p>
            You&rsquo;ll need to know the volunteer&rsquo;s RIM email address (the one ending in <code>@rootedinmindfulness.org</code>). This is the address they use to log in to Google Workspace — it&rsquo;s their staff Google account, the same one they use for Google Calendar and Gmail at RIM.
          </p>
          <p>
            If you&rsquo;re not sure of their exact address, ask them directly. Their address follows the format <code>firstname@rootedinmindfulness.org</code> or <code>firstnamelastname@rootedinmindfulness.org</code>.
          </p>
        </section>

        {/* ── Creating a meeting ── */}
        <section id="meet-create" className="man-section">
          <h2 className="man-section__title">Creating a meeting</h2>
          <p>
            This takes about 30 seconds once the prerequisites are in place.
          </p>
          <ol className="man-steps">
            <li>Go to <strong>/volunteer</strong> and click the program you want to set up.</li>
            <li>At the top of the program page, above the registrations table, you&rsquo;ll see a <strong>Google Meet</strong> panel.</li>
            <li>Type the volunteer&rsquo;s <code>@rootedinmindfulness.org</code> email address into the field.</li>
            <li>Click <strong>Create Google Meet</strong>.</li>
            <li>Wait a few seconds. When it&rsquo;s done, the panel shows the Meet link.</li>
          </ol>
          <p>
            That&rsquo;s it. The link has been created and saved to the program automatically. You don&rsquo;t need to copy it anywhere — it will appear on the program page, in confirmation emails, and in reminder emails from this point forward.
          </p>
          <p>
            The volunteer also receives a Google Calendar invite with the meeting details and the link embedded. They don&rsquo;t need to ask you for the link separately.
          </p>

          <h3 className="man-section__h3">Replacing an existing link</h3>
          <p>
            If a meeting link already exists and you need to create a new one — for example, if the original volunteer has changed or the link needs to be regenerated — the panel will show the current link with a <strong>Replace</strong> button next to it.
          </p>
          <p>
            Click <strong>Replace</strong>, enter the new volunteer&rsquo;s email address, and confirm. A new link will be created and the old one will be overwritten in Sanity. Be aware that the old link stops working immediately — if you&rsquo;ve already sent it to participants via a channel outside of the website, you&rsquo;ll need to follow up with the new link manually.
          </p>
          <div className="man-note man-note--warn">
            ⚠ Links sent in automatic confirmation and reminder emails already include the correct link from Sanity. If you replace a link <em>after</em> emails have already gone out, the new link will appear on the program page but the old emails are already sent and cannot be recalled. Consider whether participants need a follow-up message with the updated link.
          </div>
        </section>

        {/* ── What the volunteer does ── */}
        <section id="meet-volunteer" className="man-section">
          <h2 className="man-section__title">What the volunteer host does</h2>
          <p>
            Once you&rsquo;ve created the meeting, the volunteer&rsquo;s side is straightforward. Share this with them if it&rsquo;s their first time leading a session on Google Meet.
          </p>

          <h3 className="man-section__h3">Before the session</h3>
          <p>
            They will receive a <strong>Google Calendar invite</strong> after the meeting is created. The invite includes the program name, date and time, and the Meet link. They can add it to their calendar by clicking <strong>Yes</strong> or <strong>Accept</strong> in the invite.
          </p>
          <p>
            When the time comes, they open the calendar event and click the <strong>Join with Google Meet</strong> button. That&rsquo;s all they need to do — they don&rsquo;t need to sign in to a special account, find a password, or do anything technical.
          </p>

          <h3 className="man-section__h3">During the session</h3>
          <p>
            When they join, they will see a small <strong>blue shield icon</strong> in the bottom-right area of the screen. This is the host controls indicator — it means they have full control of the meeting.
          </p>
          <p>
            As the host, they can:
          </p>
          <ul className="man-list">
            <li><strong>Mute anyone</strong> — hover over a participant and click the microphone icon, or use <em>Mute all</em> from the People panel</li>
            <li><strong>Remove a participant</strong> — hover over their name in the People panel and click the three-dot menu</li>
            <li><strong>Control who can join</strong> — if someone is in the waiting area (knocking), they can admit or decline them</li>
            <li><strong>End the meeting for everyone</strong> — click the red hang-up button and choose <em>End meeting for all</em></li>
          </ul>
          <p>
            They don&rsquo;t need to do anything special to <em>start</em> the meeting. There is no &ldquo;host must join first&rdquo; requirement — participants can join before the host arrives and will be admitted automatically because the meeting is set to open access for RIM staff and participants.
          </p>

          <h3 className="man-section__h3">If they don&rsquo;t see host controls</h3>
          <p>
            Occasionally, the automatic co-host setup may not apply — for example, if the email used wasn&rsquo;t a <code>@rootedinmindfulness.org</code> address, or if there was a technical hiccup during setup. In that case, they will still be able to join and lead the session — they just won&rsquo;t have the blue shield.
          </p>
          <p>
            For most RIM sessions, this isn&rsquo;t a problem. The meditation format doesn&rsquo;t usually require muting people or removing participants. If host controls are needed, any other RIM staff member who joins the meeting with a <code>@rootedinmindfulness.org</code> account can grant the volunteer host controls from within the meeting.
          </p>
          <p>
            To grant host controls inside a meeting: open the <strong>People panel</strong>, hover over the person&rsquo;s name, click the three-dot menu, and select <strong>Give host controls</strong>.
          </p>
        </section>

        {/* ── Where the link appears ── */}
        <section id="meet-link-appears" className="man-section">
          <h2 className="man-section__title">Where the link appears</h2>
          <p>
            Once a meeting link is saved to a program, it appears in three places automatically. You don&rsquo;t need to add it manually anywhere.
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
                <td>Program page <code>/programs/[slug]</code></td>
                <td>Anyone who visits the page</td>
                <td>Immediately, once the link is saved</td>
              </tr>
              <tr>
                <td>Confirmation email</td>
                <td>Everyone who registers</td>
                <td>Sent at the moment of registration</td>
              </tr>
              <tr>
                <td>Reminder email</td>
                <td>Everyone registered for that program</td>
                <td>Sent on the reminder date set in Sanity</td>
              </tr>
            </tbody>
          </table>
          <p>
            The button on the program page uses the label you set in Sanity Studio&rsquo;s <strong>Meeting Button Text</strong> field (under Schedule tab). When you create the link through this system, it is automatically set to <strong>&ldquo;Join on Google Meet.&rdquo;</strong> You can change the label in Sanity Studio at any time.
          </p>
          <div className="man-note">
            The RIM Programs shared Google Calendar (which all staff can subscribe to) also receives a calendar event when the meeting is created. Staff who subscribe to that calendar will see all upcoming virtual programs with the Meet link embedded directly in their own Google Calendar.
          </div>
        </section>

        {/* ── If something goes wrong ── */}
        <section id="meet-issues" className="man-section">
          <h2 className="man-section__title">If something goes wrong</h2>

          <h3 className="man-section__h3">&ldquo;Add a Start Date &amp; Time in Sanity Studio first&rdquo;</h3>
          <p>
            The Google Meet panel is showing a notice instead of the input field. This means the program doesn&rsquo;t have a scheduled time set. Go to <strong>Sanity Studio → Programs → [program] → Schedule tab</strong> and fill in <strong>Start Date &amp; Time</strong>. Then come back to the registrar area and try again.
          </p>

          <h3 className="man-section__h3">&ldquo;All meeting rooms are booked at that time&rdquo;</h3>
          <p>
            All three virtual rooms are already in use during the requested time slot. This happens when three or more programs are scheduled at the same time. A few options:
          </p>
          <ul className="man-list">
            <li>Check whether the start times can be offset slightly so they don&rsquo;t overlap exactly.</li>
            <li>Ask an Admin to add more room accounts. Adding a fourth room is a quick setup process and can be done in a few minutes.</li>
            <li>If two programs always overlap, an additional room account is the right long-term solution.</li>
          </ul>

          <h3 className="man-section__h3">&ldquo;Meet created but Sanity write-back failed&rdquo;</h3>
          <p>
            The meeting was created successfully, but saving the link to the program in Sanity encountered a temporary error. The link is shown in the panel — copy it. Then go to <strong>Sanity Studio → Programs → [program] → Schedule tab</strong>, paste it into the <strong>Meeting Link</strong> field, set the <strong>Meeting Button Text</strong> to <strong>Join on Google Meet</strong>, and publish. Contact a developer if this happens more than once.
          </p>

          <h3 className="man-section__h3">The volunteer didn&rsquo;t receive a calendar invite</h3>
          <p>
            Calendar invites can sometimes go to spam. Ask the volunteer to check their spam or junk folder for an invite from Google Calendar. If it&rsquo;s not there, the invite may have been sent to a different email address than the one they check. Confirm which address you used when creating the meeting and whether that matches their active calendar.
          </p>
          <p>
            The volunteer can also simply use the Meet link directly — they don&rsquo;t need to accept the calendar invite to join the meeting with host controls.
          </p>

          <h3 className="man-section__h3">The link shows &ldquo;co-host controls not available&rdquo;</h3>
          <p>
            After creating a meeting, the panel may show a small notice that says co-host controls are not available on the free tier. This means the automatic host-shield assignment didn&rsquo;t apply due to a Google Workspace plan limitation. The meeting link is still valid, and the volunteer can still lead the session — they just won&rsquo;t have the blue host shield automatically.
          </p>
          <p>
            For most RIM sessions, this doesn&rsquo;t affect anything. If host controls are needed, any staff member inside the meeting can grant them manually — see the <a href="#meet-volunteer">What the volunteer host does</a> section above.
          </p>

          <h3 className="man-section__h3">Something else went wrong</h3>
          <p>
            If the button shows a general error or nothing seems to happen, try refreshing the page and attempting again. If the problem persists, contact a developer and describe what the error message said.
          </p>
        </section>

        {/* ════════════════════════════════════════
            CHAPTER 4 — STAFF & ROLES
            ════════════════════════════════════════ */}

        <div id="roles" className="man-chapter man-chapter--break">
          <h1 className="man-chapter__title">Staff &amp; Roles</h1>
          <p className="man-chapter__subtitle">
            This chapter covers staff roles — what each one unlocks, how to grant and remove access, and how to get a new staff member set up from scratch.
          </p>
        </div>

        {/* ── Overview ── */}
        <section id="roles-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            Every member of the RIM community who logs in has a basic account. By default, accounts have no special access — they can only see their own dashboard, registrations, and courses.
          </p>
          <p>
            Staff access is granted by assigning one or more <strong>roles</strong> to a member&rsquo;s account. There are currently two roles: <strong>Registrar</strong> and <strong>Admin</strong>. Roles are additive — a person with both roles gets the permissions of each combined.
          </p>
          <p>
            Roles take effect immediately. As soon as you save a role change, the next page the member loads will reflect their new access. No re-login is required (though if they are logged in, they may need to reload the page).
          </p>
        </section>

        {/* ── The two roles ── */}
        <section id="roles-two-roles" className="man-section">
          <h2 className="man-section__title">The two roles</h2>

          <h3 className="man-section__h3">Registrar</h3>
          <p>
            A Registrar manages day-to-day program registrations. This role is intended for the person (or people) handling waitlists, sending reminders, promoting members, and keeping registration lists accurate.
          </p>
          <p>What a Registrar can do:</p>
          <ul className="man-list">
            <li>View and manage all program registrations at <strong>/volunteer</strong></li>
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
            An Admin has full access to the entire staff area. This role is for the person (or people) responsible for the health of the system — managing member accounts, overseeing access, and handling anything a Registrar cannot.
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
            When a member with a staff role logs in, a <strong>Staff Access</strong> panel appears on their dashboard. The links in that panel depend on their role:
          </p>
          <table className="man-table man-table--perms">
            <thead>
              <tr>
                <th>Link</th>
                <th>Registrar</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Registrations <code>/volunteer</code></td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Members <code>/admin/members</code></td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Sanity Studio (external)</td>
                <td>✓</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Staff Manual <code>/admin/manual</code></td>
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
            Assigning the Registrar role triggers an automatic notification email and causes a <strong>Sanity Studio Access</strong> panel to appear on their member detail page. See the sections below.
          </div>
        </section>

        {/* ── Notification email ── */}
        <section id="roles-notifying" className="man-section">
          <h2 className="man-section__title">Notification email</h2>
          <p>
            When you assign someone the <strong>Registrar</strong> role and save, they automatically receive a notification email from Rooted In Mindfulness. The email tells them what the role means, links them to the registrar dashboard at <strong>/volunteer</strong>, and points them to this manual.
          </p>
          <p>
            You don&rsquo;t need to do anything extra — no need to manually forward instructions or copy a URL. The email goes out the moment you save.
          </p>
          <p>
            A few things to know:
          </p>
          <ul className="man-list">
            <li>The email fires exactly once, when Registrar is <em>first</em> added. It does not re-send if you save their record again with the role already checked.</li>
            <li>No notification is sent when the Admin role is assigned. Admins are typically people already deeply involved in the organization — a quiet system-level change is appropriate.</li>
            <li>The email does <em>not</em> include Sanity Studio instructions — that&rsquo;s a separate step with its own invite.</li>
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
