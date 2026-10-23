# Participant communications in registration software: where the content lives, who manages it, and what a good system includes

Research date: 2026-10-23. Sources are vendor help centres, vendor training videos, and a small number of email-practice guides. **Source-quality notes:** items marked *(fetched)* were read on the page itself. Items marked *(search summary)* come from a search engine's summary of an official page that could not be fetched directly (several help-centre URLs returned 404 to the fetch tool). Treat those as likely but less certain. Mindbody and Wild Apricot documentation was thin; this is noted where it applies.

## 1. Where confirmation email content is set, and who can edit it

### Takeaway
In almost every product, the **system wording** (layout, order details, receipt) is fixed or global, and the **per-event message** is written **on the event/program setup screen**, next to the event's other settings. Rock RMS splits it in two: the reusable template holds the email bodies, and each instance (one dated run of the event) holds its own "confirmation details" and "reminder details" text. That is very close to RIM's current model.

### Cited Findings
- **Planning Center Registrations:** a custom confirmation message is written on the signup's own "Confirmation message" tab. Registrants get an email with their registration information, your message, a link to the signup on Church Center, and their registration details. *(search summary)* — [Planning Center: create a custom confirmation message](https://help.planningcenter.com/en/create-a-custom-confirmation-message.html)
- **Eventbrite:** in the event's dashboard, under Order options, choose "Order confirmation." From there you can edit the on-page message, the reply-to address, and the message that appears in confirmation emails and PDF tickets. For a recurring event, the change applies to all instances: "There is not a way to customize the order confirmation for a single instance." *(search summary)* — [Eventbrite help, article 3281](https://www.eventbrite.com/support/articleredirect?anum=3281)
- **Eventbrite:** the order confirmation is "sent when an order or registration is completed", organizers can customize it, and organizers receive copies, which they can turn off. *(fetched)* — [Eventbrite: What emails will attendees automatically receive?](https://www.eventbrite.com/help/en-us/articles/748624/)
- **Humanitix:** every buyer gets an order confirmation and hosts cannot turn it off. Most of its wording and layout is a fixed Humanitix default. Hosts add a custom message per event under Design & comms > Messages > Email message, and can set different messages per ticket type, for example to send different links to different groups. *(search summary)* — [Humanitix: Do ticket buyers receive a confirmation email?](https://help.humanitix.com/en/articles/9938796-do-ticket-buyers-receive-a-confirmation-email-for-their-purchase)
- **Tito:** sends an order confirmation that "includes a link to the order and receipt." All emails come from support@tito.io. Organizers can add a custom message to the emails. *(fetched)* — [Tito: What emails are sent to attendees](https://help.tito.io/en/articles/3673367-what-emails-are-sent-to-attendees). A per-ticket custom message can appear in the confirmation email, on the ticket page, and on the PDF ticket. *(search summary)* — [Tito blog: Quick Tricks #11, custom messages](https://blog.tito.io/posts/quick-tricks-11-custom-messages/)
- **Rock RMS (template level):** the confirmation, reminder, and payment-reminder emails are configured on the **Registration Template** (Tools > Event Registration > Registration Templates). The trainer says "most people leave this pretty stock" because the default body contains logic, for example the remaining balance and waitlist handling. The sender comes from the global email header. *(fetched, training video transcript)* — [Rock U: Registration Templates](https://chiptraining.rockrms.com/ask-chip-training/rocku/150)
- **Rock RMS (instance level):** each instance has a "Confirmation details" box, whose text appears in the confirmation/receipt, and a "Reminder details" box, for things like what to bring, plus a contact person. The contact person pre-fills and can be overridden. *(fetched, training video transcript)* — [Rock U: Registration Instances](https://chiptraining.rockrms.com/ask-chip-training/rocku/137)
- **CiviCRM:** the confirmation email text for online registration is set while configuring the event's online registration. The standard body is a "System Workflow Message Template" (Smarty) that admins edit globally. Different receipts per event require conditional logic on event_id in that template. *(search summary of archived forum, CiviCRM 3.x/4.x; current menu paths not verified)* — [CiviCRM forum archive](https://forum.civicrm.org/index.php%3Ftopic=34535.0.html)
- **CiviCRM extension (systopia eventmessages):** adds a "Communication" tab to each event's configuration, with message rules by participant status, role, and language, and lets you disable CiviCRM's default confirmation mails for that event. Rules use regular message templates. *(search summary)* — [systopia/de.systopia.eventmessages](https://root.packagist.org/packages/systopia/de.systopia.eventmessages)
- **Wild Apricot:** "event-specific instructions are added to event emails". Payment instructions for one event are set on that event's Ticket types & settings tab. The setup checklist says to customize the **templates** used as the basis for announcements and reminders. *(search summary of official help)* — [Wild Apricot: Event emails overview](https://gethelp.wildapricot.com/en/articles/31-event-emails); [Wild Apricot: Events setup checklist](https://gethelp.wildapricot.com/en/articles/88-events-setup-checklist). A chapter guide says reminder templates pull the "Additional event information to be inserted in registration confirmation email" field from the event description, so details like Zoom links reach only registrants. — [ATD NYC Wild Apricot reminder guide (2021)](https://assets.td.org/m/7524ef653cd7ff00/original/CHAP-SOS-2021-New-York-City-Manual-Event-Reminder-Email-in-Wild-Apricot-Instructions.pdf)
- **Retreat Guru:** a "Quick Add" confirmation option and the payment-notification and waitlist-notification emails are set under **Reg Settings > Email**. The waitlist email "is used for all programs." *(search summary)* — [Retreat Guru: Sending Emails](https://help.retreat.guru/knowledge/emails)
- **Mindbody:** booking confirmations and reminders run through account-wide "auto emails" and system settings. A third-party tutorial (German, unofficial) describes an enable checkbox, editable subject and body, placeholders, and a "Reservation Confirmation" type. No per-class content field was documented. *(search summary; weak sources)* — [Mindbody scheduling FAQ](https://www.mindbodyonline.com/en-gb/business/scheduling); [antwort.net Mindbody auto-email tutorial](https://www.antwort.net/a/tutorial/tutorial-so-erstellst-du-automatische-e-mails-auto-emails-in-mindbody.html)
- **Who edits (permissions):** Eventbrite gates attendee emailing behind a separate org permission: "make sure the account owner has given you permission to email attendees." *(fetched)* — [Eventbrite help, article 3327](https://www.eventbrite.com/support/articleredirect?anum=3327)

### Inferences
- The dominant pattern has two layers. **Global layer:** fixed system wording plus an admin-editable base template. **Event layer:** a free-text "message" or "details" slot authored where the event is set up. RIM's present design (template manager plus the program's Confirmation Message) matches this mainstream pattern.
- Rock RMS is the closest analogue to RIM: a church system with template, then instance, and the instance holds the reminder date, reminder details, and confirmation details. It keeps that per-run content **on the instance setup screen**, not in a separate communications area.
- Products aimed at class studios (Mindbody) push everything to the global layer. That fits recurring drop-in classes where every session is alike, and fits poorly with retreats or courses that need "what to bring."
- Only Eventbrite clearly separates *permission to email attendees* from *permission to edit the event*. That suggests a sensible split: authoring the standing message belongs with program setup, while sending ad-hoc messages is an operational right that could belong to the registrar team.

### Gaps
- Planning Center's confirmation-message help page returned 404 when fetched; its contents come from a search summary.
- Could not confirm in current docs which Planning Center or Wild Apricot roles may edit confirmation content.
- Mindbody's official help centre was not reachable; nothing authoritative on per-class confirmation text.
- Humanitix and Retreat Guru help pages were only seen through search summaries.

## 2. How reminders are scheduled (per event, relative to start, or fixed date) and who sends them

### Takeaway
Most products schedule reminders **relative to the event start** (Eventbrite 48 h; Wild Apricot "N days before"; CiviCRM before/after start or end). Rock RMS (date, optional time, per instance) and CiviCRM (optionally a specific date) also allow a **fixed date**. Several products (Tito, Humanitix) have **no automatic reminder** and expect the organizer to schedule a message. RIM's fixed "Reminder Date" at 9 AM matches Rock RMS. Relative timing is the more common default, and it handles recurring programs without per-occurrence setup.

### Cited Findings
- **Eventbrite:** includes a "48-hour reminder", sent two days before the event. Organizers can delete it before it sends, either to send none or to create their own. *(fetched)* — [Eventbrite: automatic emails](https://www.eventbrite.com/help/en-us/articles/748624/). For in-person events Eventbrite sets up one 48-hour reminder. For online events it sets up three: 48 hours, 2 hours, and 10 minutes before. You edit the message and reply-to under Manage attendees > "Emails to attendees." *(search summary)* — [Eventbrite help, article 3310](https://www.eventbrite.co.uk/support/articleredirect?anum=3310)
- **Eventbrite custom attendee emails:** send now or schedule for a future time. "Emails can be sent anytime while your event is live and up to 10 days after it ends." For recurring events, sends to all instances can only go immediately or at one fixed date and time. *(fetched)* — [Eventbrite help, article 3327](https://www.eventbrite.com/support/articleredirect?anum=3327)
- **Wild Apricot:** reminders go to registrants and guests a set number of days before the event, at the event's start time in its local time zone. The number is set on the event's Emails tab. *(search summary of official help)* — [Wild Apricot: Event emails overview](https://gethelp.wildapricot.com/en/articles/31-event-emails). A forum request confirms "the only method to schedule announcement and reminder emails is based on 'days before'", not by a specific date and time. — [Wild Apricot wishlist forum](https://forums.wildapricot.com/forums/308932/suggestions/10483149). Because hour-level timing isn't available, one chapter sends a manual "Starting Soon" reminder from Registrants & Invitees. They self-report attendance rising from about 40–50% to 50–60%. — [ATD NYC guide](https://assets.td.org/m/7524ef653cd7ff00/original/CHAP-SOS-2021-New-York-City-Manual-Event-Reminder-Email-in-Wild-Apricot-Instructions.pdf)
- **CiviCRM:** reminders can be set globally (Administer > Communications > Schedule Reminders) or on one event's Schedule Reminders tab; "any reminder set up from the event configuration screen applies only to that specific event." Options: a specific date ("it will be sent only on that date"), or before/after the event start or end, or relative to registration start or end. Recipients can be filtered by participant status and role, and there is a Repeat option. Reminders depend on a scheduled job that "runs at least once a day." *(fetched)* — [CiviCRM user guide: Scheduled reminders](https://docs.civicrm.org/user/en/latest/email/scheduled-reminders/)
- **Rock RMS:** each instance sets the date (and optionally the time) when its reminder email goes out. *(fetched, transcript)* — [Rock U: Registration Instances](https://chiptraining.rockrms.com/ask-chip-training/rocku/137)
- **Planning Center Registrations:** Event Reminder Emails launched 2024-04-24. You "schedule those reminders in advance", "a few weeks out or just a few hours" before, and can personalize messages for different attendee groups. The announcement does not say whether timing is relative or a fixed date. *(fetched)* — [Planning Center changelog: Event reminder emails](https://www.planningcenter.com/changelog/registrations/25147229735835-new-event-reminder-emails-have-arrived). The send-emails article lists targeted reminders: incomplete attendee info, balance due, and incomplete external form. *(search summary)* — [Planning Center: send emails](https://help.planningcenter.com/en/139345-send-emails.html)
- **Humanitix:** buyers do not automatically get a reminder. Hosts schedule them through the email campaigns tool, for example a week, a day, and an hour before. Campaigns should not carry promotional content. *(search summary)* — [Humanitix: Do ticket buyers automatically get an event reminder email?](https://help.humanitix.com/en/articles/8906262-do-ticket-buyers-automatically-get-an-event-reminder-email)
- **Tito:** checkout asks attendees whether they want a reminder, but Tito does not send automatic reminders. Organizers send them via Messages. Tito suggests one a few weeks out and a follow-up a few days before to anyone who hasn't completed their ticket. *(search summary)* — [Tito: How do I remind attendees to complete their tickets](https://help.tito.io/en/articles/2038102-how-do-i-remind-attendees-to-complete-their-tickets)
- **Late registrants:** Eventbrite: an "All attendees" send "will only be sent to people who are registered at the time it's sent." *(fetched)* — [Eventbrite article 3327](https://www.eventbrite.com/support/articleredirect?anum=3327). A Wild Apricot forum user reports the same for reminders. — [Wild Apricot forum](https://forums.wildapricot.com/forums/308932-wishlist/suggestions/19383577-event-reminder-sending-to-selected-registrants). CiviCRM's relative-to-start reminders instead reach anyone "who register[s] before the event ends." *(fetched)* — [CiviCRM scheduled reminders](https://docs.civicrm.org/user/en/latest/email/scheduled-reminders/)

### Inferences
- RIM's "send to registrants who haven't had it" is a real strength: it is CiviCRM-like behaviour that avoids the late-registrant hole Eventbrite and Wild Apricot users complain about.
- A relative offset ("N days before the first session"), with an optional fixed-date override, would match the majority pattern and remove a field the program editor must remember to fill for every run.
- Online events get more, and closer, reminders by default (Eventbrite 48 h / 2 h / 10 min), which matters for RIM's Zoom programs.

### Gaps
- Planning Center's exact reminder-timing model (relative vs fixed) is undocumented in what could be fetched.
- Whether Rock RMS sends reminders to people who register after the reminder date was not found.

## 3. Separating system wording from per-event content; reusable templates

### Takeaway
Three models appear: (a) **fixed system email plus a per-event message slot** (Humanitix, Eventbrite, Tito, Planning Center); (b) **reusable template plus per-instance text blocks** (Rock RMS, Wild Apricot); (c) **a template library copied into the event** (Retreat Guru, where later template edits do not propagate). Copy-on-insert is a known drift risk.

### Cited Findings
- **Humanitix:** most wording and layout of the confirmation "cannot be changed"; only a custom message is added, optionally per ticket type. *(search summary)* — [Humanitix confirmation email article](https://help.humanitix.com/en/articles/9938796-do-ticket-buyers-receive-a-confirmation-email-for-their-purchase)
- **Retreat Guru:** templates are created centrally under Settings > Emails, each with a name, subject, message, attachments, and a *context* (registration or rental) that controls which template codes are available. Templates are inserted while editing a program, sending bulk email, or emailing one participant from the edit-registration page. When inserted into a program, the content is **copied**; "later changes to the original template do not carry over", so the program's copy must be updated by hand. Templates can be grouped in categories. *(fetched)* — [Retreat Guru: Email templates](https://help.retreat.guru/knowledge/email-templates)
- **Rock RMS:** template-level email bodies with merge logic, instance-level "confirmation details" and "reminder details" text injected into them. Guidance is to leave template bodies "pretty stock." *(fetched)* — [Rock U 150](https://chiptraining.rockrms.com/ask-chip-training/rocku/150); [Rock U 137](https://chiptraining.rockrms.com/ask-chip-training/rocku/137)
- **Wild Apricot:** a global template is the basis for announcements and reminders, with event-specific instructions inserted. *(search summary)* — [Wild Apricot events setup checklist](https://gethelp.wildapricot.com/en/articles/88-events-setup-checklist). A user reports the API can't set per-event confirmation, cancellation, or reminder emails; the suggested workaround is cloning a template event. *(forum, unverified)* — [Wild Apricot developer forum](https://forums.wildapricot.com/forums/309658-developers/suggestions/42361822-api-create-event-reminder-emails)
- **Tito:** Pro docs say custom templates let you change the look and content of automated emails. The standard help centre instead describes turning off default emails and using webhooks to send your own. The two sources do not clearly reconcile. *(search summary)* — [Tito Pro: messaging](https://pro.tito.io/docs/messaging); [Tito: notification emails and webhooks](https://help.tito.io/en/articles/4684176-notification-emails-and-webhooks)
- **CiviCRM:** global System Workflow Message Templates; per-event variation via conditionals or an extension's per-event Communication tab. *(search summaries)* — [CiviCRM forum archive](https://forum.civicrm.org/index.php%3Ftopic=34535.0.html); [systopia eventmessages](https://root.packagist.org/packages/systopia/de.systopia.eventmessages)
- **Eventbrite, recurring events:** one confirmation setting covers all instances; per-instance customization is not possible. *(search summary)* — [Eventbrite article 3281](https://www.eventbrite.com/support/articleredirect?anum=3281)

### Inferences
- RIM's current design (global template manager holds wording, program supplies its message) is model (a)/(b), the sturdier one. Retreat Guru's copy model shows the drift that happens if per-program emails become full copies of templates.
- Rock's advice to keep template bodies "stock" because they carry logic (balances, waitlist) matches RIM's split: admins own the logic-bearing wording, program authors own a plain message.

### Gaps
- No product doc found that versions per-event messages or shows which version a registrant received.

## 4. What happens when content changes after people have registered

### Takeaway
No product documented automatic re-sending of an edited confirmation. The common tools are (1) a one-off "email attendees" send, (2) an automatic "event changed" notice for date/time/location changes (Eventbrite), and (3) a per-person resend. A queued Eventbrite email cannot be edited or cancelled.

### Cited Findings
- **Eventbrite** sends an automatic email when an event's date, time, or location changes. The article doesn't say whether organizers can control it. *(fetched)* — [Eventbrite automatic emails](https://www.eventbrite.com/help/en-us/articles/748624/)
- **Eventbrite:** "Once an email is sent or queued, you can't cancel or edit it." Attendee emails can be copied to make a new one. *(fetched)* — [Eventbrite article 3327](https://www.eventbrite.com/support/articleredirect?anum=3327)
- **Planning Center:** to reach all attendees, create a People list of attendees and email it. This requires People access. *(search summary)* — [Planning Center: send emails](https://help.planningcenter.com/en/139345-send-emails.html)
- **Wild Apricot:** registrants can be filtered and emailed from Registrants & Invitees with a chosen template, sent now or scheduled. *(chapter guide)* — [ATD NYC guide](https://assets.td.org/m/7524ef653cd7ff00/original/CHAP-SOS-2021-New-York-City-Manual-Event-Reminder-Email-in-Wild-Apricot-Instructions.pdf)
- **Retreat Guru:** a program's inserted template text does not update when the template changes. *(fetched)* — [Retreat Guru email templates](https://help.retreat.guru/knowledge/email-templates)

### Inferences
- An honest pattern for RIM: when a program's confirmation or reminder text, time, place, or Zoom link changes after registrations exist, the editor should warn that already-registered people won't see it, and offer "send an update to N registrants." Silently changing stored text is the failure mode none of these products solve automatically.

### Gaps
- No product documentation found for versioning or "resend updated confirmation to all."
- Planning Center's and Rock's per-person "resend confirmation" behaviour was not documented in the sources reached.

## 5. Message types a good system offers

### Takeaway
Across products, the full set is: confirmation/receipt; payment receipt and balance-due reminder; reminder(s); incomplete-info nudge; abandoned-registration follow-up; waitlist joined and waitlist offer (often with a claim deadline); refund/cancellation notices; event-changed notice; ad-hoc message to all or filtered registrants; post-event message. No single product documents all of them.

### Cited Findings
- **Eventbrite automatic emails:** order confirmation; 48-hour reminder; abandoned-registration reminder (logged-in users only); claim-ticket email (buyer ≠ attendee); refund confirmations and cancellation notices, including organizer-cancelled free orders and declined refunds; event-changed notice (date/time/location); "liked events" reminder; account and marketing emails. Some emails attendees "can't [disable] since they provide important information about orders and registrations." *(fetched)* — [Eventbrite automatic emails](https://www.eventbrite.com/help/en-us/articles/748624/)
- **Eventbrite waitlist:** the organizer releases spots from "Manage Waitlist"; the person gets an email link to register, and the organizer can set "the maximum amount of time someone on your waitlist has to claim a spot." *(search summary)* — [Eventbrite: How to set up an event waitlist](https://www.eventbrite.com/help/en-us/articles/811539). The marketing page says unclaimed offers pass automatically to the next person. *(vendor marketing)* — [Eventbrite waitlist feature](https://www.eventbrite.com/features/waitlist/)
- **Planning Center waitlist:** staff use Actions > notify for available capacity, which emails everyone on the waitlist with a register link, first come first served. No per-person "moved off the waitlist" email was documented. *(search summary)* — [Planning Center: waitlist](https://help.planningcenter.com/en/139349-waitlist.html); [Planning Center blog, Aug 2024](https://www.planningcenter.com/blog/2024/08/add-people-to-waitlists-for-any-registrations-event)
- **Planning Center reminders by state:** incomplete attendee info, balance due, incomplete external form. *(search summary)* — [Planning Center: send emails](https://help.planningcenter.com/en/139345-send-emails.html)
- **Retreat Guru:** payment notification email; waitlist notification email (one for all programs, containing a {{wait_list_reg_form}} link); abandoned-registration follow-up (enabled by support, with {{abandoned_reg_form_link}}); optional confirmation after staff "Quick Add." *(search summary)* — [Retreat Guru: Sending Emails](https://help.retreat.guru/knowledge/emails)
- **Rock RMS:** confirmation, reminder, payment reminder (manual or automatic to people with a balance). Waitlist handling is built into the template email logic. *(fetched / search summary)* — [Rock U 150](https://chiptraining.rockrms.com/ask-chip-training/rocku/150); [Rock community Q&A](https://community.rockrms.com/ask/using/1345)
- **Tito:** order confirmation; ticket updated; ticket gifted (reassigned); ticket added (staff-created order with "Notify" ticked). *(fetched)* — [Tito: emails sent to attendees](https://help.tito.io/en/articles/3673367-what-emails-are-sent-to-attendees)
- **CiviCRM:** reminders filtered by participant status (e.g. "registered and attended", "cancelled and no-show") and role, which enables post-event follow-ups to attendees vs no-shows. *(fetched)* — [CiviCRM scheduled reminders](https://docs.civicrm.org/user/en/latest/email/scheduled-reminders/)
- **Post-event:** Eventbrite allows attendee emails up to 10 days after the event ends. *(fetched)* — [Eventbrite article 3327](https://www.eventbrite.com/support/articleredirect?anum=3327). Webinar guides recommend a follow-up within 24 hours, with separate versions for attendees and no-shows. *(vendor blog)* — [WebinarNinja: webinar email sequence](https://webinarninja.com/blog/webinar-email-sequence/)

### Inferences
- Offers from a waitlist come in two forms: broadcast to the whole waitlist (Planning Center) or one person at a time with a claim deadline (Eventbrite). For a small sangha with capacity-limited retreats, an individual offer with a deadline is kinder and avoids a scramble.
- Status-aware sends (attended vs no-show, balance due, incomplete info) are where the registrar's operational view earns its keep. Those messages depend on registration state, not on program description.

### Gaps
- No documentation found for a distinct "pre-arrival / what to bring" message type as a built-in. Products handle it as reminder details (Rock) or a scheduled custom message (Humanitix, Eventbrite).
- Post-event survey features were not documented for the named products in the sources reached.

## 6. Communication history per attendee; preview and test-send

### Takeaway
Logging is uneven. Eventbrite shows scheduled, queued, and sent emails with recipients. CiviCRM records a "Reminder Sent" activity per contact if enabled. Preview and test-send is documented for Eventbrite and Tito. A per-attendee log showing every automatic email was not found for most products.

### Cited Findings
- **Eventbrite:** under Emails to attendees you can review scheduled, queued, and sent emails, view recipients, and copy an email. There is a live preview and a "send a test email to yourself" option. *(fetched)* — [Eventbrite article 3327](https://www.eventbrite.com/support/articleredirect?anum=3327)
- **CiviCRM:** tick "Record activity for automated email" to keep a record of who received a reminder; check with Find Activities > "Reminder Sent." *(fetched)* — [CiviCRM scheduled reminders](https://docs.civicrm.org/user/en/latest/email/scheduled-reminders/)
- **Tito Messages:** variables per recipient, preview, and a test to yourself before sending; access to Messages must be requested from Tito. *(search summary)* — [Tito: Messages](https://help.tito.io/en/articles/1994852-messages)
- **Retreat Guru:** staff can email a single participant from the edit-registration page using a template. *(fetched)* — [Retreat Guru email templates](https://help.retreat.guru/knowledge/email-templates)

### Inferences
- RIM already tracks "registrants who haven't had [the reminder]", which implies per-registration send state. Showing that on the registration ("Confirmation sent Oct 3 · Reminder sent Oct 20") would put RIM ahead of most of these products, and it supports the registrar's "Resend confirmation."

### Gaps
- Planning Center, Rock, Wild Apricot, Humanitix, and Mindbody per-attendee email history was not documented in the sources reached.

## 7. Calendar attachments, online join links, timing and deliverability guidance

### Takeaway
Guidance converges on: an immediate confirmation with calendar data and the join link, a reminder about 24 hours before, and a very short message about an hour before for online events, with the join button high in the email. Keep transactional mail (confirmations, reminders) separate from broadcast mail for deliverability. Join links are usually kept to registrant-only emails.

### Cited Findings
- **Join links stay with registrants:** Wild Apricot's "additional event information" field puts Zoom links only into registrant emails. — [ATD NYC guide](https://assets.td.org/m/7524ef653cd7ff00/original/CHAP-SOS-2021-New-York-City-Manual-Event-Reminder-Email-in-Wild-Apricot-Instructions.pdf). Humanitix: for fully online events, turn off "send tickets" and put the stream link in the confirmation email or the calendar description. *(search summary)* — [Humanitix help](https://help.humanitix.com/en/articles/8913822)
- **Online-event reminder cadence:** Eventbrite defaults online events to 48 h, 2 h, and 10 min reminders. *(search summary)* — [Eventbrite article 3310](https://www.eventbrite.co.uk/support/articleredirect?anum=3310)
- **Confirmation contents:** guides list a calendar entry (.ics or Google/Outlook buttons), the exact date and time with time zone, and a unique join link. 24 hours and 1 hour before is "a good rule of thumb." The 1-hour email should be the shortest, with the join button in the top third. *(vendor blogs; directional, not rigorous)* — [Omnisend: event reminder email](https://www.omnisend.com/blog/event-reminder-email/); [WebinarNinja: webinar reminder email](https://webinarninja.com/blog/webinar-reminder-email/)
- **Conflicting timing data:** WebinarGeek reports its strongest attendance for reminders sent within 24 hours but more than an hour before (46%), versus 39% for one hour before. *(vendor-reported, unverified)* — [WebinarGeek: how many reminder emails](https://www.webinargeek.com/learn/how-many-reminder-emails-should-you-send-before-a-webinar)
- **Wild Apricot's own advice:** a "3-email reminder formula" blog post. *(vendor marketing; not opened)* — [Wild Apricot blog](https://www.wildapricot.com/blog/how-we-increased-online-event-registrations-by-200-with-a-3-email-reminder-formula)
- **Deliverability:** Postmark keeps transactional and broadcast mail on separate streams with different IPs and From domains, because mixing them can make receiving clients "classify more time-sensitive emails as bulk marketing." Broadcast streams require an unsubscribe link; transactional streams do not. *(search summary of official Postmark pages)* — [Postmark: transactional vs marketing email](https://postmarkapp.com/blog/bulk-vs-transactional); [Postmark: message streams](https://postmarkapp.com/message-streams)
- **Keep reminders non-promotional:** Humanitix says campaign/reminder emails should not carry promotional content. *(search summary)* — [Humanitix reminder article](https://help.humanitix.com/en/articles/8906262-do-ticket-buyers-automatically-get-an-event-reminder-email)
- **Sender identity:** Humanitix and Tito send from a fixed platform address (Humanitix lets a host profile change the sender *name*). Rock uses the global email header. *(search summary / fetched)* — [Humanitix reminder article](https://help.humanitix.com/en/articles/8906262-do-ticket-buyers-automatically-get-an-event-reminder-email); [Tito emails](https://help.tito.io/en/articles/3673367-what-emails-are-sent-to-attendees); [Rock U 150](https://chiptraining.rockrms.com/ask-chip-training/rocku/150)

### Inferences
- For RIM's Zoom programs, a fixed 9 AM reminder on one chosen date is coarser than the norm. A day-before reminder plus a short "starting soon" email with the room link would match practice. An .ics in the confirmation is standard.
- Ad-hoc "message all registrants" sends are transactional-adjacent (about a registration the person made), but heavy use would look like broadcast. Keeping them factual (changes, logistics) protects deliverability.

### Gaps
- Nielsen Norman Group and Litmus guidance specific to event reminders was not found within the search budget.
- Which of the named products attach an .ics file to confirmations could not be confirmed from their own docs. Eventbrite "add to calendar" links were seen only on unreliable third-party pages, which were excluded.
