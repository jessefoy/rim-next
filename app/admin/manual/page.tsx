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
              <li><a href="#reg-overview"        className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#reg-member-exp"       className="man-sidebar__sublink">Member experience</a></li>
              <li><a href="#reg-your-tools"       className="man-sidebar__sublink">Your tools</a></li>
              <li><a href="#reg-statuses"         className="man-sidebar__sublink">Status guide</a></li>
              <li><a href="#reg-dana"             className="man-sidebar__sublink">Dana</a></li>
              <li><a href="#reg-emails"           className="man-sidebar__sublink">Automatic emails</a></li>
              <li><a href="#reg-calendar"         className="man-sidebar__sublink">Calendar links</a></li>
              <li><a href="#reg-tasks"            className="man-sidebar__sublink">Common tasks</a></li>
              <li><a href="#reg-edge-cases"       className="man-sidebar__sublink">Edge cases</a></li>
            </ul>
          </li>

          <li>
            <a href="#programs" className="man-sidebar__link man-sidebar__link--active">
              Programs &amp; Sanity Studio
            </a>
            <ul className="man-sidebar__sub">
              <li><a href="#prog-overview"        className="man-sidebar__sublink">Overview</a></li>
              <li><a href="#prog-role"            className="man-sidebar__sublink">Who does this</a></li>
              <li><a href="#prog-creating"        className="man-sidebar__sublink">Creating a program</a></li>
              <li><a href="#prog-content"         className="man-sidebar__sublink">Content tab</a></li>
              <li><a href="#prog-schedule"        className="man-sidebar__sublink">Schedule &amp; Location tab</a></li>
              <li><a href="#prog-registration"    className="man-sidebar__sublink">Registration tab</a></li>
              <li><a href="#prog-dana"            className="man-sidebar__sublink">Dana &amp; Payment tab</a></li>
              <li><a href="#prog-dashboard"       className="man-sidebar__sublink">Dashboard tab</a></li>
              <li><a href="#prog-sorting"         className="man-sidebar__sublink">Sorting &amp; Visibility tab</a></li>
              <li><a href="#prog-tasks"           className="man-sidebar__sublink">Common tasks</a></li>
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
          <li className="man-sidebar__soon-group">
            <span className="man-sidebar__link man-sidebar__link--soon">Staff &amp; Roles</span>
            <span className="man-soon-badge">Coming soon</span>
          </li>
        </ul>
      </nav>

      {/* ── Main content ── */}
      <main className="man-content">

        {/* ════════════════════════════════════════════════════════
            CHAPTER 1: REGISTRATION
            ════════════════════════════════════════════════════════ */}

        <div id="registration" className="man-chapter">
          <h1 className="man-chapter__title">Registration</h1>
          <p className="man-chapter__subtitle">
            How members sign up for programs, what you see as a registrar, and how to handle every situation that comes up.
          </p>
        </div>

        {/* ── 1. Overview ── */}
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
            There is also a standalone registration page at <strong>/programs/[slug]/register</strong> for each program. This is useful when you want to send someone directly to the form without them having to scroll past the program description, and it&rsquo;s the page linked in approval emails so promoted waitlist members land directly on the dana step.
          </p>
        </section>

        {/* ── 2. Member experience ── */}
        <section id="reg-member-exp" className="man-section">
          <h2 className="man-section__title">Member experience</h2>
          <p>
            Here is what a member or visitor sees when they register for a program. The form adapts based on whether the person has an account and whether they&rsquo;ve registered with us before.
          </p>

          <h3 className="man-section__h3">The registration form</h3>
          <ol className="man-steps">
            <li>They visit the program&rsquo;s page and click <strong>Register →</strong> (or visit <code>/programs/[slug]/register</code> directly).</li>
            <li>They fill in their name, email address, and optionally a phone number. If they have an account and are signed in, their name and email are pre-filled and locked — so their registration always shows their real name.</li>
            <li>If the program has custom questions (e.g. &ldquo;Do you have any accessibility needs?&rdquo;), those appear next. Questions can be short text, long text, yes/no, or multiple choice.</li>
            <li>If this is their first time registering with RIM and they are not signed in, they will see a <strong>Community Agreements</strong> section before the submit button. They must check a box to continue. (See below.)</li>
            <li>They click <strong>Register</strong> (or <strong>Join Waitlist</strong> if the program is full). If the program is nearly full — 5 or fewer spots remaining — a warning banner shows above the form.</li>
            <li>They receive a confirmation email within a few seconds. If they were waitlisted, the email says so and gives their position.</li>
            <li>If the program has a dana or fee step, the form moves to that step immediately after confirming their spot. They can complete it now or return later.</li>
          </ol>

          <h3 className="man-section__h3">Email recognition — returning members</h3>
          <p>
            When a non-logged-in person types an email address that belongs to an existing RIM account, the form quietly looks them up in the background. If a match is found:
          </p>
          <ul className="man-list">
            <li>Their name fields are filled in from their account and locked. A &ldquo;Welcome back, [Name]&rdquo; message appears under the email field.</li>
            <li>Their registration will be linked to their existing account, so it shows up in their My Programs history.</li>
            <li>If they have already agreed to the community agreements, the agreements section is hidden — they don&rsquo;t see it again.</li>
          </ul>
          <p>
            This protects against name inconsistencies — if someone registers hastily and types a nickname or misspelling, the system uses their account name instead.
          </p>
          <div className="man-note">
            <strong>If a member says their name is locked and they can&rsquo;t change it:</strong> That means they were recognized by email. Their account name is being used. If the name in their account is wrong, you can fix it directly from the registrar table using the Edit button, or they can update it from their profile at <strong>/account/my-profile</strong>.
          </div>

          <h3 className="man-section__h3">Community agreements</h3>
          <p>
            The registration form includes a community agreements section for anyone who has not yet agreed to them. This section only appears when:
          </p>
          <ul className="man-list">
            <li>The person is <em>not</em> signed in to an account, AND</li>
            <li>They have not already agreed (either this session or on a previous registration)</li>
          </ul>
          <p>
            The section shows a short description of RIM as an intentional community, with a collapsible section where they can read all four Care Agreements in full. They must check a box — &ldquo;I&rsquo;m entering this community in a spirit of care and respect&rdquo; — before the submit button becomes active.
          </p>
          <p>
            Once agreed, this is recorded on their account and they will never be asked again. Members who are signed in have already passed through this moment and see no agreements section at all.
          </p>

          <h3 className="man-section__h3">After registering</h3>
          <p>
            Once confirmed, the program page shows <strong>✓ You&rsquo;re registered</strong> instead of a registration button. If calendar dates are set, members also see links to add the event to Google Calendar or download a .ics file for Apple Calendar or Outlook.
          </p>
          <p>
            Members can view all their past and current registrations — including status, dana status, and any notes — at <strong>/account/dashboard-my-registrations</strong> (called &ldquo;My Programs&rdquo; in the navigation). From there they can also see if they have a pending dana offering.
          </p>
          <p>
            If a member has a pending dana offering, their dashboard homepage shows a reminder card with a link to complete it. This appears automatically and goes away once dana is received.
          </p>
        </section>

        {/* ── 3. Your tools ── */}
        <section id="reg-your-tools" className="man-section">
          <h2 className="man-section__title">Your tools</h2>

          <h3 className="man-section__h3">The program list — /volunteer</h3>
          <p>
            Your main workspace starts at <strong>/volunteer</strong>. This page shows all programs that have registration enabled, sorted by their display order in Sanity Studio.
          </p>
          <p>
            Each program card shows:
          </p>
          <ul className="man-list">
            <li>The program name and tagline</li>
            <li>A capacity bar showing how full the program is (turns yellow near capacity, red when full)</li>
            <li>An amber badge if there are waitlisted people waiting for a spot</li>
            <li>An amber badge if there are registrants with pending dana</li>
            <li>A green &ldquo;confirmed&rdquo; count if all is well</li>
          </ul>
          <p>
            Cards with waitlisted people or pending dana are highlighted in amber so you can quickly spot what needs attention.
          </p>

          <h3 className="man-section__h3">The registrar table — /volunteer/programs/[slug]</h3>
          <p>
            Click any program card to open its full registration list. From the table you can:
          </p>
          <ul className="man-list">
            <li>See all registrants: name, email, phone, status, dana status, dana amount, date registered, and any custom question responses</li>
            <li>Change a registrant&rsquo;s status — promote from waitlist, cancel a registration, restore a cancelled registration</li>
            <li>Edit a registrant&rsquo;s custom question responses directly in the table</li>
            <li>Send a self-service edit link to a registrant so they can update their own responses (they receive an email with a secure link — no account needed)</li>
            <li>Send an individual reminder email, or send a bulk reminder to all confirmed registrants who haven&rsquo;t received one yet</li>
            <li>Send a dana reminder to a specific registrant with pending dana</li>
            <li>Resend a confirmation email to any registrant</li>
            <li>Add or edit a private staff note on any registration (visible only to you — not sent to the member)</li>
            <li>Export the full list as a CSV file</li>
          </ul>
          <p>
            If a reminder date is set in Sanity Studio, a banner appears at the top of the table showing the scheduled date and a button to send reminders manually to anyone who hasn&rsquo;t received one yet.
          </p>
          <p>
            You can also access Sanity Studio — the content editor — from your dashboard. That is where you create and edit programs, set registration settings, write confirmation messages, and schedule reminder emails.
          </p>
        </section>

        {/* ── 4. Status guide ── */}
        <section id="reg-statuses" className="man-section">
          <h2 className="man-section__title">Status guide</h2>
          <p>
            Every registration has a status. Here is what each one means and when you&rsquo;ll see it.
          </p>

          <div className="man-status-grid">
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--registered">Registered</span>
              <p>The person has a confirmed spot. This is the normal state for most registrants. The system sets this automatically when they submit the form and capacity is available.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--approved">Approved</span>
              <p>Like Registered, but set manually by a registrar. Use this when you want to distinguish between self-registered and staff-approved participants — for example, in programs with a selection or application process. Both Registered and Approved count toward capacity.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--waitlisted">Waitlisted</span>
              <p>The program was full when they registered. They are in the queue, ordered by the time they submitted. Promote them to Registered when a spot opens up — the system sends an approval email automatically. Dana is not collected from waitlisted members.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--cancelled">Cancelled</span>
              <p>The registration has been cancelled — either by you or by the member. Cancelled registrations do not count toward capacity. You can restore a cancelled registration by changing its status back. The system does not auto-promote the waitlist when a cancellation happens — you do that manually.</p>
            </div>
          </div>
        </section>

        {/* ── 5. Dana ── */}
        <section id="reg-dana" className="man-section">
          <h2 className="man-section__title">Dana</h2>
          <p>
            Dana is the traditional practice of giving — offering what you can, freely and without obligation, in support of the teachings and the center. For programs that use dana, the registration form includes a step where members can make an offering via Stripe (credit or debit card).
          </p>
          <p>
            Not every program uses dana. In Sanity Studio, each program has a <strong>Dana Mode</strong> setting on the Dana &amp; Payment tab:
          </p>
          <ul className="man-list">
            <li><strong>None</strong> — no dana step. The form skips it entirely. Most drop-in programs use this.</li>
            <li><strong>Voluntary</strong> — a suggested amount is shown, but the member can change it to any amount or skip it entirely with &ldquo;No thank you.&rdquo; There is no obligation.</li>
            <li><strong>Base + Dana</strong> — there is a required base fee (to cover costs, for example) plus an optional voluntary dana on top.</li>
            <li><strong>Fixed</strong> — a set price. Used for programs with a firm cost, like a retreat with accommodation.</li>
          </ul>
          <p>
            The <strong>Dana Status</strong> column in your registrar table tells you where each person stands:
          </p>
          <ul className="man-list">
            <li><strong>Waived</strong> — no dana was expected for this program (mode is None), or the program has a fixed/base amount that wasn&rsquo;t configured yet.</li>
            <li><strong>Pending</strong> — dana is expected but has not been completed yet. The member can return to <strong>/programs/[slug]/register</strong> at any time to complete it. You can also send them a dana reminder from the registrar table.</li>
            <li><strong>Completed</strong> — dana has been received via Stripe. The amount is recorded in the table.</li>
            <li><strong>Not Required</strong> — the person is on the waitlist. Dana is not collected until they are confirmed.</li>
          </ul>
          <p>
            When a member has pending dana, their dashboard homepage shows a reminder card automatically. It links them back to the program&rsquo;s register page where they can complete their offering. The card disappears once dana is received.
          </p>
          <div className="man-note">
            <strong>Note:</strong> Dana is never a gate on participation. A person with Pending dana is fully registered and should be welcomed. The reminder is a gentle invitation, not a requirement.
          </div>
        </section>

        {/* ── 6. Automatic emails ── */}
        <section id="reg-emails" className="man-section">
          <h2 className="man-section__title">Automatic emails</h2>
          <p>
            The system sends emails automatically in the following situations. You do not need to do anything to trigger them — they go out on their own.
          </p>

          <div className="man-email-list">
            <div className="man-email-item">
              <div className="man-email-item__trigger">When someone registers (to registrant)</div>
              <div className="man-email-item__desc">
                A confirmation email goes to the registrant immediately. It includes the program name, date, time, location (if set), any custom confirmation message you wrote in Sanity Studio, and links to add the event to their calendar.
                <br /><br />If the program is full and they were waitlisted, the email says so and gives their position in the queue.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a waitlisted person is promoted (to registrant)</div>
              <div className="man-email-item__desc">
                An approval email goes out automatically when you click <strong>Promote</strong>. It tells them their spot is confirmed. If the program has a dana step, the email includes a button linking them to the register page to complete their offering.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a registration is cancelled (to registrar)</div>
              <div className="man-email-item__desc">
                You (the registrar inbox) receive a cancellation notification. The member does not receive an automatic email — if you want to let them know, reach out directly. The notification includes a link straight to the program&rsquo;s registrar table.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">On the scheduled reminder date (to all confirmed registrants)</div>
              <div className="man-email-item__desc">
                If you set a Reminder Email Date in Sanity Studio, the system sends a reminder email to all confirmed registrants (Registered and Approved — not waitlisted) at 9:00 AM Central on that day. The email includes date, time, location, meeting link (if set), and any custom reminder message you wrote.
                <br /><br />You can also send reminders manually from the registrar table — either to everyone who hasn&rsquo;t received one yet, or to individuals.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When you send a self-service edit link (to registrant)</div>
              <div className="man-email-item__desc">
                Clicking <strong>Send Edit Link</strong> in the registrar table sends the registrant a secure, time-limited link. The email tells them which program it&rsquo;s for and that they can update their responses. The link is valid for 7 days.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a registrant updates via their edit link (to registrar)</div>
              <div className="man-email-item__desc">
                When a registrant submits their updated responses through the self-service link, you receive a notification email showing their name, the program, and what they changed.
              </div>
            </div>
          </div>
          <p>
            You can resend a confirmation email to any individual registrant from the registrar table using the <strong>Resend Confirmation</strong> action. This is useful if someone says they never received their confirmation.
          </p>
        </section>

        {/* ── 7. Calendar links ── */}
        <section id="reg-calendar" className="man-section">
          <h2 className="man-section__title">Calendar links</h2>
          <p>
            When a program has a <strong>Start Date &amp; Time</strong> set in Sanity Studio, registered members will see two calendar links on the program page: one for Google Calendar and one for Apple Calendar or Outlook (downloaded as a .ics file). These same links also appear in the confirmation email.
          </p>
          <p>
            For programs that meet more than once, you can set a <strong>Recurrence Pattern</strong> in the Schedule &amp; Location tab of Sanity Studio. The four fields work together:
          </p>
          <ul className="man-list">
            <li><strong>Repeats</strong> — choose Daily, Weekly, or Monthly. Leave blank for a single event or a retreat that runs as one continuous block.</li>
            <li><strong>Every</strong> — how often. &ldquo;1&rdquo; means every week, &ldquo;2&rdquo; means every other week.</li>
            <li><strong>On Days</strong> — for weekly programs, check which days of the week (e.g. Wednesday only, or Monday &amp; Thursday).</li>
            <li><strong>Number of Sessions</strong> — the total count including the first session. A 4-week Wednesday course = 4.</li>
          </ul>
          <p>
            When recurrence is set, the Apple/Outlook .ics file will include all sessions — members add the entire course to their calendar in one click. The Google Calendar link will show only the first session (this is a limitation of Google Calendar&rsquo;s add-event URL, not our system) — labeled &ldquo;first session&rdquo; so members understand this.
          </p>
          <div className="man-note">
            <strong>Retreat tip:</strong> For a retreat that runs as one continuous block (e.g. Friday evening through Sunday afternoon), leave Recurrence blank and set Start Date &amp; Time to Friday evening, End Date &amp; Time to Sunday afternoon. The calendar entry will span the full retreat automatically.
          </div>
        </section>

        {/* ── 8. Common tasks ── */}
        <section id="reg-tasks" className="man-section">
          <h2 className="man-section__title">Common tasks</h2>

          <div className="man-task">
            <h3 className="man-task__title">Setting up registration for a new program</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio.</li>
              <li>Go to the <strong>Registration</strong> tab.</li>
              <li>Turn on <strong>Enable Registration</strong>.</li>
              <li>Set a <strong>Capacity</strong> if the program has a maximum size. Leave blank for unlimited.</li>
              <li>Optionally set a <strong>Registration Deadline</strong> — the form will close automatically at that date and time.</li>
              <li>Add any <strong>Custom Registration Questions</strong> the program needs.</li>
              <li>Write a <strong>Confirmation Email Message</strong> — this is the personal note that goes out in the confirmation email.</li>
              <li>Go to the <strong>Schedule &amp; Location</strong> tab and set the <strong>Start Date &amp; Time</strong> so members get calendar links.</li>
              <li>Save. The Register button appears on the program page immediately.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Promoting someone from the waitlist</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the waitlisted person in the table.</li>
              <li>Click <strong>Promote</strong> next to their name and confirm.</li>
              <li>Their status changes to Registered and they receive an approval email automatically.</li>
              <li>If the program has dana, the approval email includes a link for them to complete their offering.</li>
            </ol>
            <p className="man-task__note">The waitlist does not auto-promote when a spot opens. You promote manually.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Cancelling a registration</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant in the table and click <strong>Cancel</strong>, then confirm.</li>
              <li>Their spot is freed. You receive a notification email. The member does not receive an automatic email.</li>
              <li>To restore the registration, find them in the table and click <strong>Restore</strong>.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a reminder email</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>To send to everyone who hasn&rsquo;t received a reminder yet, click <strong>Send to Remaining</strong> in the banner at the top.</li>
              <li>To send to one person, find them and click <strong>Send Reminder</strong>.</li>
            </ol>
            <p className="man-task__note">The table shows &ldquo;Reminder sent [date]&rdquo; on rows that have been sent. You can re-send — it sends again and updates the timestamp.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a dana reminder</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant whose Dana Status is Pending.</li>
              <li>Click <strong>Send Dana Reminder</strong> — they receive an email with a link to complete their offering.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Editing a registrant&rsquo;s responses</h3>
            <ol className="man-steps">
              <li>Find the registrant and click the <strong>Edit</strong> button in their row.</li>
              <li>Update the field directly in the table and click <strong>Save</strong>.</li>
              <li>Or click <strong>Send Edit Link</strong> to email the registrant a secure link. They can update their own responses — no account required. You receive a notification when they submit changes.</li>
            </ol>
            <p className="man-task__note">Edit links expire after 7 days. Send a new one if it has expired.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Adding a note to a registration</h3>
            <ol className="man-steps">
              <li>Find the registrant, click <strong>Edit</strong>, add or update the Notes field, and save.</li>
              <li>Notes are visible only to staff — never sent to members or shown on the website.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Exporting the registration list</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Click <strong>Export CSV</strong> at the top of the table.</li>
              <li>A spreadsheet downloads with all registrant information, including custom question responses, dana status, and notes.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Closing registration early</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio → Registration tab.</li>
              <li>Turn on <strong>Registration Closed</strong> and save.</li>
              <li>The Register button disappears from the program page immediately.</li>
            </ol>
            <p className="man-task__note">You can also set a <strong>Registration Deadline</strong> to have the form close automatically at a specific date and time.</p>
          </div>
        </section>

        {/* ── 9. Edge cases ── */}
        <section id="reg-edge-cases" className="man-section">
          <h2 className="man-section__title">Edge cases</h2>

          <div className="man-task">
            <h3 className="man-task__title">Someone registers with the wrong email address</h3>
            <p>Ask them to re-register with the correct email. Cancel the incorrect registration. If they can&rsquo;t re-register (program is now full), promote them manually after they join via the waitlist.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone didn&rsquo;t receive their confirmation email</h3>
            <p>Go to their registration in the registrar table and click <strong>Resend Confirmation</strong>. Ask them to check their spam folder. Confirm their email address is spelled correctly in the table.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone says their name is locked and they can&rsquo;t change it</h3>
            <p>The form recognized their email and pulled their name from their account. If the name is wrong, fix it directly in the registrar table using the Edit button, or they can update their profile at <strong>/account/my-profile</strong> once signed in.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A program is full but you want to add someone directly</h3>
            <p>Have them register normally — they&rsquo;ll be placed on the waitlist. Then immediately promote them. This keeps capacity accounting accurate and sends the proper confirmation and approval emails.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone on the waitlist cancels</h3>
            <p>Cancel their registration. The spot opens up. Promote the next person on the waitlist manually — the system does not auto-promote.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">You want to register someone who doesn&rsquo;t want to do it themselves</h3>
            <p>Fill out the registration form on their behalf using their email address. A confirmation email goes to them automatically. If they don&rsquo;t have an account yet, one is created silently — they can sign in any time via magic link.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member who was previously archived re-registers</h3>
            <p>The system automatically restores their account. Their email will be recognized, name pre-filled. After submitting, their account is active again. No action is needed on your part.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member says they can&rsquo;t access their account</h3>
            <p>All sign-in at RIM uses a <strong>magic link</strong> — no passwords. They go to <strong>/login</strong>, enter their email, and receive a one-click sign-in link. Ask them to check spam. If their email has changed, they&rsquo;ll need to re-register with the new address and contact an admin to link their history.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member has pending dana but doesn&rsquo;t know how to complete it</h3>
            <p>Their dashboard shows a reminder card with a link. You can also click <strong>Send Dana Reminder</strong> in the registrar table — the email links them to <strong>/programs/[slug]/register</strong> where the dana step appears immediately.</p>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════
            CHAPTER 2: PROGRAMS & SANITY STUDIO
            ════════════════════════════════════════════════════════ */}

        <div id="programs" className="man-chapter">
          <h1 className="man-chapter__title">Programs &amp; Sanity Studio</h1>
          <p className="man-chapter__subtitle">
            How to create and manage programs — every field explained in plain English.
          </p>
        </div>

        {/* ── Programs: Overview ── */}
        <section id="prog-overview" className="man-section">
          <h2 className="man-section__title">Overview</h2>
          <p>
            All of the content you see on the website — programs, courses, teacher bios, and more — is managed through <strong>Sanity Studio</strong>, a separate content editor that lives at <a href="https://rooted-in-mindfulness.sanity.studio/" target="_blank" rel="noopener noreferrer">rooted-in-mindfulness.sanity.studio</a>. You can also reach it from the &ldquo;Sanity Studio&rdquo; card on your staff dashboard.
          </p>
          <p>
            Sanity is where a program&rsquo;s name, description, image, dates, registration settings, dana settings, and everything else lives. When you save a program in Sanity, the changes appear on the website within seconds.
          </p>
          <p>
            The website and Sanity are connected. Changes you make in Sanity flow to the website automatically — there is no separate &ldquo;publish to website&rdquo; step beyond saving the document. (Unpublished <em>drafts</em> are the exception — see the note below.)
          </p>
          <div className="man-note">
            <strong>Drafts vs. published:</strong> In Sanity Studio, every document starts as a draft. A draft is visible only to you in Sanity — it does not appear on the website. When you click <strong>Publish</strong>, it goes live. If you edit a published document, your changes are saved as a new draft until you publish again. The small dot indicator in Sanity shows whether you&rsquo;re looking at a draft or a published version.
          </div>
        </section>

        {/* ── Programs: Who does this ── */}
        <section id="prog-role" className="man-section">
          <h2 className="man-section__title">Who does this</h2>
          <p>
            Creating and managing programs is a <strong>Registrar</strong> task. The Registrar role was designed to be a program coordinator role — the same person who sets up a program in Sanity is also the one who manages who registers for it through the <strong>/volunteer</strong> area. At RIM&rsquo;s scale, this makes sense as one job.
          </p>
          <p>
            To access Sanity Studio, a Registrar needs to receive an invitation email from an Admin. The invitation is sent from the member detail page in <strong>/admin/members</strong>. Once accepted, you&rsquo;ll have an account on Sanity with editor-level access.
          </p>
          <div className="man-note">
            <strong>If your role ever grows:</strong> If RIM expands to the point where a dedicated communications or content person manages the website separately from the person handling day-to-day registration logistics, these could become two distinct roles. The system supports that — it would just require a new role type and a separate Sanity access path.
          </div>
        </section>

        {/* ── Programs: Creating ── */}
        <section id="prog-creating" className="man-section">
          <h2 className="man-section__title">Creating a program</h2>
          <ol className="man-steps">
            <li>Open Sanity Studio and click <strong>Programs</strong> in the left sidebar.</li>
            <li>Click the <strong>+</strong> button (or &ldquo;Create new document&rdquo;) to start a new program.</li>
            <li>Give the program a <strong>Name</strong>. This is the only required field — everything else can be filled in later.</li>
            <li>Click the <strong>Generate</strong> button next to the Slug field to create the URL from the name. The slug is the part of the URL after <code>/programs/</code> — for example, a program named &ldquo;Morning Sitting&rdquo; becomes <code>/programs/morning-sitting</code>.</li>
            <li>Fill in the tabs one at a time. The tabs are: <strong>Content</strong>, <strong>Schedule &amp; Location</strong>, <strong>Registration</strong>, <strong>Dana &amp; Payment</strong>, <strong>Dashboard</strong>, and <strong>Sorting &amp; Visibility</strong>.</li>
            <li>When ready to make the program visible on the website, click <strong>Publish</strong>.</li>
          </ol>
          <div className="man-note">
            <strong>Important — don&rsquo;t change the slug after publishing.</strong> The slug is the program&rsquo;s permanent URL. If you change it after people have bookmarked the page or received it in emails, those links will break. Change the Name freely — only the slug matters for URLs.
          </div>
        </section>

        {/* ── Programs: Content tab ── */}
        <section id="prog-content" className="man-section">
          <h2 className="man-section__title">Content tab</h2>
          <p>
            The Content tab controls everything that appears on the program&rsquo;s page — the description, image, pull quote, and special notes.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Tagline</div>
              <div className="man-field__desc">A short one-sentence description shown on program listing cards and in search results. Keep it to one sentence. Example: &ldquo;A gentle introduction to sitting meditation for newcomers.&rdquo;</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Program Image</div>
              <div className="man-field__desc">The large image shown at the top of the program page. Click the hotspot icon after uploading to choose which part of the image stays in frame when it&rsquo;s cropped on different screen sizes. Landscape images work best.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Program Description</div>
              <div className="man-field__desc">
                The main body of the program page. This is a rich text editor — you can use headings (H2 for main sections, H3 for sub-sections), bold, italic, links, bullet lists, and numbered lists.
                <br /><br />
                The description also supports a few special block types you can add with the + button:
                <ul className="man-list" style={{marginTop: "0.5rem"}}>
                  <li><strong>Practice Suggestion</strong> — a teal highlighted callout box, good for guided instructions or &ldquo;try this&rdquo; prompts.</li>
                  <li><strong>Body Quote</strong> — a warm tinted box with an attribution line, for quotations embedded in the text.</li>
                  <li><strong>Verse Quote</strong> — a centered, styled quotation with a <em>~</em> decoration, for poems or short verse.</li>
                  <li><strong>Callout Text</strong> — larger serif text that extends slightly beyond the reading column, for a highlighted passage.</li>
                </ul>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Pull Quote</div>
              <div className="man-field__desc">A single sentence or short phrase displayed prominently between the details card and the description — styled with large decorative quotation marks. Use a compelling line from the description or a reflection on the program&rsquo;s spirit. Leave blank if not needed.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Quote Source</div>
              <div className="man-field__desc">Attribution line shown below the pull quote — for example, a teacher name or tradition name. Leave blank for unattributed quotes.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Special Notes</div>
              <div className="man-field__desc">A short block of text shown below the description. Use this for practical reminders that don&rsquo;t belong in the main description — for example: &ldquo;Please arrive 5 minutes early. Cushions and chairs are provided.&rdquo; Supports basic formatting.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Linked Courses (Online Materials)</div>
              <div className="man-field__desc">
                If this program has an associated online course in the Members Area — audio recordings, readings, or other materials — you can link it here. Members who register for this program will <em>automatically</em> gain access to all linked courses without any manual action on your part.
                <br /><br />
                Click the field and type to search for a course by name, or press Backspace to see all available courses. You can link more than one course.
              </div>
            </div>
          </div>
        </section>

        {/* ── Programs: Schedule & Location tab ── */}
        <section id="prog-schedule" className="man-section">
          <h2 className="man-section__title">Schedule &amp; Location tab</h2>
          <p>
            This tab controls dates, times, location, and the meeting link. It also determines whether the program appears on the public Programs &amp; Events listing page.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Program Category</div>
              <div className="man-field__desc">
                <strong>Required for the program to appear on the public listing page.</strong> Click the field and start typing to search, or press Backspace to see all categories. Categories include things like &ldquo;Meditation,&rdquo; &ldquo;Retreats,&rdquo; &ldquo;Classes,&rdquo; etc. If none of the existing categories fit, ask an Admin to create a new one.
                <br /><br />
                If a program has no category, it still has its own page accessible by direct link — it just won&rsquo;t appear in the listings.
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Teacher / Facilitator(s)</div>
              <div className="man-field__desc">Choose one or more teachers from the Team list. These names and photos appear on the program page. If the teacher isn&rsquo;t in the list yet, ask an Admin to add them via the Team section in Sanity.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Date</div>
              <div className="man-field__desc">The human-readable date shown on the program page and listing cards. Write it exactly as you want it to appear — for example: <em>Every Wednesday</em>, <em>June 7–9, 2025</em>, or <em>Ongoing</em>. This field is for display only — it doesn&rsquo;t affect calendar links or any automation.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Time</div>
              <div className="man-field__desc">The human-readable time shown on the program page — for example: <em>7:00–8:30 PM CT</em>. Display only, not used for automation.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Start Date &amp; Time</div>
              <div className="man-field__desc">The machine-readable start date and time. This is what generates the Add-to-Calendar links in confirmation emails and on the program page. Use the date picker — time is in UTC, so for Central Time, add 5 hours (6 in summer/CDT). Leave blank for recurring or open-ended programs that don&rsquo;t need calendar links.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">End Date &amp; Time</div>
              <div className="man-field__desc">Optional end time for calendar links. If left blank, calendar events default to 1 hour after the start. For retreats, set this to the actual end of the retreat so the calendar event spans the full block.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Repeats / Every / On Days / Number of Sessions</div>
              <div className="man-field__desc">
                These four fields together control the recurrence pattern for the calendar download. Leave them all blank for single events.
                <ul className="man-list" style={{marginTop: "0.5rem"}}>
                  <li><strong>Repeats</strong> — Daily, Weekly, or Monthly. Clear with the × button to go back to no recurrence.</li>
                  <li><strong>Every</strong> — interval. 1 = every week, 2 = every other week. Defaults to 1 if left blank.</li>
                  <li><strong>On Days</strong> — visible only for Weekly. Check each day the program meets (e.g. just Wednesday, or Monday and Thursday).</li>
                  <li><strong>Number of Sessions</strong> — total sessions including the first. An 8-week course = 8.</li>
                </ul>
                The .ics file download will include all sessions. The Google Calendar link only adds the first session (a Google limitation — labeled clearly for members).
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Listing Day &amp; Time</div>
              <div className="man-field__desc">A very concise version shown on listing cards — for example: <em>Wednesdays, 7–8:30 PM</em>. Keep it to one line. If blank, no day/time appears on listing cards.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Location</div>
              <div className="man-field__desc">The location name or address, shown on the program page and in emails. For example: <em>RIM Meditation Hall, 16905 W. Bluemound Rd., Brookfield</em>. For online-only programs, you might write <em>Online via Zoom</em> or leave blank.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Location Link</div>
              <div className="man-field__desc">A Google Maps URL or website address. If set, the location text becomes a clickable link on the program page. Paste the full URL including https://.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Meeting Link</div>
              <div className="man-field__desc">A Zoom or Google Meet URL for online or hybrid programs. When set, a join button appears on the program page and the link is included in reminder emails. In the future this will be generated automatically — for now, paste the URL here.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Meeting Button Text</div>
              <div className="man-field__desc">The label on the meeting button — for example: <em>Join on Zoom</em> or <em>Join on Google Meet</em>. Defaults to generic text if left blank.</div>
            </div>
          </div>
        </section>

        {/* ── Programs: Registration tab ── */}
        <section id="prog-registration" className="man-section">
          <h2 className="man-section__title">Registration tab</h2>
          <p>
            This tab controls whether and how registration works for this program. The Registration chapter of this manual covers each setting in detail — here is a quick reference.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Enable Registration</div>
              <div className="man-field__desc">Turns the registration form on. When off, the Register button does not appear on the program page.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Registration Closed</div>
              <div className="man-field__desc">Manually closes registration even if capacity remains and the deadline hasn&rsquo;t passed. Use when you want to stop new registrations immediately.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Capacity</div>
              <div className="man-field__desc">Maximum number of confirmed registrants (Registered + Approved). When full, new submissions go to the waitlist. Leave blank for unlimited.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Registration Deadline</div>
              <div className="man-field__desc">The form closes automatically at this date and time. Useful for programs that need to finalize numbers ahead of time.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Custom Registration Questions</div>
              <div className="man-field__desc">
                Additional questions added to the registration form after the standard name/email/phone fields. Each question has a type:
                <ul className="man-list" style={{marginTop: "0.5rem"}}>
                  <li><strong>Short Text</strong> — single-line input</li>
                  <li><strong>Long Text</strong> — multi-line textarea</li>
                  <li><strong>Yes / No</strong> — a dropdown with Yes and No options</li>
                  <li><strong>Multiple Choice</strong> — a dropdown with custom options you define</li>
                </ul>
                You can mark any question as required. Answers appear in the registrar table and CSV export.
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Confirmation Email Message</div>
              <div className="man-field__desc">A personal note included in the confirmation email — what to bring, where to park, a warm welcome, meeting link instructions, etc. Supports bold, italic, links, and bullet lists. Headings are not supported in email. Leave blank and no extra message is added.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Reminder Email Date</div>
              <div className="man-field__desc">On this date, the system automatically sends a reminder email to all confirmed registrants at 9:00 AM Central. Set it a day or two before the program starts.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Reminder Email Message</div>
              <div className="man-field__desc">The custom message in the reminder email — directions, what to bring, the Zoom link, etc. If blank, the reminder still goes out with the standard date/time/location info.</div>
            </div>
          </div>
        </section>

        {/* ── Programs: Dana & Payment tab ── */}
        <section id="prog-dana" className="man-section">
          <h2 className="man-section__title">Dana &amp; Payment tab</h2>
          <p>
            This tab controls how (or whether) dana is collected during registration. The Dana section of the Registration chapter covers how each mode works in full detail — here is the field reference.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Dana Mode</div>
              <div className="man-field__desc">
                Choose one:
                <ul className="man-list" style={{marginTop: "0.5rem"}}>
                  <li><strong>None</strong> — no dana step at all. Use for drop-ins and programs where you don&rsquo;t want to prompt for payment.</li>
                  <li><strong>Voluntary</strong> — a suggested amount is shown, but the member can change it to anything or skip it entirely. No obligation.</li>
                  <li><strong>Base + Dana</strong> — a required base fee plus an optional voluntary dana on top. Use for programs with real costs to cover.</li>
                  <li><strong>Fixed</strong> — a set price. Use for retreats with accommodation or other programs with a firm cost.</li>
                </ul>
              </div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Suggested Dana Amount</div>
              <div className="man-field__desc">Shown in Voluntary and Base + Dana modes. Pre-fills the dana input with this amount. The member can change it freely. Example: <em>25</em> for $25.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Base Amount</div>
              <div className="man-field__desc">Shown in Base + Dana mode only. The required fee that must be paid. The member cannot skip or reduce this — only the dana-on-top portion is voluntary.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Fixed Price</div>
              <div className="man-field__desc">Shown in Fixed mode only. The exact amount the member will be charged. No input — just a display and a checkout button.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Dana Step Message</div>
              <div className="man-field__desc">A short explanation shown on the dana step of the registration form — the intention behind this program&rsquo;s dana practice, or context about how funds are used. Keep it brief and warm.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Dana Info (Program Page)</div>
              <div className="man-field__desc">A one-line dana note displayed on the program detail page itself (not in the form). For example: <em>This program is offered on a dana basis.</em> Optional.</div>
            </div>
          </div>
        </section>

        {/* ── Programs: Dashboard tab ── */}
        <section id="prog-dashboard" className="man-section">
          <h2 className="man-section__title">Dashboard tab</h2>
          <p>
            The Dashboard tab controls how this program appears on the <strong>member dashboard</strong> — the page members see when they log in. This is separate from the public program page.
          </p>
          <p>
            Recurring programs like weekly sittings and ongoing classes appear on the dashboard as a persistent card, so members can see upcoming sessions and access the meeting link without re-registering each time. These settings let you add time-sensitive messages to those cards.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Special Announcement</div>
              <div className="man-field__desc">A short message displayed in <strong style={{color: "#b91c1c"}}>red</strong> on the program&rsquo;s dashboard card. Use this for urgent changes — a room change, a cancellation, a guest teacher. Clear it when the announcement is no longer relevant. Example: <em>Tonight&rsquo;s sitting is moved to Room B.</em></div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Early Arrival Message</div>
              <div className="man-field__desc">A short message displayed in muted grey below the program details on the dashboard card. Use this for persistent reminders — for example: <em>Please arrive 5–10 minutes early to get settled.</em></div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Remove from Dashboard Program List</div>
              <div className="man-field__desc">When checked, this program does not appear in the &ldquo;Upcoming Programs&rdquo; section of the member dashboard. Use for programs that are ongoing or not relevant to all members. The program page is still accessible by direct link.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Day Filtering</div>
              <div className="man-field__desc">Controls which day(s) of the week this program&rsquo;s dashboard card is visible — so members only see it on the days it actually meets. This is a text field used internally. Leave blank unless you have a specific reason to filter by day.</div>
            </div>
          </div>
        </section>

        {/* ── Programs: Sorting & Visibility tab ── */}
        <section id="prog-sorting" className="man-section">
          <h2 className="man-section__title">Sorting &amp; Visibility tab</h2>
          <p>
            This tab controls where the program appears in listings and what order it shows up in.
          </p>

          <div className="man-field-list">
            <div className="man-field">
              <div className="man-field__name">Day of the Week</div>
              <div className="man-field__desc">Select the day(s) this program meets. Used for grouping and sorting on the Programs &amp; Events listing page — programs are grouped by day of week. This is a reference to weekday documents, not a free-text field.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Sort Order</div>
              <div className="man-field__desc">A number that controls the order this program appears within its day group on the listing page and in the registrar area. Lower numbers appear first. Use round numbers — 10, 20, 30 — so you have room to insert programs between others later without renumbering everything.</div>
            </div>
            <div className="man-field">
              <div className="man-field__name">Hide from Programs &amp; Events Listing Page</div>
              <div className="man-field__desc">
                When checked, this program does not appear on the public <strong>/programs</strong> listing page. The program&rsquo;s own page is still accessible at its direct URL.
                <br /><br />
                Use this for programs that are invitation-only, in draft, or not meant to be discovered through the listing — for example, a private retreat or a staff-only program.
              </div>
            </div>
          </div>
        </section>

        {/* ── Programs: Common tasks ── */}
        <section id="prog-tasks" className="man-section">
          <h2 className="man-section__title">Common tasks</h2>

          <div className="man-task">
            <h3 className="man-task__title">Creating a new program from scratch</h3>
            <ol className="man-steps">
              <li>Go to Sanity Studio → <strong>Programs</strong> → click <strong>+</strong> to create.</li>
              <li>Enter the program name and generate the slug.</li>
              <li>Fill in the <strong>Content</strong> tab: tagline, image, description, and pull quote if desired.</li>
              <li>Fill in the <strong>Schedule &amp; Location</strong> tab: category (required for listing), teachers, date/time text, start datetime, and location.</li>
              <li>Fill in the <strong>Registration</strong> tab if this program needs registration.</li>
              <li>Fill in <strong>Dana &amp; Payment</strong> if this program collects dana or fees.</li>
              <li>Set the <strong>Sort Order</strong> in the Sorting &amp; Visibility tab.</li>
              <li>Click <strong>Publish</strong>. The program is now live on the website.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Updating dates for an upcoming program</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio.</li>
              <li>Go to the <strong>Schedule &amp; Location</strong> tab.</li>
              <li>Update the <strong>Date</strong> text field (what displays on the page) and the <strong>Start Date &amp; Time</strong> machine field (what generates calendar links).</li>
              <li>Click <strong>Publish</strong>.</li>
            </ol>
            <p className="man-task__note">If you&rsquo;ve already sent confirmation emails with the old date, consider sending a reminder with the corrected date, or reaching out to registered members directly.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Adding a special announcement to the dashboard</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio → <strong>Dashboard</strong> tab.</li>
              <li>Type the announcement in the <strong>Special Announcement</strong> field.</li>
              <li>Click <strong>Publish</strong>. It appears in red on the member dashboard immediately.</li>
              <li>Remember to clear and republish once the announcement is no longer relevant.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Hiding a program from the public listing</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio → <strong>Sorting &amp; Visibility</strong> tab.</li>
              <li>Check <strong>Hide from Programs &amp; Events Listing Page</strong>.</li>
              <li>Click <strong>Publish</strong>. The program disappears from the listing but its page is still reachable by direct link.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Linking a program to an online course</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio → <strong>Content</strong> tab.</li>
              <li>Click the <strong>Linked Courses</strong> field and search for the course by name.</li>
              <li>Select it and click <strong>Publish</strong>.</li>
              <li>From this point on, any member who registers for the program will automatically receive access to that course in the Members Area. Members who have already registered will need their access granted manually from the Admin member detail page.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Setting up a multi-session course with calendar recurrence</h3>
            <ol className="man-steps">
              <li>Open the program → <strong>Schedule &amp; Location</strong> tab.</li>
              <li>Set <strong>Start Date &amp; Time</strong> to the first session.</li>
              <li>Set <strong>Repeats</strong> — for example, Weekly.</li>
              <li>Set <strong>Every</strong> to 1 (every week) or 2 (every other week).</li>
              <li>If Weekly, check the <strong>On Days</strong> checkboxes for the days the program meets.</li>
              <li>Set <strong>Number of Sessions</strong> to the total count including the first. An 8-week course = 8.</li>
              <li>Click <strong>Publish</strong>. The .ics calendar download will now include all sessions.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Changing the sort order of programs</h3>
            <ol className="man-steps">
              <li>Open each program whose order you want to change.</li>
              <li>Go to <strong>Sorting &amp; Visibility</strong> tab.</li>
              <li>Update the <strong>Sort Order</strong> number — lower numbers appear first.</li>
              <li>Publish each one.</li>
            </ol>
            <p className="man-task__note">Use round numbers (10, 20, 30) so you can insert new programs between existing ones without renumbering everything.</p>
          </div>
        </section>

        {/* ── Future editions ── */}
        <section className="man-future">
          <h2 className="man-future__title">Future editions of this manual</h2>
          <p className="man-future__intro">
            The following chapters are planned and will be added as each area of the system is ready for documentation.
          </p>
          <ul className="man-future__list">
            <li>
              <strong>Member Accounts</strong> — how members sign in (magic link, no passwords), the onboarding flow, community agreements, the welcome page, account management, and what to do when someone has trouble accessing their account.
            </li>
            <li>
              <strong>Courses &amp; Online Materials</strong> — how course access is granted (automatic via registration, or manually by admin), the difference between open and registration-required courses, and how to grant or revoke access.
            </li>
            <li>
              <strong>Staff &amp; Roles</strong> — the difference between Admin and Registrar access, how to grant staff roles, how to invite someone to Sanity Studio, and what each role can and cannot do.
            </li>
            <li>
              <strong>Google Meet Integration</strong> — once built: how to generate a Google Meet link directly from Sanity Studio and have it appear in emails and on the program page automatically.
            </li>
          </ul>
        </section>

      </main>
    </div>
  );
}
