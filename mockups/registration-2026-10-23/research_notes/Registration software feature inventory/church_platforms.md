# Church and faith-community management platforms: registration/signup features

Scope note: researched 2026-10-23 from official help centers. Planning Center (help.planningcenter.com) and Rock RMS (community.rockrms.com/documentation) are public and were read article by article. Realm (help.acst.com) and ChurchTrac (churchtrac.com/support) are public and were partly read. **Breeze (support.breezechms.com), Elvanto/Tithely (help.elvanto.com) and Pushpay ChMS (support.pushpay.com) returned HTTP 403 or a JavaScript-only portal to the fetch tool**, so their findings come from search-result summaries of their official help articles. Those are marked "(search summary)" and are less reliable than the read-in-full items.

Abbreviations: PCO = Planning Center Registrations; "Church Center" = PCO's public site/app for members.

## 1. What features does each product support (concrete list)?

### Takeaway
Planning Center and Rock RMS have by far the deepest registration modules: per-person forms, typed selections with capacity, add-ons/fees, discounts, deposits, waitlists, staff-entered registrations, notes, transfers/moves, assignments/group placement, check-in integration, automations and audit/communication history. Realm sits in the middle. ChurchTrac, Breeze, Elvanto and Pushpay ChMS are mostly "a form attached to an event" with payments and a few limits. ChurchTrac is the only one documented with a built-in **donation-style "Ask for a Donation" payment mode with a suggested amount**, which is the closest match to dana.

### Cited Findings

#### Planning Center Registrations (deep)

