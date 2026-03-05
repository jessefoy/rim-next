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
            <a href="#registration" className="man-sidebar__link man-sidebar__link--active">
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
          <li className="man-sidebar__soon-group">
            <span className="man-sidebar__link man-sidebar__link--soon">Site Content</span>
            <span className="man-soon-badge">Coming soon</span>
          </li>
        </ul>
      </nav>

      {/* ── Main content ── */}
      <main className="man-content">

        {/* ── Chapter: Registration ── */}
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
            If a member has a pending dana offering — meaning they registered but haven&rsquo;t completed their gift yet — their dashboard homepage shows a reminder card with a link to complete it. This appears automatically and goes away once dana is received.
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
            You can also set a <strong>Suggested Dana Amount</strong> (for voluntary and base + dana modes) and a <strong>Dana Step Message</strong> — a short note explaining the dana practice for this particular program.
          </p>
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
                You (the registrar inbox at the registrar email address) receive a cancellation notification. The member does not receive an automatic email — if you want to let them know, reach out directly. The notification includes a link straight to the program&rsquo;s registrar table.
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
                Clicking <strong>Send Edit Link</strong> in the registrar table sends the registrant a secure, time-limited link. The email tells them which program it&rsquo;s for and that they can update their responses at any time before the link expires. The link is valid for 7 days.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a registrant updates via their edit link (to registrar)</div>
              <div className="man-email-item__desc">
                When a registrant submits their updated responses through the self-service link, you receive a notification email. It shows their name, the program, and what they changed — so you don&rsquo;t have to check the table to know something was updated.
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
            When recurrence is set:
          </p>
          <ul className="man-list">
            <li>The Apple/Outlook <strong>.ics file</strong> will include all sessions — members add the entire course to their calendar in one click.</li>
            <li>The <strong>Google Calendar link</strong> will show only the first session (this is a limitation of Google Calendar&rsquo;s add-event URL, not our system). The link is labeled &ldquo;first session&rdquo; so members understand this.</li>
          </ul>
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
              <li>Add any <strong>Custom Registration Questions</strong> the program needs. Each question has a type: Short Text, Long Text, Yes/No, or Multiple Choice.</li>
              <li>Write a <strong>Confirmation Email Message</strong> — this is the personal note that goes out in the confirmation email. It might include what to bring, where to park, or a warm welcome.</li>
              <li>Go to the <strong>Schedule &amp; Location</strong> tab and set the <strong>Start Date &amp; Time</strong> so members get calendar links in their confirmation.</li>
              <li>Save the program. The Register button appears on the program page immediately.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Promoting someone from the waitlist</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the waitlisted person in the table.</li>
              <li>Click <strong>Promote</strong> next to their name and confirm.</li>
              <li>Their status changes to Registered and they receive an approval email automatically.</li>
              <li>If the program has dana, the approval email includes a link for them to complete their offering. Their dana status is set to Pending.</li>
            </ol>
            <p className="man-task__note">The waitlist does not auto-promote when a spot opens. You promote manually.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Cancelling a registration</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant in the table.</li>
              <li>Click <strong>Cancel</strong> next to their name and confirm.</li>
              <li>Their spot is freed. The capacity count decreases.</li>
              <li>You receive a cancellation notification email. The member does not receive an automatic email — contact them directly if appropriate.</li>
              <li>To restore the registration, find them in the table and click <strong>Restore</strong>.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a reminder email</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>To send to everyone who hasn&rsquo;t received a reminder yet, click <strong>Send to Remaining</strong> in the banner at the top of the table.</li>
              <li>To send to one person, find them in the table and click <strong>Send Reminder</strong>.</li>
              <li>The email uses the Reminder Email Message you set in Sanity Studio, plus the program date, time, location, and meeting link.</li>
            </ol>
            <p className="man-task__note">The table shows &ldquo;Reminder sent [date]&rdquo; on rows that have been sent. You can re-send to the same person — it simply sends again and updates the timestamp.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a dana reminder</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant whose Dana Status is Pending.</li>
              <li>Click <strong>Send Dana Reminder</strong> next to their name.</li>
              <li>They receive an email with a link to return to the program&rsquo;s register page and complete their offering.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Editing a registrant&rsquo;s responses</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant and click the <strong>Edit</strong> button in their row.</li>
              <li>Update the field directly in the table and click <strong>Save</strong>.</li>
              <li>Alternatively, click <strong>Send Edit Link</strong> to email the registrant a secure link. They can update their own responses from that link — no account required. You receive an email notification when they submit changes.</li>
            </ol>
            <p className="man-task__note">Edit links expire after 7 days. If a link expires, send a new one.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Adding a note to a registration</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant and click the <strong>Edit</strong> button in their row.</li>
              <li>Add or edit the note in the Notes field.</li>
              <li>Save. The note is visible only to staff — it is never shown to the member and is not included in any email.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Exporting the registration list</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Click <strong>Export CSV</strong> at the top of the table.</li>
              <li>A spreadsheet downloads with all registrant information, including custom question responses, dana status, and notes. You can open it in Excel, Numbers, or Google Sheets.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Closing registration early</h3>
            <ol className="man-steps">
              <li>Open the program in Sanity Studio.</li>
              <li>Go to the <strong>Registration</strong> tab.</li>
              <li>Turn on <strong>Registration Closed</strong>.</li>
              <li>Save. The Register button disappears from the program page immediately.</li>
            </ol>
            <p className="man-task__note">You can also set a <strong>Registration Deadline</strong> to have the form close automatically at a specific date and time, without needing to remember to do it manually.</p>
          </div>
        </section>

        {/* ── 9. Edge cases ── */}
        <section id="reg-edge-cases" className="man-section">
          <h2 className="man-section__title">Edge cases</h2>

          <div className="man-task">
            <h3 className="man-task__title">Someone registers with the wrong email address</h3>
            <p>Ask them to re-register with the correct email. Cancel the incorrect registration. If they can&rsquo;t re-register (for example, the program is now full), promote them manually after they submit via the waitlist.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone didn&rsquo;t receive their confirmation email</h3>
            <p>Go to their registration in the registrar table and click <strong>Resend Confirmation</strong>. Ask them to check their spam folder. Confirm their email address is spelled correctly in the table.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone says their name is locked and they can&rsquo;t change it</h3>
            <p>
              The form recognizes their email and pulled their name from their account. This is intentional — it prevents mismatched names. If the name in their account is wrong, you can fix it directly in the registrar table using the Edit button. They can also update their profile at <strong>/account/my-profile</strong> once they&rsquo;re signed in.
            </p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone needs to update their registration responses</h3>
            <p>Either edit their responses directly from the registrar table, or click <strong>Send Edit Link</strong> to email them a secure self-service link. The link expires after 7 days. Send a new one if it has expired.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A program is full but you want to add someone directly</h3>
            <p>Have them register normally — they will be placed on the waitlist. Then immediately promote them. This keeps the capacity accounting accurate and sends them the proper confirmation and approval emails.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone on the waitlist cancels</h3>
            <p>Cancel their registration as normal. The spot opens up. Promote the next person on the waitlist manually — the system does not auto-promote.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">You want to register someone who doesn&rsquo;t want to do it themselves</h3>
            <p>You can fill out the registration form on their behalf. Use their email address. A confirmation email will go to them automatically. If they don&rsquo;t have an account yet, one will be created silently — they can sign in any time using a magic link to that email address. (They go to the sign-in page, enter their email, and receive a one-click login link — no password needed.)</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member who was previously archived re-registers</h3>
            <p>
              The system automatically restores their account when they register again. They will see the registration form normally (their email will be recognized and their name pre-filled). After submitting, their account is active again and they can sign in. No action is needed on your part.
            </p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member says they can&rsquo;t access their account</h3>
            <p>
              All sign-in at RIM is via <strong>magic link</strong> — there are no passwords. They go to <strong>/login</strong>, enter their email address, and receive a link to their inbox. The link is valid for a short time and signs them in with one click. If they don&rsquo;t see the email, ask them to check their spam folder. If their email address has changed, they&rsquo;ll need to re-register with the new address and contact an admin to link their history.
            </p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A member has pending dana but doesn&rsquo;t know how to complete it</h3>
            <p>
              Their dashboard homepage shows a reminder card with a link. You can also send them a dana reminder email directly from the registrar table. The link goes to <strong>/programs/[slug]/register</strong> for that program, where they&rsquo;ll see the dana step immediately and can complete it via Stripe (credit or debit card).
            </p>
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
              <strong>Courses &amp; Online Materials</strong> — how course access is granted (automatic via registration, or manual by admin), the difference between open courses and registration-required courses, and how to grant or revoke access.
            </li>
            <li>
              <strong>Staff &amp; Roles</strong> — the difference between Admin and Registrar access, how to grant staff roles, how to invite someone to Sanity Studio, and what each role can and cannot do.
            </li>
            <li>
              <strong>Site Content (Sanity Studio)</strong> — how to create and edit programs, courses, teachers, and other content. Includes a field-by-field guide to the Programs schema and tips for writing confirmation messages.
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
