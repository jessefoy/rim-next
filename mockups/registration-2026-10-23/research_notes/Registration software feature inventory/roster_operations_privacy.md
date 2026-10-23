# Roster operations, sharing, privacy, check-in and registrar edge cases

Researched 2026-10-23. Every product claim below is from the vendor's own help docs unless marked otherwise. Several vendor pages could not be fetched (noted in Gaps); nothing has been filled in from memory.

## 1. Team permissions on rosters: roles, scope, and how products prevent over-sharing

### Takeaway
The products converge on three ideas: (a) a small set of named roles, from full admin down to "door/check-in only" and "read only"; (b) each role is granted **per event or per series**, not only account-wide; and (c) the most dangerous powers (**export, refunds, finances, sharing access onward**) sit above day-to-day roster work. None of the products documented here lets you restrict **individual question answers** by audience. RIM's planned per-question audience is ahead of the market, not copying it.

### Cited Findings
- **Tito (current role model)** has six roles. **Owner**: everything, including billing and sign-in policy. **Admin**: runs events, the account, payment settings and the team, but cannot do owner-only tasks. **Staff**: "day-to-day work: orders, attendees, check-in, badge printing, and messages", but **cannot do refunds, data export, or settings**. **Door**: check-in only. **Viewer**: reads the dashboard, orders, attendees and reports, and can change nothing. **Copy reviewer**: can only suggest wording. — [Tito: Team](https://go.tito.io/docs/account/team)
- Tito scopes each role to the **whole account, named series, named events, or "Every event"** (the last without account-wide settings). A person can hold several roles on different events, and the broader one wins where they overlap. "No role can do more than their role on Team." A hand-narrowed role shows as "Custom access" and "can only ever hold less than the role it came from." — [Tito: Team](https://go.tito.io/docs/account/team)
- Tito's older help-center model (Admin / Moderator / User / Read Only) withheld **financial report data and refunds** from "User". Which model applies depends on the account; the docs conflict. — [Tito help: adding your team](https://help.tito.io/en/articles/2002863-adding-your-team)
- **Humanitix**: owners share either **Full access** (all current and future events, "reserved by your closest team members") or **Restricted access** to selected events. Restricted access combines four permissions. **Event editing** includes refunds, cancellations and email campaigns. **Manage orders, attendees & email campaigns and in-app Box Office** is for registration helpers, who "cannot change events or see sensitive sales data". **Finances and reports** covers earnings and payouts. **Scanning app access** is for check-in. **Scanning-only users see the event only in the app, not in a browser.** Re-sharing access is off by default. Access is one-way and each person needs their own login. — [Humanitix: share event access](https://help.humanitix.com/en/articles/8892751-how-to-share-event-access-with-another-user-or-team)
- **Planning Center Registrations**: an organization-level **Administrator** sees and edits all signups. A **Manager** is added per signup and "cannot access any other signups". Managers' contact-information access covers "only attendees in signup". The guidance says access "depends on their role at your church" and that people outside the trusted circle "should be given lower permissions". The page does **not** say whether managers see form answers or medical answers. — [Planning Center: Permissions in Registrations](https://help.planningcenter.com/en/136860-permissions-in-registrations.html)
- **Planning Center Check-Ins** has **editor, viewer and headcounter** levels. A separate **Counter** permission lets a person (for example an usher) record headcounts "even if they don't have access to the Admin side of Check-Ins at all". — [Planning Center: Permissions in Check-Ins](https://help.planningcenter.com/en/permissions-in-check-ins.html); [Planning Center blog: Headcounts (2017)](https://www.planningcenter.com/blog/2017/05/introducing-headcounts-for-android-and-ios)
- **Eventbrite** offers **custom roles** built from a permission glossary, plus four defaults: Owner, Admin, **Check-in attendees**, and **Check-in attendees and guests**. Check-in-role members "must not have any additional roles or permissions." Attendee-related permissions are listed separately: "View list of attendees", "Add attendees", "Email attendees", "Manage orders, refunds, transfers and attendees", and "Check-in attendees". **"Basic reports" includes "Custom questions responses"**, and **audit data is only in "Advanced reports"**. — [Eventbrite: Permissions definitions](https://www.eventbrite.com/help/en-us/articles/362073/); [Eventbrite: custom roles](https://www.eventbrite.com/help/en-us/articles/509534/)
- In Eventbrite, custom-question answers travel with a whole report permission. No permission restricts **specific attendee fields**. (This is the search summary's reading; no per-field control appeared in the glossary.) — [Eventbrite: Permissions definitions](https://www.eventbrite.com/help/en-us/articles/362073/)
- **CiviCRM**: the core "view event participants" permission shows the participant list, but opening a participant record needs a contact **ACL**. The documented workaround is to put an event's participants in a group and grant ACL access to that group. An extension adds "view/edit **my** event participants", which scopes access to participants of events the user created. — [CiviCRM forum (archive)](https://forum.civicrm.org/index.php%3Ftopic=9164.0.html); [CiviCRM: View My Event Participants](https://civicrm.org/node/6307)
- **Retreat Guru**: no public documentation of staff roles or data permissions was found (see Gaps).
- **A Buddhist retreat-centre practice (Dhanakosa, Triratna)**: the office shares with the retreat team only what it "consider[s] relevant to the retreat teams' job". This typically includes retreat lists, previous contact, and "health and support needs". Retreat teams "do not have access to the Dhanakosa database or personal contact details", and **contact with retreatants goes through the office**. Follow-up email lists must be opt-in, and retreatants give their own addresses. — [Dhanakosa: Managing privacy and GDPR for retreat teams (2025)](https://www.dhanakosa.com/system/files/resources/Managing%20privacy%20and%20GDPR%20for%20retreat%20teams%202025.pdf)

### Inferences
- RIM's three-tier share (count only, names, names and contact) maps cleanly onto market practice. Count only matches Planning Center's headcounter/Counter. Names matches Tito Door and Eventbrite check-in with no export. Names and contact matches Tito Staff and the Humanitix "manage attendees" helper.
- The Dhanakosa model is a close peer: a Buddhist centre where the office (Registration) is the custodian, and teams get "relevant" lists including health and support needs, **but not contact details or the database**. It supports RIM defaulting teachers and teams to names-only, with contact through the registrar.
- Per-question audience (who may read each answer) has no direct counterpart in Tito, Humanitix, Eventbrite or Planning Center, which gate answers by whole-report permission. It is a real differentiator. It also needs careful defaults: an answer readable by **nobody but the registrar** unless marked otherwise.
- Common protections RIM can adopt: export and refunds kept above day-to-day roles; no onward re-sharing; per-person logins; scope by event or series; **check-in-only access that shows only what the door needs**.

**Features this implies**
- Roster share = (audience: team or teachers) × (level: count / names / names and contact) × (scope: this program, or this program's series of sessions).
- Per-question "who may read this answer" with a restrictive default (Registration team only). Show the audience to the registrant on the form.
- Export as a separate, higher permission (Registration team only), never part of a team share.
- A door view (names plus check-in, nothing else) that a greeter can use without seeing answers.
- No re-sharing: a team that receives a share cannot extend it.
- An "Access" panel per program listing who can see what, like Planning Center's Headcounters tab and Tito's "Custom access" badge.

### Gaps
- Retreat Guru's staff and data permissions: no public docs found in this pass.
- Whether Planning Center Registrations managers see custom-question or medical answers is undocumented on the permissions page.
- The Tito Pro "Data protection" section was linked from the Team page but not retrieved.
- CiviCRM's current (2026) ACL docs were not retrieved. The findings are from the forum archive and the extension page.

## 2. Privacy of sensitive registrant data for a small US nonprofit

### Takeaway
For a non-covered nonprofit, **HIPAA does not apply**. The governing ideas are FTC-style "collect less, keep less, limit access, plan for disposal", Wisconsin's breach-notice statute (narrow in scope), and good practice borrowed from GDPR and NIST. Several of these questions reveal **special categories** under GDPR: health, and religious belief, since registering at a Buddhist centre may itself imply it. Practitioner guidance says to tell people **why** you ask, **who** sees the answer, and to **delete it after the program**.

### Cited Findings
- **HIPAA scope**: the Privacy Rule "applies only to covered entities", meaning health plans, clearinghouses, and providers who transmit health information electronically in certain transactions. Health information held by a non-covered entity is generally outside HIPAA. — [HHS decision tool](https://www.hhs.gov/hipaa/for-professionals/special-topics/emergency-preparedness/source-not-covered-entity/index.html); [BDO: HIPAA for nonprofits](https://www.bdo.com/insights/industries/nonprofit-education/us-federal-privacy-landscape-for-nonprofit-organizations-hipaa)
- A nonprofit law firm advises that non-covered nonprofits **should not claim to be "HIPAA-compliant"**, though they can follow HIPAA-style practices. (Secondary source; summarised from search results.) — [Wagenmaker & Oberly: HIPAA and medical records for nonprofits](https://www.wagenmakerlaw.com/blog/hipaa-and-medical-records-for-nonprofits)
- **FTC, *Protecting Personal Information: A Guide for Business*** gives five steps: take stock, scale down, lock it, pitch it, plan ahead. If there is no legitimate need for sensitive personal information, **don't keep it, and don't collect it**. Keep it "only as long as it's necessary", under a written retention policy. Limit employee access on a need-to-know basis. (Contents confirmed through summaries; the FTC page itself was not fetched.) — [FTC guide (via Manatt summary)](https://manatt.com/insights/articles/2016/new-ftc-guide-offers-tips-for-protecting-personal); [FTC: Start with Security (Aug 2023 PDF)](https://www.ftc.gov/system/files/ftc_gov/pdf/920a_start_with_security_en_aug2023_508_final_0.pdf)
- **Wisconsin § 134.98** requires an entity that maintains personal information in Wisconsin to make reasonable efforts to notify affected people of unauthorized acquisition. It creates no private right of action. A 2022 law-firm map lists a **45-day** individual-notice deadline. — [Wis. Stat. 134.98](https://docs.legis.wisconsin.gov/statutes/statutes/134/98/3/a); [Troutman breach map (2022)](https://troutman.com/images/content/3/2/320387/Wisconsin-StateBreachNotificationMap.pdf)
- **GDPR as reference**: Article 9 "special category" data includes data revealing **religious or philosophical beliefs** and data **concerning health**. If a belief can be inferred "with a reasonable degree of certainty", Article 9 still applies. Special-category processing needs an Article 9 condition and potentially an "appropriate policy document" covering retention. The seven principles include **purpose limitation and storage limitation**. — [ICO: special category policy document](https://ico.org.uk/about-the-ico/our-information/safeguards-policy/policy-document-our-processing-of-special-categories-of-personal-data-and-criminal-offence-data/); [LegalVision: special category data](https://legalvision.co.uk/data-privacy-it/special-category-data/); [Research Live on ICO guidance](https://www.research-live.com/article/news/ico-publishes-new-special-category-data-guidance/id/5061632); [Tower Hamlets: seven principles](https://www.towerhamlets.gov.uk/FAQs/VCS-Resources/Data-protection/What-does-the-law-say.aspx)
- **NIST Privacy Framework** core functions: **Identify-P** (inventory data processing), **Govern-P** (policies), **Control-P** (manage data at fine granularity and honour individual preferences), **Communicate-P** (transparency about processing), and **Protect-P** (safeguards). (v1.0 wording; the v1.1 text was not retrieved.) — [NIST Privacy Framework v1.0 Core](https://www.nist.gov/document/nist-privacy-framework-version-1-core-pdf)
- **Question design**: GOV.UK's service manual says "make sure you know why you're asking every question". Help text can explain what you'll do with personal information, kept to about three lines. Allow "I'm not sure" where it is a valid answer. — [GOV.UK Service Manual: Designing good questions](https://www.gov.uk/service-manual/design/designing-good-questions)
- **W3C forms tutorial**: ask only for data the task needs. — [W3C WAI: Forms tutorial](https://www.w3.org/WAI/tutorials/forms/)
- **Exports and devices**: Tito withholds **data export** from its Staff role. Tito check-in devices by default receive **only the attendee reference**, so a lost device exposes no personal data. — [Tito: Team](https://go.tito.io/docs/account/team); [Tito: check-in day](https://pro.tito.io/docs/guides/check-in-day)
- **A Buddhist retreat centre's practice**: teams must ensure shared information "is not disseminated to other parties". Retreatants self-supply email addresses for any follow-up list, with an explicit statement that joining is optional and visible to everyone on the list. — [Dhanakosa (2025)](https://www.dhanakosa.com/system/files/resources/Managing%20privacy%20and%20GDPR%20for%20retreat%20teams%202025.pdf)

### Inferences
- RIM should not describe itself as "HIPAA-compliant". It should say plainly what it does: who sees each answer, how long it is kept, and that answers are deleted afterwards.
- The FTC's "don't collect it" test applies to each question. Every health, grief or trauma question should be justified by a concrete use: who acts on the answer, and how.
- Retention: answers to sensitive questions should have an automatic **purge after the program ends**, with a set grace period. Attendance and registration facts can be kept longer, since RIM needs history, but sensitive free-text should not linger. This follows FTC "pitch it" and GDPR storage limitation.
- Because registering at a Buddhist centre can reveal belief, even a **name on a roster** is sensitive under the GDPR reference model. That supports count-only as a real default level for teams that only need numbers, such as kitchen and hospitality.

**Features this implies**
- A per-question "why we ask / who sees it" line shown on the form, generated from the question's audience setting.
- Per-question sensitivity flag plus a retention rule, with automatic deletion of sensitive answers N days after the program, recorded in history ("answers cleared").
- Export restricted to the Registration team. Each export is logged (who, when, which columns). Exports default to excluding sensitive answers.
- Team views never cache sensitive answers on devices or in emails. Notification emails carry links, not answers.
- A short written retention policy page for registrants (FTC "plan ahead").
- Breach readiness: know which systems hold what (NIST Identify-P), so the Wisconsin notice duty can be met.

### Gaps
- Wisconsin § 134.98's definition of "personal information" was not retrieved verbatim. I could not confirm whether health data is covered; it is commonly understood not to be, but this is unverified here.
- NTEN and TechSoup guidance on nonprofit data privacy was not found in this pass.
- The FTC guide's current ftc.gov page was not fetched directly; its contents come from summaries and the 2023 PDF listing.
- No authoritative source was found on whether the FTC Health Breach Notification Rule could reach a nonprofit registration app. It targets vendors of personal health records, which is likely not RIM, but this is unverified.

## 3. Audit trails and activity history on registrations

### Takeaway
Enterprise registration tools keep a per-registration **history** (date, user, action, summary, with old and new values in some). Mass-market tools mostly keep audit data in reports, or not at all. Planning Center relies on **manual notes** and tells admins to email the registrant themselves after edits. For a 1-3 person team rotating volunteers, history is the shared memory.

### Cited Findings
- **Eventbrite**: "audit" data is available only under the **Advanced reports** permission. There is no separate audit permission. — [Eventbrite: Permissions definitions](https://www.eventbrite.com/help/en-us/articles/362073/)
- **Certain** has a per-registration **History tab listing each change with date, user, action and summary**, and lets planners **add their own history entries**. (From the search summary; the page returned 403 when fetched.) — [Certain: Registration History (Attendee)](https://platform-support.certain.com/hc/en-us/articles/30521115960855)
- **EventX** has a per-attendee activity log, available only for events created after 5 September 2024. **Cadence** shows a "View Log" for registration-form edits. **GetRegistered** has a Change Log with old and new values. (Search-summary level.) — [EventX: attendee activity logs](https://help.eventx.io/portal/en/kb/articles/view-attendee-activity-logs); [Cadence: track form edits](https://knowledge.eventcadence.com/p/UOnN7EmYEKtli2/How-to-track-and-log-Registration-Form-edits); [GetRegistered: Change Log](https://getregistered.helpscoutdocs.com/article/94-what-is-the-change-log-area-for)
- **Planning Center Registrations**: after saving changes to a registration, admins are told to **email the registration contact** about the changes. Each registration has a **Notes** section for recording details. No automatic change history was found. (Search summary; the help page 404'd on fetch.) — [Planning Center: edit attendee information](https://help.planningcenter.com/en/edit-attendee-information.html)
- **Planning Center permissions**: removing or downgrading someone's permissions **does not email them**, except that changes to organization administrators notify all organization administrators. — [Planning Center: Permissions in Registrations](https://help.planningcenter.com/en/136860-permissions-in-registrations.html)

### Inferences
- RIM's planned "per-registration history plus authored notes" matches the Certain model (system events plus human entries), which is the strongest pattern found.
- History should record: created (by self, by registrar on behalf, imported), status changes (pending payment, confirmed, waitlisted, offered, offer expired, cancelled, moved, transferred), dana and payment events, **every email sent** (template, recipient, time), edits to answers (who and when, but **not** the old sensitive value), check-ins, and shares and exports touching the roster.
- Notes need an audience, too. A note about grief or a health need is as sensitive as the answer itself. Notes default to the Registration team only.

**Features this implies**
- Registration timeline: system events plus authored notes, each with author and time.
- Program-level access log: shares granted or revoked, exports made.
- An "Email the registrant about this change?" prompt after a staff edit, since Planning Center leaves this manual.

### Gaps
- Tito, Humanitix and Retreat Guru per-registration history: no documentation found.
- Audit content in Eventbrite's "audit" report was not described in the glossary.

## 4. Check-in and attendance

### Takeaway
Door check-in is a distinct, **minimal-data role** in every product reviewed: Tito Door, Eventbrite Check-in, Humanitix scanning-only, and Planning Center headcounter. Good practice is a list filtered to what the door needs, devices that don't hold personal data, offline queueing, and live arrival counts. Zoom attendance is available through participant reports (join, leave, duration), but it has known quirks.

### Cited Findings
- **Tito check-in**: a default check-in list covers all ticket types. Lists can be **limited to specific ticket types** and configured for "what information appears after check-in". Each device is its own named **scanner**. Devices receive "only the reference by default", so a lost device exposes no attendee data. Check-ins are **queued offline** and synced. The dashboard shows **arrivals, remaining expected, and a breakdown by ticket type** in real time. — [Tito: check-in day](https://pro.tito.io/docs/guides/check-in-day)
- **Humanitix**: scanning-only collaborators see the event only in the Hosts app, not the web dashboard. — [Humanitix: share event access](https://help.humanitix.com/en/articles/8892751-how-to-share-event-access-with-another-user-or-team)
- **Eventbrite** "Check-in attendees" works online or in the Organizer app, manually or by scanning. Check-in default roles must hold no other permissions. — [Eventbrite: Permissions definitions](https://www.eventbrite.com/help/en-us/articles/362073/)
- **Planning Center Headcounts** records anonymous counts, usable by people with only the Counter permission. — [Planning Center blog: Headcounts](https://www.planningcenter.com/blog/2017/05/introducing-headcounts-for-android-and-ios); [Planning Center: Permissions in Check-Ins](https://help.planningcenter.com/en/permissions-in-check-ins.html)
- **Zoom participant reports** list **name, email, join time, leave time and duration**. Email appears only for users signed in to the same Zoom account. Only the meeting creator (or an admin) sees it, about 15 minutes after the meeting. Reports export as CSV. Someone who rejoins appears as **multiple rows**, and with a **waiting room** the join time can reflect waiting-room entry. — [Cornell IT: Zoom reports](https://it.cornell.edu/zoom/use-zoom-reports); [Monash: attendance report](https://www.monash.edu/learning-teaching/teachhq/learning-technologies/zoom/how-to/attendance-report-in-zoom); [Ithaca College](https://help.ithaca.edu/TDClient/34/Portal/KB/PrintArticle?ID=1050); [Tactiq (vendor)](https://tactiq.io/learn/zoom-attendance-report)

### Inferences
- RIM already gives each person their own join path into Zoom (per RIM_Zoom.md, via `/session/[slug]/enter`). RIM can record **"entered through RIM"** as its own attendance signal, rather than matching Zoom report names. That avoids the multiple-row and display-name problems. Zoom report reconciliation would be a secondary source if wanted. (Inference from the product context, not researched.)
- Recurring drop-in programs need **per-occurrence** attendance (who came to which Tuesday), not one check-in per registration. Headcount-only fits drop-ins where guests don't register.
- The greeter's view should be names plus a check-in toggle, plus any answer explicitly marked for greeters (for example "needs step-free entry"). No contact details, no other answers.

**Features this implies**
- Per-occurrence attendance: check in, undo, mark "came late or left early" for partial attendance.
- Door view: a searchable name list with a large check-in control, working at 360px. Add a walk-in from the door, which creates a minimal registration for the registrar to complete later.
- Headcount-only mode for open drop-in sessions (count, no names).
- Live counts: expected, arrived, not yet arrived.
- Online attendance from RIM's own Zoom entry links, with optional reconciliation against Zoom's participant report.
- Self check-in by QR is common at large events. For a small sangha, a greeter list is probably enough; this needs Jesse's call.

### Gaps
- Self check-in by QR code, and undo-check-in behaviour, were not documented on the Tito page fetched. No vendor source on self check-in was retrieved.
- Zoom's own support article on participant reports was not fetched; the findings come from university IT guides.

## 5. Registrar workflows and edge cases

### Takeaway
Documented vendor behaviour exists for waitlist offers (single-use, expiring links), capacity changes during an active waitlist, changing a ticket type, moving someone onto a full type, reassigning or transferring a place, and locking changes. Several edge cases (changing questions after answers, duplicates, archiving) were **not found** in vendor docs during this pass.

### Cited Findings
- **Staff-entered registrations**: Eventbrite has an explicit "Add attendees" permission for adding people manually. Humanitix offers an in-app **Box Office** under the "Manage orders, attendees…" permission. — [Eventbrite: Permissions definitions](https://www.eventbrite.com/help/en-us/articles/362073/); [Humanitix](https://help.humanitix.com/en/articles/8892751-how-to-share-event-access-with-another-user-or-team)
- **Transfers and name changes (Tito)**: attendees can by default **reassign their ticket** through the link in their confirmation email. The new holder gets an email to complete the ticket. Organisers can **lock changes**, including from a future date. If reassignment is disabled, the attendee must contact the organiser. — [Tito: how do I re-assign my ticket](https://help.tito.io/en/articles/3586025-how-do-i-re-assign-my-ticket); [Tito: lock changes on tickets](https://help.tito.io/en/articles/6075437-how-do-i-lock-changes-on-tickets)
- **Moving between types or sessions (Tito)**: an organiser can "Change ticket type". By default this "takes no money unless you say so". Moving someone onto a **fully booked** type is allowed with a warning. — [Tito: move an attendee to another ticket type](https://go.tito.io/docs/events/move-an-attendee-to-another-ticket-type)
- **Transfers and refunds (Eventbrite)** sit under one permission: "Manage orders, refunds, transfers and attendees". — [Eventbrite: Permissions definitions](https://www.eventbrite.com/help/en-us/articles/362073/)
- **Waitlist offers that expire (Tito)**: offers are made one at a time. Each carries a **single-use** link ("only usable once, so it cannot be shared") with an optional `{{expires}}`. After expiry "the link will display an error". **Raising capacity does not reopen sales while a waitlist exists**: the ticket "will not be available to register until the waiting list has been cleared." Rejecting people is **silent** ("will not be notified"). Waitlist-join alerts are off by default and set per teammate. — [Tito: Waiting lists](https://help.tito.io/en/articles/2003015-waiting-lists)
- **Humanitix** has a help article for people who accepted a waitlist offer only to find tickets sold out. This shows the offer-versus-capacity race is a real support case. (Title only; not fetched.) — [Humanitix: waitlist offer but sold out](https://help.humanitix.com/en/articles/12821601-i-received-an-offer-of-tickets-through-the-waitlist-but-the-tickets-are-now-sold-out)
- **Eventbrite** documents **manually releasing tickets to the waitlist**. (Title only.) — [Eventbrite: manually release tickets to the waitlist](https://www.eventbrite.com/help/en-us/articles/817355/)
- **Notifying after edits**: Planning Center tells admins to email the registrant themselves after changing a registration. — [Planning Center: edit attendee information](https://help.planningcenter.com/en/edit-attendee-information.html)

### Inferences
- Waitlist: when a place opens, offer it to one person, **hold** that place until the offer expires, then move to the next. This avoids the Humanitix race. Capacity increases should go to the waitlist first, as Tito does.
- Silent rejection (Tito) does not fit RIM's care ethic. When a waitlist closes, people should be told gently.
- Transfer and reassignment: on a free or dana program, letting a registrant hand their place to someone else is low-risk and kind. Lock it near the start, as Tito does, so rosters given to teachers are stable. The transferred registration should **clear the original person's answers**, since the new person answers for themselves.
- Moving between sessions should carry dana with it, and history should record the move. The Tito "no money unless you say so" default fits dana well.
- Changing questions after people have answered: no vendor doc found. The safe pattern is to keep answers bound to the question version they answered, flag "added after N people registered", and offer to ask existing registrants the new question.
- Duplicates: guests without accounts will re-register with a different email. A registrar-only "possible duplicate" hint (same name, same program) and a merge action are implied.
- Staff-entered registrations must be marked "entered by [registrar] on behalf of", and confirmations should go to the person when an email exists.

**Features this implies**
- Add a registration on someone's behalf (phone or paper), with source recorded.
- Edit, transfer to another person, and move to another session or occurrence, each with history and an optional email to the registrant.
- Cancel (by registrant or registrar), with a refund path where dana was paid by card (ties to RIM_Registration.md's Stripe flow).
- Waitlist: one-at-a-time offers with a hold, expiry and auto-advance. Capacity increases serve the waitlist first. Close the waitlist kindly.
- No-show marking after an occurrence, kept separate from cancellation.
- Close registration (manual, or at a date or capacity). Archive the program, which triggers retention of sensitive answers.
- Question versioning and a "possible duplicate" hint with merge.

### Gaps
- No vendor documentation was retrieved for: changing or adding questions after people have answered; duplicate detection and merge; archiving; partial attendance; registration changes when capacity is **reduced** below current registrations.
- Tito's reassign and lock-changes articles were read via search summaries, not full fetches.
- Refund policy mechanics were out of scope here (see RIM_Registration.md).

## 6. Accessibility of registration forms and inclusive question design

### Takeaway
W3C's forms tutorial sets the baseline: real labels, grouped controls, clear instructions, error messages that say how to fix the problem, multi-step forms with visible progress, and no time limits. Inclusive-question guidance agrees on **optional, explained, non-binary** pronoun and gender questions, and on asking only when there is a real use. Sources disagree on "Other" and on free-text fields.

### Cited Findings
- **W3C WAI forms tutorial**: label every control with `<label>`. Group related controls with `<fieldset>`/`<legend>`. Give instructions. Validate and **let users undo and confirm**. Report success and errors and explain how to fix them. Split long forms into steps with progress. Ask only for data the task needs. **Avoid time limits**, or let users extend them. Cites **WCAG 1.3.1, 2.4.6, 3.3.2 and 4.1.2**. — [W3C WAI: Forms tutorial](https://www.w3.org/WAI/tutorials/forms/)
- **GOV.UK**: know why you ask every question. Prefer several simple questions over one complex question. Brief help text (about three lines maximum) explains what happens to personal information. Allow "I'm not sure" where valid. — [GOV.UK: Designing good questions](https://www.gov.uk/service-manual/design/designing-good-questions)
- **Pronouns and gender**: make the field optional and explain why you ask. Separate pronouns, gender identity and legal sex. Avoid binary-only options. Sources **disagree** on "Other" (UBC: avoid it, add non-binary; Pacific University: allow "Other", "Prefer not to say" and custom). They also disagree on free text (ASE: best practice for gender; UBC: not recommended for statistics). — [USD: Guidelines for gender inclusive forms](https://www.sandiego.edu/student-affairs/documents/Guidelines%20for%20Designing%20Gender%20Inclusive%20Forms.pdf); [UBC Equity: Inclusive forms](https://equity.ubc.ca/resources/gender-diversity/inclusive-forms/); [Pacific University](https://www.pacificu.edu/node/47802); [ASE](https://www.aseonline.org/News/Articles/the-importance-of-inclusive-employment-forms); [Keshet: forms](https://keshetonline.org/resources/forms)

### Inferences
- If RIM asks for pronouns at all, the purpose is **addressing people** (name tags, the teacher's roster). So a pronoun field with common options plus write-in fits, without asking gender identity.
- Accessibility needs are best asked as an open, optional question ("Is there anything that would help you take part?") with an explained audience. This combines W3C "ask only what's needed" with GOV.UK "explain why".
- Dietary needs should be structured enough for the kitchen to count (vegetarian, vegan, gluten-free, allergies with write-in). Kitchen and hospitality should see **counts and allergy details**, not names, unless the registrant consents.
- Grief and trauma questions should be optional, with "prefer not to say" valid, and readable by the teacher only if marked. RIM's own guide forbids certain words ("free" and so on); copy for these questions needs Jesse's read-aloud.

**Features this implies**
- A question builder with types (choice, multi-choice with write-in, short text, long text) that renders accessible markup automatically: labels, fieldsets, errors beside the field. RIM's "answered where they look" rule already applies.
- Per question: required or optional (optional by default for sensitive questions), help text, an "I'm not sure / prefer not to say" option, and an audience line shown to the registrant.
- An aggregate view for teams like kitchen and hospitality: dietary counts plus allergy list without names.
- No session timeouts that drop a half-filled form. Save a draft or warn first.

### Gaps
- No authoritative (standards-body) source on accessibility-needs or dietary question wording was retrieved; the findings are practitioner guidance.
- WCAG 2.2 criteria relevant to forms (for example 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication) were not confirmed from the W3C page fetched. Check them directly before citing.
- Plain-language standards (plainlanguage.gov) were not retrieved in this pass.