Signup structure and types
- Two signup types: **Named Attendees** collects details from every individual through questions and add-ons; **Simple Count** collects only a headcount and information about the registration contact — [PCO: Create a signup](https://help.planningcenter.com/en/create-a-signup.html) (search summary)
- Signup About tab: description, dates, times, image, location, category, managers — [PCO: Introduction for administrators](https://help.planningcenter.com/en/139243-introduction-for-administrators.html)
- **Selection types** (each signup starts with "Standard"): name, optional per-attendee price ($0 shows as "free"), description, "Available to" restriction by grade/gender/age (Named Attendees only), which personal-info fields to collect (each optional or required; Emergency Contact is stored only in the signup), a per-selection custom confirmation message, "Show on Church Center" (unchecked = hidden publicly, but admins can still register people into it), allow partial payments, max selections per registration, split registrations (one registration across several dates/times; simple count only), capacity, waitlist — [PCO: Create selection types](https://help.planningcenter.com/en/139327-create-selection-types.html)
- **Capacity**: a signup-wide total (takes precedence even if smaller than the sum) and per-selection-type capacities; free selections show "full", priced ones "sold out"; administrators can override capacity when registering people, and the total rises to include them — [PCO: Capacity for signups](https://help.planningcenter.com/en/139348-capacity-for-signups.html)
- **Hold timer**: with a capacity, registrants get 15 minutes per section (Selections, Attendees, Additional attendee info, Registration questions), resetting per section; with no capacity, 48 hours — [PCO: Collecting information with signups](https://help.planningcenter.com/en/139330-collecting-information-with-signups.html); [PCO: Capacity](https://help.planningcenter.com/en/139348-capacity-for-signups.html)

Settings, visibility, URL
- Church Center availability: Now / on a specific date-time / "Do not include (direct link only)"; direct-link signups still accept registrations; "Automatically hide from signups page"; "Featured" pins to top — [PCO: Change signup settings](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- Registration status: Open / Scheduled to open / Closed (still visible, no registering) / "Close registration automatically" after the event date — [same](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- "Congregants can cancel their own registrations" toggle — [same](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- Registrant options: collect phone and address (optional/required); household members during registration: Always / Only if they don't have a household yet / Never; "Register others outside their household" (creates a duplicate profile if the person already exists); "Require login" (forced on when personal info or payments are collected) — [same](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- Payment methods: card (default), bank account (only if saved beforehand), cash or check (lets people skip a required deposit; admins apply it later), Apple Pay / Google Pay — [same](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- Support contact shown in "Need help?" on Church Center; **Subscribers** receive a daily digest of new registrations, cancellations and partial payments — [same](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- Every public signup appears on Church Center with a personalized URL; admins test by registering themselves then deleting — [PCO: Introduction for administrators](https://help.planningcenter.com/en/139243-introduction-for-administrators.html)
- PCO "does not act as a kiosk" for registration — [PCO: Register people for a signup](https://help.planningcenter.com/en/139336-register-people-for-a-signup.html)

Forms and questions
- Layers of data collection: selection types (per attendee); **registration questions** (up to five, asked once of the registration contact); **attendee questions** (per attendee, required/optional, can be shown only for certain selections); **add-ons** (per attendee, with cost and/or capacity); **attendee information form** (per attendee, outside the 15-minute timer, conditional on selection); **People forms** (conditional logic, file/image uploads, workflow routing); **external forms** (linked or PDF, e.g., signatures; nothing saved in PCO) — [PCO: Collecting information](https://help.planningcenter.com/en/139330-collecting-information-with-signups.html)
- Personal-info fields update the People profile immediately; event questions stay event-specific — [same](https://help.planningcenter.com/en/139330-collecting-information-with-signups.html)
- Answers to attendee questions, the info form and add-ons can be used to filter attendees — [same](https://help.planningcenter.com/en/139330-collecting-information-with-signups.html)

Money
- **Partial payments/deposits**: set per selection type and add-on with a minimum deposit, paid online before completing the form; attendees can pay full, deposit or a specific amount; balance is paid later through a link in the confirmation email; cash/check option lets them skip the deposit — [PCO: Partial payments](https://help.planningcenter.com/en/139366-partial-payments.html)
- Registering without paying online: allow partial payments with a $0 deposit — [PCO: Introduction for administrators](https://help.planningcenter.com/en/139243-introduction-for-administrators.html)
- **Discounts**: Code (one per attendee, larger wins), Group (minimum group size; all or only beyond the minimum), Early bird (crossed-out price until expiry); percent or flat; expiry date; limited to selection types; optionally applies to add-ons; group/early-bird automatic and not removable, codes can be added/removed by staff — [PCO: Discounts](https://help.planningcenter.com/en/139372-discounts.html)
- **Scholarships** applied as payments to registrations; money returns to the scholarship total on cancel — [PCO: Introduction for administrators](https://help.planningcenter.com/en/139243-introduction-for-administrators.html); [PCO: Refund payments](https://help.planningcenter.com/en/139369-refund-payments.html)
- Refunds: manual, partial or full, from the registration; by method: cash (note + initials), check (number), card (up to original; 5–7 days), ACH, scholarship, "Other" (move funds to another registration); original processing fees not returned; refunds come from pending payout balance — [PCO: Refund payments](https://help.planningcenter.com/en/139369-refund-payments.html)
- Payments page and per-signup Payments tab; CSV export per signup or across all signups — [PCO: Create reports on attendees](https://help.planningcenter.com/en/139346-create-reports-on-attendees.html)
- No documented "pay what you want"/donation pricing mode was found in PCO docs read. (See Gaps.)

Organizing, reporting, automations
- **Assignments**: types (e.g., Cabins) with areas (e.g., Oak); one area per type per attendee; each area has capacity and restrictions (gender/age/grade/selection); auto-assign Waterfall or Balanced; manual; admin override of restrictions; admin-only (attendees can't see); reports "by area", "by attendee", CSV — [PCO: Use assignments](https://help.planningcenter.com/en/139341-use-assignments-to-organize-attendees.html)
- Reports: **Overview** (capacity used/remaining per selection, payments/refunds by type, add-on counts and dollars, answer totals for dropdown/checkbox questions), **Guest list** (current attendees with emergency contact, form status, amount owed; printable/PDF, "offline version of the Registrations tab"), **CSV export** with selectable fields — [PCO: Create reports on attendees](https://help.planningcenter.com/en/139346-create-reports-on-attendees.html)
- Registration status dots: green = complete, yellow = incomplete (unanswered questions, pending forms, balances due) — [PCO: Register people for a signup](https://help.planningcenter.com/en/139336-register-people-for-a-signup.html)
- **Automations** tab per signup: on register or cancel, act in other products (e.g., add to a group; remove on cancel); can target attendee or registration contact; can be limited to selection types (since April 2024); pause toggles; automation history with Ignored status — [PCO: Automations in Registrations](https://help.planningcenter.com/en/144358-automations-in-registrations.html) (search summary); [PCO changelog](https://www.planningcenter.com/changelog/registrations/16692169188635-new-automations-in-registrations)
- People Lists can use a Registrations rule ("named attendee for" / "registration contact for" an event) for mass email or Mailchimp — [PCO: Send emails](https://help.planningcenter.com/en/139345-send-emails-to-registration-contacts-and-attendees.html)

Permissions
- Two levels. **Administrator**: all signups, all payments, create signups, categories, duplicate/delete events, auto-contributor everywhere. **Manager**: only signups they are added to as contributors; can edit registrations and payments there; sees contact info only for that signup's attendees; cannot create signups or manage categories — [PCO: Permissions in Registrations](https://help.planningcenter.com/en/136860-permissions-in-registrations.html)
- Managers can add registrations, take attendance, email attendees, create/export reports, do assignments, set automations — [PCO: Introduction for managers](https://help.planningcenter.com/en/139244-introduction-for-managers.html)
- Viewing the Communications tab in Registrations requires People access — [PCO: View communication history](https://help.planningcenter.com/en/188711-view-communication-history-in-registrations.html)

#### Rock RMS (open source; deep public docs)
- Model: **Template** (most settings: costs, fields, fees) → **Instance** (event-specific: registration start/end dates, contact) → **Registration** (one submission, entered by a **Registrar**) → **Registrants** (people registered; registrar and registrant may differ, e.g., parent registering children) — [Rock: Intro to Event Registrations](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/intro-to-event-registrations)
- Template settings: category (organizes and secures), active flag; group linkage (group type, member role/status) and notify recipients (registration contact, group followers, group leaders); allow multiple registrants + max per registration; login required; **prevent duplicate registrations** (with a privacy warning that it can reveal attendance); registrar options (prompt / prefill first registrant / use first registrant / use logged-in person); family handling; SMS opt-in checkbox; connection status and record source for new people; add person timeline note — [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- Form fields: source = person field, person attribute, group-member attribute, or registrant attribute; internal (staff-only) fields; "common value" copied to later registrants; "use current value" prefill; required; show on grid; **lock existing value**; pre/post HTML; conditional display — [same](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- **Eligibility criteria**: age range, age classification, grade range, gender, data view — [same](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- Registration attributes (whole-registration questions), placed at start or end, with staff-only security — [same](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- Cost at template or instance level; payment gateway; batch prefix; **minimum initial payment** (blank = full payment); default payment amount; **payment plans** with selectable frequencies and a payment deadline — [same](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates); [Rock: Registration Finances](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)
- Registration workflow and registrant workflow triggers; **required signature document** (inline e-signature); "Allow external updates to saved registrations" — [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- **Fees**: four types (single option, single with quantity, multiple options, multiple with quantity); per-fee "Maximum Available" capacity per instance; hide when none remaining; required; discount applies flag — [Rock: Registration Finances](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)
- **Discounts**: codes (percent or amount), quantity (min/max registrants), early bird (effective dates), combined criteria, automatic (first qualifying wins; a code overrides), max usage; only one per registration; post-registration discount codes entered by the registrant — [same](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)
- Instance tabs: Registrations, Registrants, Payments, Fees (export to Excel), Discounts (usage, export), Linkages (calendar, groups, campus), Wait List — [Rock: Manage Event Registrations](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/manage-event-registrations)
- **Event Registration Matching** (Finance): match transactions from an open batch to registrations — [Rock: Registration Finances](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)
- "Recent Registration" block on My Account: shows recent/future/balance-due registrations; pay a balance; apply a discount code — [same](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)

#### Realm (ACS Technologies)
- Custom questions (text, date, yes/no, multiple choice); registration types (e.g., adult/child) each with its own cost; additional items (e.g., workbooks) purchased with registration; discounts; online payments and refunds; "Allow Guests" (signed-in registrants add guests); family members shown to signed-in users; public link — [Realm: Registration Events](https://help.acst.com/en/realm/how-to/registration-events)
- Each registration type can have **its own maximum** and its own public/not-public status (e.g., staff free, children paid) — [Realm: Types of Registrants](https://help.acst.com/en/realm/how-to/registration-events/types-of-registrants)
- Payment settings: payment message, **refund cutoff date**, accounting settings/fund; partial payments with minimum deposit at registration (search summary) — [Realm: Choose Payment Settings](https://help.acst.com/en/realm/how-to/registration-events/paid-registration-events/choose-payment-settings-for-registration-events)
- Events can be public, hidden, featured, shared by link or QR code; recurring and multi-day registration events; event tags — [Realm: Registration Events](https://help.acst.com/en/realm/how-to/registration-events)
- Guest (no-login) registration through the public form — [Realm/Connect: Register for a Paid Event as a Guest](https://help.acst.com/en/connect/connect-app-for-web-browsers/congregant-event-registration/register-for-a-paid-event-as-a-guest) (search summary)

#### ChurchTrac
- Three registration types: **Individual** (self only), **Headcount** (number attending by attendee type, no per-person detail), **Multiple Attendees** (form per person) — [ChurchTrac: Creating and Editing Registrations](https://www.churchtrac.com/support/events/creating-and-editing-registrations)
- **Attendee types** (e.g., Adult/Child) each with a cost; dropdown appears only with 2+ types — [ChurchTrac: Attendee Types and Cost](https://www.churchtrac.com/support/events/attendee-types-and-cost)
- Payment modes: Don't Ask For Payment (default); **Flexible Payment** (pay now or later; staff set when later payments are due; balance shown to members); Payment Required; **Ask for a Donation** (registrant chooses amount; staff set a maximum and a suggested amount; "Pay Later" skips, "Pay Now" pays suggested or edited amount; docs advise telling participants payment is not required) — [same](https://www.churchtrac.com/support/events/attendee-types-and-cost)
- **Max Amount per Registration** (family cap) — [same](https://www.churchtrac.com/support/events/attendee-types-and-cost)
- Payment category assignment for accounting; card only (no ACH) — [same](https://www.churchtrac.com/support/events/attendee-types-and-cost)
- Custom questions, import questions from a previous event, pre-built fields; who can register: Anyone (name + email auto-added) or Connect users only; event URL and QR code; enabling registration removes recurrence (clone instead) — [ChurchTrac: Registrations Overview](https://churchtrac.com/support/events/registrations-overview)
- "Show Additional Guests Field" with running total of registrants plus guests — [ChurchTrac: Event Registrations](https://www.churchtrac.com/support/events/event-registrations) (search summary)

#### Breeze ChMS (search summaries; site blocked the fetch tool)
- Event registration is done with Breeze **Forms** attached to events; a Registration form template includes name, email, phone, address and a payment option; responses can be linked to a profile — [Breeze: Getting Started with Forms](https://support.breezechms.com/hc/en-us/articles/360051061653-Getting-Started-with-Forms)
- Form **max entries** (in "Show More Options"): the form disables itself when reached; **no per-option limits** — [Breeze: Limit Event Sign Ups Using Forms](https://support.breezechms.com/hc/en-us/articles/22084294405655-Limit-Event-Sign-Ups-Using-Forms)
- Payment fields: fixed amount, blank (submitter enters an amount), or zero (supports "Pay Later"); payments grouped by form under Giving > Batches — [Breeze: Accepting Payments on Forms](https://support.breezechms.com/hc/en-us/articles/360001326413-Accepting-Payments-on-Forms)
- rsvp.church companion tool for service-time/room pre-registration with capacity limits and confirmation email — [Breeze: Running Events Using rsvp.church](https://support.breezechms.com/hc/en-us/articles/360048698953-Running-Events-Using-rsvp-church-and-Breeze)

#### Elvanto / Tithely (search summaries; site blocked the fetch tool)
- Event Registration tab: enable registration, link or create a form; multiple **tickets**, each with its own price and registration limit; registration URL from "View Form" — [Elvanto: How to Share Your Event Registration](https://help.elvanto.com/hc/en-us/articles/22570760122135-How-to-Share-Your-Event-Registration); [Elvanto: How to Create an Event](https://help.elvanto.com/hc/en-us/articles/7622437988503)
- Alternative: a standard form for non-ticketed signups, with optional **approval before joining the guest list** and one-or-many submissions per person (no invoices/tickets) — [Elvanto: Recording Event Attendance using Standard Form](https://help.elvanto.com/hc/en-us/articles/18018181840407-Recording-Event-Attendance-using-Standard-Form)
- **Ticket List vs Guest List**: unapproved submissions appear on the Ticket List but not the Guest List; Ticket List is the more accurate record — [Elvanto: Understanding the Ticket List vs. Guest List](https://help.elvanto.com/hc/en-us/articles/22359578900759-Understanding-the-Ticket-List-vs-Guest-List-in-Elvanto-Events)
- Invoices & Tickets tab: export billing contacts or ticket list (Excel/CSV); apply offline (cash/check) payments to invoices; print invoices and tickets; no direct invoice resend — [Elvanto: How to Export Invoices and Ticket Lists](https://help.elvanto.com/hc/en-us/articles/26216288300695-How-to-Export-Invoices-and-Ticket-Lists); [Elvanto: How to Print Event Invoices and Tickets](https://help.elvanto.com/hc/en-us/articles/16873757399703-How-to-Print-Event-Invoices-and-Tickets)
- Without a registration form, invitees can Accept/Decline/Maybe — [Elvanto: How to Accept Attendance Sign Up for an Event](https://help.elvanto.com/hc/en-us/articles/7622514028183-How-to-Accept-Attendance-Sign-Up-for-an-Event)

#### Pushpay ChMS (formerly Church Community Builder) (search summaries; JS-only help portal)
- Registration via ChMS **Forms**; Product/Ticket fields with "Total available" close the form when sold out; otherwise no response limit; **max 10 registrants** per form fill — [Pushpay: FAQ – Forms](https://support.pushpay.com/s/article/FAQ-Forms)
- Form Settings > Payment and Discount: Pay Later (submit without paying) or Debit/Credit Card Only (payment required); discount codes; payment summary before submit — [Pushpay: How to Accept Payments Using ChMS Forms](https://support.pushpay.com/s/article/How-To-Use-Form-Payments)
- Separate "Pushpay Events" product (in Pushpay Giving) with bookings and a "Process refund" step — [Pushpay: FAQ – Events in Pushpay Giving](https://care.pushpay.com/s/knowledge/FAQ-Events)

### Consolidated feature inventory (every distinct feature found, with where it was seen)

Offering setup and publishing
1. Signup types by detail level: headcount-only vs named per-person vs self-only — PCO, ChurchTrac
2. Template/instance split (reusable config, many dated instances) — Rock
3. Multiple priced/limited "selection types" / registration types / attendee types / tickets per event — PCO, Realm, ChurchTrac, Elvanto
4. Per-type eligibility (age, grade, gender, data view) — PCO, Rock
5. Hidden (staff-only) selection types — PCO; per-type public flag — Realm
6. Visibility: public listing, scheduled publish, direct-link-only/hidden, featured, auto-hide — PCO, Realm
7. Registration open/scheduled/closed, auto-close after event, registration start/end dates — PCO, Rock
8. Shareable URL and QR code — PCO, Realm, ChurchTrac
9. Recurring and multi-day registration events; split registrations across dates — Realm, PCO (ChurchTrac removes recurrence when registration is on)
10. Categories (organize and secure) and duplicate/clone events — PCO, Rock, ChurchTrac
11. Login required vs guest registration; "Connect users only" — PCO, Rock, Realm, ChurchTrac
12. Prevent duplicate registrations — Rock
13. Support contact / "Need help?" — PCO

Capacity and waitlist
14. Event-wide and per-type capacity — PCO, Realm, Elvanto (per ticket)
15. Per-add-on/fee capacity; hide when sold out — PCO, Rock
16. Whole-form max entries (no per-option limit) — Breeze; ticket "total available" — Pushpay
17. Inventory hold timer during checkout (15 min/section; 48 h uncapped) — PCO
18. Admin capacity override — PCO
19. Waitlist per type, with partial-party split (some registered, rest waitlisted) — PCO, Rock
20. Manual promote; bulk "notify waitlist" first-come-first-served — PCO
21. Move-from-wait-list email that finishes registration, collects payment and skipped questions — Rock
22. Convert registrant ↔ wait list — Rock
23. Registration approval queue before guest list — Elvanto

Forms and data
24. Per-registration questions vs per-attendee questions — PCO, Rock
25. Conditional questions — PCO, Rock
26. Profile-syncing fields vs event-only answers; lock existing value; internal (staff-only) fields — PCO, Rock
27. Post-registration "attendee information form" completed later — PCO
28. External/PDF forms and e-signature documents — PCO, Rock
29. Emergency contact stored only on the registration — PCO
30. Import questions from a previous event; pre-built fields — ChurchTrac
31. SMS opt-in per number — Rock
32. Missing-information alert but completion allowed — Realm; "Needs attention" / yellow incomplete status — PCO

Money
33. Per-type price; add-ons/fees/additional items with quantity — all major
34. Deposits / minimum initial payment; pay balance later via link — PCO, Rock, Realm
35. Pay later / flexible payment with staff-set due date — ChurchTrac, Pushpay, Breeze
36. **Donation mode: registrant picks amount, staff set suggested amount and max** — ChurchTrac; open-amount payment field — Breeze
37. Family/registration price cap — ChurchTrac
38. Payment plans (installments to deadline) — Rock
39. Discounts: code, group/quantity, early bird, automatic, max usage, percent or flat — PCO, Rock, Realm, Pushpay
40. Scholarships as a payment source — PCO
41. Cash/check recorded by staff; ACH; Apple/Google Pay — PCO, Rock, Elvanto
42. Refunds: partial/full, by method, with reason; refund cutoff date; record-only vs through gateway — PCO, Rock, Realm (ChurchTrac: only in Stripe)
43. Transfer funds between registrations — PCO
44. Accounting fund/category and batch matching — Realm, ChurchTrac, Rock, Breeze

Staff operations
45. Staff-entered registration on another's behalf, optionally sending confirmation — PCO, Rock, Realm, ChurchTrac
46. Edit answers, change selection type, add/remove attendees, change registration contact — PCO, Rock
47. Private staff notes — PCO
48. Transfer to another person; move registration to another instance (same template) — PCO, Rock
49. Cancel whole registration vs one attendee; restore; delete canceled — PCO, Realm
50. Audit log (entry method + financial changes) — Rock; communication history — PCO
51. Assignments (rooms/cabins/teams) with capacity, restrictions, auto-assign — PCO; group placement — Rock
52. Automations on register/cancel (add to/remove from group) — PCO; workflows — Rock
53. Match registrant to existing person or create profile — ChurchTrac, Realm
54. Daily digest to subscribers; notify group leaders — PCO, Rock

Communication
55. Confirmation email (signup-wide and per-type custom message, attachments, calendar link) — PCO, Rock, Realm
56. Scheduled reminders (1 hour to 4 weeks; 1–6 days/1–2 weeks; second reminder) — PCO, Realm, Rock
57. Balance-due, incomplete-info and incomplete-form reminders — PCO, Rock
58. Email filtered registrants or registrars — PCO, Rock, Realm, ChurchTrac

Attendance and reporting
59. Roster-based attendance in the registration tool — PCO, Realm
60. Check-in integration (labels, stations, kiosks; blocks incomplete/unpaid) — PCO, Rock, Breeze, Elvanto
61. Reports: overview, guest list, CSV export with chosen fields, fee/discount exports, marking sheet — PCO, Rock, Realm, Elvanto
62. Registrant self-service: view, edit, pay balance, cancel, add to calendar — PCO, Rock

### Inferences
- The two-level split between the person who submits ("registration contact" / "registrar") and the people attending ("attendees" / "registrants") is the core data model in PCO, Rock and Realm, and directly fits RIM's guest-registers-a-friend and parent-registers-child cases.
- ChurchTrac's "Ask for a Donation" (suggested amount, registrant-edited amount, Pay Later, a note that payment is not required) is the closest documented analogue to dana; none of the larger platforms document a donation mode for registrations in the pages read.
- Most of PCO's depth (assignments, check-in labels, automations) exists for camps and children's events; RIM's needs (meals, residential retreats, volunteer views) map more to selection types + add-ons + attendee questions + guest list report + per-signup managers.

### Gaps
- PCO: no "pay what you want"/donation pricing found; not confirmed absent, just not documented in the articles read.
- Pushpay ChMS, Breeze and Elvanto: full article text could not be read (403 or JS-only portals); details come from search summaries.
- Realm: discount, additional-items and partial-payment article bodies were not read.

## 2. Family/household or group registration, and registering on someone else's behalf

### Takeaway
PCO and Rock both model one submitter registering several people, with explicit household rules; PCO lets staff register anyone from the admin side (with capacity override and hidden types), and Rock lets staff add paper registrations and add registrants to an existing registration. Breeze is the weak case: one form = one profile.

### Cited Findings
- PCO household setting: "Household members during registration": Always / Only if they don't have a household yet / Never; plus "Register others outside their household" (may create a duplicate profile) — [PCO: Change signup settings](https://help.planningcenter.com/en/139323-change-signup-settings.html)
- PCO: registrants cannot add a person to an existing registration; "Register again" creates a second registration; an administrator must add people to keep them in one registration — [PCO: Manage registration and payments](https://help.planningcenter.com/en/140939-manage-registration-and-payments.html)
- PCO staff-entered registration: Registrations tab → New registration → pick counts per selection → search People for each attendee (or create a new person) → first attendee becomes the registration contact (changeable to "Someone else") → optional "Send confirmation email" → Save, then add answers and notes — [PCO: Register people for a signup](https://help.planningcenter.com/en/139336-register-people-for-a-signup.html)
- PCO: hidden selection types can only be registered by admins/editors — [PCO: Create selection types](https://help.planningcenter.com/en/139327-create-selection-types.html); admins can override capacity — [PCO: Capacity](https://help.planningcenter.com/en/139348-capacity-for-signups.html)
- PCO also documents "Register pairs for a signup" (article not read) — [PCO: Register people for a signup](https://help.planningcenter.com/en/139336-register-people-for-a-signup.html)
- Rock: Registrar vs Registrant; "Registrants in same family": No / Yes / Ask; "Show family members" dropdown starts blank so the registrar must choose deliberately; registrar options include "Use logged-in person" and "Use first registrant"; "common value" copies answers to later registrants; max registrants per registration — [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- Rock staff: manually add a registration (e.g., from a paper form) and "Add New Registrant" to an existing registration — [Rock: Manage Event Registrations](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/manage-event-registrations)
- Realm: signed-in users see family members and can register them; "Allow Guests" lets a signed-in registrant add guests; public-link registrants always appear as guests — [Realm: Registration Events](https://help.acst.com/en/realm/how-to/registration-events); staff with permission register individuals, guests and family members; named guests without profiles can be listed and converted to profiles — [Realm: Registration for Events](https://help.acst.com/en/realm/how-to/registration-events/registration-for-events)
- ChurchTrac: Multiple Attendees type for families; family cost cap via Max Amount per Registration; staff "Add names to the event" and match registrants to existing people or create profiles — [ChurchTrac: Registrations Overview](https://churchtrac.com/support/events/registrations-overview); [ChurchTrac: Attendee Types and Cost](https://www.churchtrac.com/support/events/attendee-types-and-cost)
- Breeze: for multi-person signups, one form per person is recommended if separate profiles are needed; syncing a form result creates only one profile (search summary) — [Breeze: Registering Multiple People for One Event](https://support.breezechms.com/hc/en-us/articles/360003925193-Registering-Multiple-People-for-One-Event)
- Pushpay ChMS: up to 10 registrants per form fill (search summary) — [Pushpay: FAQ – Forms](https://support.pushpay.com/s/article/FAQ-Forms)

### Inferences
- A good minimum for RIM: a submitter (who may be a guest) plus N attendees, each with their own answers, where staff can add attendees to an existing registration and create one on someone's behalf with "send confirmation: yes/no".
- Rock's "family dropdown starts blank" is a deliberate data-integrity choice worth copying wherever a member registers someone else.

### Gaps
- PCO "Register pairs" article not read.

## 3. Waitlists, cancellations, transfers and refunds

### Takeaway
No platform documented automatic waitlist promotion or a timed offer window. PCO promotes manually or emails the whole waitlist ("first come, first served"); Rock moves people manually and sends an email that finishes their registration and takes payment. Refunds are always manual and never triggered by a cancellation.

### Cited Findings
- PCO waitlist: per selection type, requires capacity; locked on once anyone joins; people join when a type is full; staff promote from the Waitlist tab, and the contact gets an email with event details, missing info/forms and a calendar link; or "Notify waitlist of available capacity" emails everyone with a link, first come first served. Automatic promotion and offer windows are not described — [PCO: Waitlist](https://help.planningcenter.com/en/139349-waitlist.html)
- PCO waitlists came to detailed (named) signups in July/August 2024 (previously simple signups only) — [PCO blog: add people to waitlists for any Registrations event](https://www.planningcenter.com/blog/2024/08/add-people-to-waitlists-for-any-registrations-event)
- Rock waitlist: enable on template; max registrants on instance; first/last name must "Show on Wait List"; group-member attributes deferred; parties larger than remaining spots split; waitlisted people are not charged; confirmation shows status; staff use "Move From Wait List" (placement order); the optional move email links to finish registration, collect payment and ask skipped questions; registrant ↔ waitlist convertible; no offer window documented — [Rock: Manage Wait Lists](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/manage-wait-lists)
- Rock reminder emails also go to waitlisted people — [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- Rock community has an open idea for automated waitlisting on capacity-managed single-select fields (suggesting it doesn't exist) — [Rock Ideas #2007](https://community.rockrms.com/ideas/2007/capacity-managed-single-select-fields-with-automated-waitlisting-in-event-registration-blocks)
- Realm, ChurchTrac, Breeze, Elvanto, Pushpay: no waitlist documentation found.
- PCO cancellation: cancel a whole registration or one attendee; "Cancel all registrations" for a signup (refunds per registration, manual); canceling removes assignments permanently; Canceled tab; restore registration or attendee; only canceled registrations can be deleted (permanent) — [PCO: Cancel or restore](https://help.planningcenter.com/en/139339-cancel-or-restore-registrations-and-attendees.html)
- PCO self-cancel (if enabled) cancels only the whole registration; refunds aren't automatic, registrant must ask — [same](https://help.planningcenter.com/en/139339-cancel-or-restore-registrations-and-attendees.html); [PCO: Manage registration and payments](https://help.planningcenter.com/en/140939-manage-registration-and-payments.html)
- PCO transfer: staff add the new attendee then cancel the original; registrants cannot transfer themselves; transfer payments via "Transfer funds" — [PCO: Edit attendee information](https://help.planningcenter.com/en/139338-edit-attendee-information.html)
- PCO refunds: manual, partial/full, per method; to avoid a leftover balance due, cancel or change selection/add-ons before refunding; fees not returned — [PCO: Refund payments](https://help.planningcenter.com/en/139369-refund-payments.html)
- Rock: "Move Registration" to another instance with the same template; refunds from the transaction (amount, reason from a defined list, summary, through gateway or record-only); discounts larger than owed create a negative balance needing manual refund — [Rock: Manage Event Registrations](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/manage-event-registrations); [Rock: Registration Finances](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)
- Realm: cancel per individual registrant by admins or Manage Events permission; guests without accounts cannot self-cancel; refund cutoff date setting — [Realm: Cancel a Registration](https://help.acst.com/en/realm/how-to/registration-events/registration-for-events/cancel-a-registration); [Realm: Choose Payment Settings](https://help.acst.com/en/realm/how-to/registration-events/paid-registration-events/choose-payment-settings-for-registration-events)
- ChurchTrac: refunds only through Stripe, not in ChurchTrac; canceling or changing a paid registration doesn't refund; no automatic notification of cancellations; "Cancelled" status in the Registrant Report — [ChurchTrac: Attendee Types and Cost](https://www.churchtrac.com/support/events/attendee-types-and-cost)

### Inferences
- Manual promotion plus an email that completes the registration (Rock) is the industry norm; automatic promotion with an expiring offer would go beyond every church platform researched.
- Cancel and refund are separate actions everywhere; the registrar must be prompted to handle money after a cancel.

### Gaps
- PCO: whether canceling frees capacity automatically or emails anyone is not stated in the article read.
- Realm partial-party cancellation and cancellation emails not documented.

## 4. Check-in and attendance: how and who

### Takeaway
Two patterns: a simple roster checklist inside the registration tool (PCO, Realm), or hand-off to a dedicated check-in product with stations/kiosks/labels (PCO Check-Ins, Rock via group linkage, Breeze, Elvanto).

### Cited Findings
- PCO in-Registrations attendance: Registrations tab → Attendance → all or filtered roster → check who came → named rosters saved/edited/deleted; whole-event reporting only — [PCO: Take attendance for Registrations signups](https://help.planningcenter.com/en/138315-take-attendance-for-registrations-signups.html)
- PCO synced Check-Ins event (Named Attendees only; needs Check-Ins editor permission): assignment types sync as locations; labels can print selection type, add-ons, assignments; manned, self, or roster stations; registration alerts (balance due, missing forms) shown before check-in; self stations block incomplete/unpaid people; roster stations show only complete registrations and can be locked to one area; unregistered people can be checked in as Guest at manned/roster stations but are not thereby registered; Church Center QR check-in — [same](https://help.planningcenter.com/en/138315-take-attendance-for-registrations-signups.html)
- Managers (signup-level) can take attendance — [PCO: Introduction for managers](https://help.planningcenter.com/en/139244-introduction-for-managers.html)
- Rock: placing registrants into a linked group is "in most cases" done "so you can enable things like event check-in" — [Rock: Intro to Event Registrations](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/intro-to-event-registrations)
- Realm: mark attendance for a registration event; print a marking sheet; named guests appear with their inviter; extra attendees can be added to the count — [Realm: Registration for Events](https://help.acst.com/en/realm/how-to/registration-events/registration-for-events)
- Breeze: check-in eligibility can be limited to people who filled in specific forms; kiosk mode by phone number or barcode so the public can't see other families' names (search summary) — [Breeze: Editing Event Settings](https://support.breezechms.com/hc/en-us/articles/360001169913-Editing-Event-Settings)
- Elvanto: check-in by name requires the person to be on the event's Guest List; ticketed events search by ticket number (search summary) — [Elvanto: Understanding the Ticket List vs. Guest List](https://help.elvanto.com/hc/en-us/articles/22359578900759-Understanding-the-Ticket-List-vs-Guest-List-in-Elvanto-Events)

### Inferences
- For RIM's greeters, PCO's roster-station behaviour (only complete registrations, locked to an area, alerts for unpaid/missing info) and its printable Guest list report are the two most transferable ideas; labels are not.

### Gaps
- Rock check-in specifics for event registrations were not read (lives in Rock's check-in docs).

## 5. What staff can do with a registration after the fact

### Takeaway
PCO and Rock give staff full edit rights (answers, selection, attendees, contact, payments), private notes (PCO) or an audit log (Rock), and resend-confirmation. Registrants can self-edit some things in both.

### Cited Findings
- PCO: edit personal info, answers, add-ons; change selection type via dropdown; add attendees (search or create profile); change registration contact; apply payments; add rich-text Notes visible only to admins/managers; email the contact about changes; transfer; cancel/restore. Warning: editing a name changes the People profile everywhere — [PCO: Edit attendee information](https://help.planningcenter.com/en/139338-edit-attendee-information.html)
- PCO single-registration Email menu: Send email, Resend confirmation emails, Incomplete attendee info reminder, Balance due reminder, Incomplete external form reminder — [PCO: Send emails](https://help.planningcenter.com/en/139345-send-emails-to-registration-contacts-and-attendees.html)
- PCO communication history: emails kept at least three months, visible on the person's Communications tab, failed deliveries in red with error codes; no audit log of edits is described — [PCO: View communication history](https://help.planningcenter.com/en/188711-view-communication-history-in-registrations.html)
- PCO registrant self-service on Church Center: My registrations, "Needs attention" banner, complete missing forms, edit attendee info (some fields locked), pay balance, add to calendar, cancel online (if allowed); cannot add attendees or change selections/add-ons — [PCO: Manage registration and payments](https://help.planningcenter.com/en/140939-manage-registration-and-payments.html)
- Rock: Registration Details (resend confirmation), Registrant Details (edit each), Financial Information (edit account, fees, payments), **Audit Log** (how entered + financial changes), Move Registration, Add New Registrant; message registrars of selected registrants from the Registrants tab — [Rock: Manage Event Registrations](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/manage-event-registrations)
- Rock admins can modify (not create) payment plans; template setting can block external edits to saved registrations — [Rock: Registration Finances](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances); [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)
- Realm: view and edit registrants, "Edit Who's Coming to an Event", Edit Registrant Information, add registrants to a pathway, convert named guests to profiles — [Realm: Registration for Events](https://help.acst.com/en/realm/how-to/registration-events/registration-for-events)
- ChurchTrac: show unfinished registrations; edit setup; changing registration method after signups means creating a new event and re-registering — [ChurchTrac: Registrations Overview](https://churchtrac.com/support/events/registrations-overview); [ChurchTrac: Attendee Types and Cost](https://www.churchtrac.com/support/events/attendee-types-and-cost)

### Inferences
- An edit history is rare: only Rock documents an audit log. PCO relies on notes plus communication history. A small RIM registrar team would benefit from both (a private note field and a per-registration change log).

### Gaps
- PCO "Transfer funds" and "Update contact person" articles not read in full.

## 6. Where confirmation/reminder emails are configured and what they contain

### Takeaway
Confirmation is per event (with per-type additions in PCO and per-instance additions in Rock); reminders are scheduled relative to the event start. Balance-due and incomplete-info reminders are separate staff-triggered (PCO) or template-defined (Rock) messages.

### Cited Findings
- PCO confirmation: Configuration → Confirmation message → Add message (rich text, up to 5 attachments/10MB, images); per-selection custom message set in selection settings. The email includes all registration information, the custom message, a Church Center link, an add-to-calendar link and a copy of registration details — [PCO: Create a custom confirmation message](https://help.planningcenter.com/en/139350-create-a-custom-confirmation-message.html)
- PCO confirmation includes a link to the final registration page for paying the balance — [PCO: Partial payments](https://help.planningcenter.com/en/139366-partial-payments.html); form links also appear in the confirmation email — [PCO: Manage registration and payments](https://help.planningcenter.com/en/140939-manage-registration-and-payments.html)
- PCO reminders: Configuration → Reminders; all attendees or selected selection types; 1 hour to 4 weeks before; one reminder per selection type; "the only emails sent directly to attendees" (others go to the registration contact) — [PCO: Send emails](https://help.planningcenter.com/en/139345-send-emails-to-registration-contacts-and-attendees.html)
- PCO staff-triggered bulk emails: General, Incomplete attendee info, Balance due (amount + payment link), Incomplete external form; can exclude people reminded within N days; merge fields `{{ }}`; From name/reply-to selectable, sent from no-reply@churchcenteronline.com — [same](https://help.planningcenter.com/en/139345-send-emails-to-registration-contacts-and-attendees.html)
- PCO promotion-from-waitlist email: event details, missing info/forms, calendar link — [PCO: Waitlist](https://help.planningcenter.com/en/139349-waitlist.html)
- Rock (template, with "Show Communication Settings"): Confirmation email (doubles as receipt; instance can add "Additional Confirmation Details"); Reminder email (timing set per instance; goes to all completed registrants incl. waitlisted); Payment reminder email (balance); wait-list move email; Lava templating — [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates); [Rock: Manage Wait Lists](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/manage-wait-lists)
- Rock reminders can be resent by moving the send date into the future — [Rock: Registration Finances](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-finances)
- Realm confirmation: Overview → Advanced Options → Customize Confirmation Email (rich body, reset to default); admins and Manage Events permission — [Realm: Customize the Event Confirmation Email](https://help.acst.com/en/realm/how-to/registration-events/customize-the-event-confirmation-email)
- Realm reminders: "Send reminders before the event" 1–6 days, 1 or 2 weeks (default 2 days), optional second reminder; contain date, time, location or online meeting link (plus RSVP headcount/items for simple RSVP) — [Realm: Send Reminders Before an Event](https://help.acst.com/en/realm/how-to/registration-events/send-reminders-before-an-event)
- Breeze: form payers do not automatically get a payment confirmation; staff must add the entry-details merge tag to the form confirmation email (search summary) — [Breeze: Accepting Payments on Forms](https://support.breezechms.com/hc/en-us/articles/360001326413-Accepting-Payments-on-Forms)
- PCO staff-side notice: Subscribers' daily digest (new registrations, cancellations, partial payments) — [PCO: Change signup settings](https://help.planningcenter.com/en/139323-change-signup-settings.html); Rock: notify registration contact, group followers or group leaders — [Rock: Registration Templates](https://community.rockrms.com/documentation/church-management/event-calendar/event-registrations/registration-templates)

### Inferences
- The set that recurs across platforms: confirmation (with calendar link + manage/pay link), one or two scheduled reminders including location or online meeting link, balance-due reminder, incomplete-info reminder, waitlist-promotion email, and a staff digest. For RIM's Zoom offerings, Realm's "online meeting link in the reminder" is the closest precedent.

### Gaps
- PCO's default confirmation content when no custom message is set is not described.
- ChurchTrac, Elvanto and Pushpay confirmation/reminder configuration not documented in pages reachable.
