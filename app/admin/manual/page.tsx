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
            Registration is the process by which someone claims a spot in a program. When a program has registration enabled, a "Register" button appears on the program&rsquo;s page. Members and guests can fill out a short form — name, email, any custom questions the program requires — and their spot is confirmed instantly.
          </p>
          <p>
            The registration system is built into this website. There is no third-party form tool to manage. Everything is in one place: the registrar area at <strong>/volunteer</strong>.
          </p>
          <p>
            Registration is optional. Programs that don&rsquo;t need it — like open drop-in sittings — simply leave registration turned off. Those programs have no registration button and no list to manage.
          </p>
        </section>

        {/* ── 2. Member experience ── */}
        <section id="reg-member-exp" className="man-section">
          <h2 className="man-section__title">Member experience</h2>
          <p>
            Here is what a member or visitor sees when they register for a program:
          </p>
          <ol className="man-steps">
            <li>They visit the program&rsquo;s page and click <strong>Register →</strong></li>
            <li>They fill in their name and email address. If they have an account, their name is filled in automatically and locked — so their registration always shows their real name, not whatever they type in a hurry.</li>
            <li>If the program has custom questions (e.g. "Do you have any accessibility needs?"), those appear next.</li>
            <li>If the program has a dana or fee step, that appears at the end. They can complete it now or return to it later.</li>
            <li>They submit the form and receive a confirmation email within a few seconds.</li>
          </ol>
          <p>
            If the program is full, the button changes to <strong>Join Waitlist →</strong> and they are placed on the waitlist automatically. Their confirmation email tells them they are waitlisted and gives their position.
          </p>
          <p>
            Returning members who visit the program page after registering will see <strong>✓ You&rsquo;re registered</strong> instead of a button. If calendar dates are set for the program, they will also see links to add the event to Google Calendar or download a .ics file for Apple Calendar or Outlook.
          </p>
        </section>

        {/* ── 3. Your tools ── */}
        <section id="reg-your-tools" className="man-section">
          <h2 className="man-section__title">Your tools</h2>
          <p>
            As a registrar, your main workspace is <strong>/volunteer</strong>. From there you can:
          </p>
          <ul className="man-list">
            <li>See all programs that have registration enabled</li>
            <li>Click into any program to see its full registration list</li>
            <li>View each registrant&rsquo;s name, email, status, dana status, and any custom question responses</li>
            <li>Change a registrant&rsquo;s status (promote from waitlist, cancel a registration)</li>
            <li>Edit a registrant&rsquo;s custom question responses directly in the table</li>
            <li>Send a self-service edit link to a registrant so they can update their own responses</li>
            <li>Send an individual reminder email, or send a bulk reminder to everyone who hasn&rsquo;t received one yet</li>
            <li>Resend a confirmation email to any registrant</li>
            <li>Export the full registration list as a CSV file</li>
            <li>Add a note to any registration (visible only to staff)</li>
          </ul>
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
              <p>The person has a confirmed spot. This is the normal state for most registrants. The system sets this automatically when they submit the form and there is capacity available.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--approved">Approved</span>
              <p>Like Registered, but set manually by a registrar. Use this when you want to distinguish between self-registered and staff-approved participants — for example, in programs with a selection process. Both Registered and Approved count toward capacity.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--waitlisted">Waitlisted</span>
              <p>The program was full when they registered. They are in the queue. You can promote them to Registered or Approved when a spot opens up — the system sends them a promotion email automatically.</p>
            </div>
            <div className="man-status-card">
              <span className="man-status-badge man-status-badge--cancelled">Cancelled</span>
              <p>The registration has been cancelled — either by the member or by a registrar. Cancelled registrations do not count toward capacity. You can restore a cancelled registration by changing its status back.</p>
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
            Not every program uses dana. In Sanity Studio, each program has a Dana Mode setting:
          </p>
          <ul className="man-list">
            <li><strong>None</strong> — no dana step. The form skips it entirely. Most drop-in programs use this.</li>
            <li><strong>Voluntary</strong> — a suggested amount is shown, but the member can change it to any amount or skip it entirely. There is no obligation.</li>
            <li><strong>Base + Dana</strong> — there is a required base fee (to cover costs, for example) plus an optional voluntary dana on top.</li>
            <li><strong>Fixed</strong> — a set price. Used for programs with a firm cost, like a retreat with accommodation.</li>
          </ul>
          <p>
            The Dana Status column in your registrar table tells you where each person stands:
          </p>
          <ul className="man-list">
            <li><strong>Waived</strong> — no dana was expected for this program, or it was waived for this person.</li>
            <li><strong>Pending</strong> — dana is expected but has not been completed yet. The member can return to the program page at any time to complete it. You can send them a dana reminder email from the registrar table.</li>
            <li><strong>Completed</strong> — dana has been received via Stripe. The amount is recorded in the system.</li>
            <li><strong>Not Required</strong> — the person is on the waitlist. Dana is not collected until they are confirmed.</li>
          </ul>
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
              <div className="man-email-item__trigger">When someone registers</div>
              <div className="man-email-item__desc">
                A confirmation email goes to the registrant immediately. It includes the program name, date, time, location (if set), any custom confirmation message you wrote in Sanity Studio, and links to add the event to their calendar.
                <br />If the program is full and they are waitlisted, the email says so and gives their waitlist position.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a waitlisted person is promoted</div>
              <div className="man-email-item__desc">
                An approval email goes out automatically when you change their status from Waitlisted to Registered or Approved. If the program has a dana step, the email includes a link so they can complete their offering.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">When a registration is cancelled</div>
              <div className="man-email-item__desc">
                You (the registrar) receive a notification email at the registrar address. The member does not receive a cancellation email automatically — if you want to let them know, you can do so directly.
              </div>
            </div>
            <div className="man-email-item">
              <div className="man-email-item__trigger">On the scheduled reminder date</div>
              <div className="man-email-item__desc">
                If you set a Reminder Email Date in Sanity Studio, the system sends a reminder email to all confirmed registrants at 9:00 AM Central on that day. The email includes date, time, location, meeting link (if set), and any custom reminder message you wrote.
                <br />You can also send reminders manually from the registrar table — either to everyone or to individuals.
              </div>
            </div>
          </div>
          <p>
            You can resend a confirmation email to any individual registrant from the registrar table using the <strong>Resend Confirmation</strong> action. This is useful if someone says they never received it.
          </p>
        </section>

        {/* ── 7. Calendar links ── */}
        <section id="reg-calendar" className="man-section">
          <h2 className="man-section__title">Calendar links</h2>
          <p>
            When a program has a Start Date &amp; Time set in Sanity Studio, registered members will see two calendar links on the program page: one for Google Calendar and one for Apple Calendar or Outlook (downloaded as a .ics file). These same links also appear in the confirmation email.
          </p>
          <p>
            For programs that meet more than once, you can set a Recurrence Pattern in Sanity Studio:
          </p>
          <ul className="man-list">
            <li>Choose whether it repeats <strong>Daily</strong>, <strong>Weekly</strong>, or <strong>Monthly</strong></li>
            <li>Set the interval — for example, every 1 week or every 2 weeks</li>
            <li>For weekly programs, choose which days of the week</li>
            <li>Set the total number of sessions</li>
          </ul>
          <p>
            When a recurrence is set, the Apple/Outlook .ics file will include all sessions — members add the entire course to their calendar in one click. The Google Calendar link will show only the first session (this is a limitation of Google Calendar, not our system) — the link is labeled clearly so members understand this.
          </p>
          <div className="man-note">
            <strong>Tip:</strong> For a retreat that runs as one continuous block (for example, Friday evening through Sunday afternoon), leave Recurrence blank and simply set the Start Date &amp; Time to Friday evening and the End Date &amp; Time to Sunday afternoon. The calendar entry will span the full retreat.
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
              <li>Optionally set a <strong>Registration Deadline</strong> — the form will close automatically at that time.</li>
              <li>Add any <strong>Custom Registration Questions</strong> the program needs.</li>
              <li>Write a <strong>Confirmation Email Message</strong> — this is the personal note that goes out in the confirmation email. It might include what to bring, where to park, or a warm welcome.</li>
              <li>Go to the <strong>Schedule &amp; Location</strong> tab and set the <strong>Start Date &amp; Time</strong> so members get calendar links.</li>
              <li>Save the program. The Register button appears on the program page immediately.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Promoting someone from the waitlist</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the waitlisted person in the table.</li>
              <li>Click <strong>Promote</strong> next to their name.</li>
              <li>Their status changes to Registered and they receive an approval email automatically.</li>
              <li>If the program has dana, the approval email includes a link for them to complete their offering.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Cancelling a registration</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant in the table.</li>
              <li>Click <strong>Cancel</strong> next to their name and confirm.</li>
              <li>Their spot is freed and the waitlist moves up accordingly.</li>
              <li>You receive a notification email. The member does not receive an automatic email — contact them directly if appropriate.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Sending a reminder email</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>To send to everyone who hasn&rsquo;t received a reminder yet, click <strong>Send to Remaining</strong> in the banner at the top of the table.</li>
              <li>To send to one person, find them in the table and click <strong>Send Reminder</strong> next to their name.</li>
              <li>The email uses the Reminder Email Message you set in Sanity Studio, plus the program date, time, location, and meeting link.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Editing a registrant&rsquo;s responses</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Find the registrant and click the <strong>Edit</strong> button in their row.</li>
              <li>Update the field directly in the table and click <strong>Save</strong>.</li>
              <li>Alternatively, click <strong>Send Edit Link</strong> to email the registrant a secure link. They can update their own responses from that link — no account required.</li>
            </ol>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Exporting the registration list</h3>
            <ol className="man-steps">
              <li>Go to <strong>/volunteer</strong> and open the program.</li>
              <li>Click <strong>Export CSV</strong> at the top of the table.</li>
              <li>A spreadsheet downloads with all registrant information, including custom question responses. You can open it in Excel, Numbers, or Google Sheets.</li>
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
            <h3 className="man-task__title">Someone needs to update their registration responses</h3>
            <p>Either edit their responses directly from the registrar table, or click <strong>Send Edit Link</strong> to email them a secure self-service link. The link expires after 7 days.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">A program is full but you want to add someone directly</h3>
            <p>Have them register normally — they will be placed on the waitlist. Then immediately promote them from the waitlist. This keeps the capacity accounting accurate and still sends them the proper confirmation and approval emails.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">Someone on the waitlist cancels</h3>
            <p>Cancel their registration as normal. The spot opens up. Promote the next person on the waitlist manually — the system does not auto-promote.</p>
          </div>

          <div className="man-task">
            <h3 className="man-task__title">You want to register someone who doesn&rsquo;t want to do it themselves</h3>
            <p>You can fill out the registration form on their behalf. Use their email address. A confirmation email will go to them automatically. If they don&rsquo;t have an account yet, one will be created for them and they can sign in any time using a magic link to their email.</p>
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
              <strong>Member Accounts</strong> — how members sign in, the onboarding flow, community agreements, account management, and what to do when someone has trouble accessing their account.
            </li>
            <li>
              <strong>Courses &amp; Online Materials</strong> — how course access is granted, the difference between open courses and registration-required courses, and how to grant or revoke access manually.
            </li>
            <li>
              <strong>Staff &amp; Roles</strong> — the difference between Admin and Registrar access, how to grant staff roles, how to invite someone to Sanity Studio, and what each role can and cannot do.
            </li>
            <li>
              <strong>Site Content (Sanity Studio)</strong> — how to create and edit programs, courses, teachers, and other content. Includes a field-by-field guide to the Programs schema.
            </li>
            <li>
              <strong>Google Meet Integration</strong> — once built: how to generate a Google Meet link directly from a program page and have it appear in emails and on the program page automatically.
            </li>
          </ul>
        </section>

      </main>
    </div>
  );
}
