# Registration software for retreat centers, dharma centers, studios and camps: feature inventory

Research date: 2026-10-23. Sources are official help centers and product pages where reachable, plus meditation centers' own public registration pages. Several help articles were unreachable (403/404) and some features are documented only on marketing pages; this is flagged inline. Search-result summaries that I could not open directly are marked "(search snippet)".

Who uses what (verified from public URLs):
- **Spirit Rock**: Retreat Guru (registration runs at `spirit-rock.secure.retreat.guru`); scholarship applications are a separate Google Form — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat); [Spirit Rock on Retreat Guru](https://spirit-rock.secure.retreat.guru/program/labor-day-insight-meditation-retreat-384r22)
- **Zen Mountain Monastery**: Retreat Guru (`zenmountainmonastery.secure.retreat.guru`) — [ZMM Hazy Moon Sesshin](https://zenmountainmonastery.secure.retreat.guru/program/hazy-moon-sesshin-5/)
- **Vallecitos** (dana-based retreats): Retreat Guru — [Vallecitos listing](https://vallecitos.secure.retreat.guru/program/2026-cultivating-embodied-insight/)
- **Deer Park Monastery (Plum Village tradition)**: registration forms hosted on its own site (`deerparkmonastery.org/retreats/.../register`); I could not identify the underlying platform — [Deer Park forms](https://deerparkmonastery.org/retreats/clarity-hamlet/119727/register)
- **Shambhala centers**: each local center site (`*.shambhala.org`) runs its own registration with a "Pay what you can" field; I did not identify the platform — [Asheville](https://asheville.shambhala.org/?p=1502), [Albuquerque](https://albuquerque.shambhala.org/?p=1686)
- **Insight Meditation Society, Barre Center (BCBS), San Francisco Zen Center**: platform not identified from public pages (see Gaps).

---

## What features does each product support?

### Takeaway
Retreat Guru is the only product here built for residential contemplative retreats: it combines per-program forms with conditional and admin-only questions, per-question role permissions, five pricing methods (including suggested donation and sliding scale), lodging inventory, diet-aware meal reports for the kitchen, a housekeeping list, and pre-arrival/post-departure emails. Mindbody and Momence are class-booking tools (memberships, waitlist auto-fill, late-cancel penalties). Regpack, UltraCamp and CampBrain are camp/program tools strong on per-participant forms, health records, e-signatures, payment plans and admin roles.

### Cited Findings

**Retreat Guru: registration forms and questions**
- Forms are reusable and assigned per program: a registration form, a remote-registration form, and a waitlist form, each chosen in the program's settings; one default per area applies to new programs. Editing a global form updates every program that uses it — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Question types include multiple checkboxes, radio buttons/drop-down (single choice), and a read-only "Message (HTML)" block for showing information to the guest — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Conditional questions: a follow-up field appears only when a trigger field gets a specific answer; conditions are set on the form, so the same field can be conditional on one form and not another (example: "Diet notes" trigger reveals "Other diet restrictions") — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Required status is set per form, not per field — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- **Secondary forms**: a registration form has a primary form and an optional secondary form (filled in later); fields can be marked "Include on Secondary." Pre-arrival emails can be filtered by "secondary form complete / not complete" — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms); [RG: Emails](https://help.retreat.guru/knowledge/emails-v2)
- **Admin-only fields** live in "field sets" (Person, Registration, Rental) and never appear on the public form; example "HKP Notes" lets housekeeping see special requests internally — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Person-area fields show a guest's most recent answer; registration-area answers can differ per booking — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Multi-person registrations ("accept registrations for more than one person while still keeping track of each individual"), password-protected programs, custom registration statuses (e.g. "Payment Required," "Payment Received," "Canceled"), color-coded registration flags (e.g. balance due, blacklisted, special needs), capture of abandoned registrations, fixed vs flexible-date programs, minimum stays, custom thank-you pages per form — [RG: Features](https://software.retreat.guru/features)
- Event Group Leader: one person pays for and manages a whole group with a single statement; Group Leader Remote Registration auto-emails guests added by the organizer to collect their own details — [RG: Features](https://software.retreat.guru/features)
- Exclude a guest type (e.g. teachers, renters) from max capacity — [RG: Features](https://software.retreat.guru/features)
- Matching people and registrations: auto-match links new registrations to existing person records using only first name, last name and email (search snippet) — [RG: matching people and registrations](https://help.retreat.guru/knowledge/matching-people-and-registrations)
- Participant Portal: guests see past/present/future registrations, add to calendar, view statements and balances, and access online program links — [RG: Features](https://software.retreat.guru/features)
- Changes Log records changes to registrations, programs and transactions by team members — [RG: Features](https://software.retreat.guru/features)
- Waivers / e-signatures: **not described** in the forms documentation — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)

**Retreat Guru: pricing and payments**
- Five pricing methods per program: Free; Simple/multiple (price points, with Package Builder); Suggested donation ("pay whatever they want, including nothing at all"); Sliding scale (low–high range, inclusive; open-ended bounds via $0; multiple tiers); Lodging-based (tuition + per-day meals + lodging choice) — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Also: early-bird, seasonal, weekend/weekday pricing; itemized packages; discount codes with limits; extra-night pricing; card-fee pass-through; tracking of checks/cash; gratuities; personal credit for participants, volunteers and staff — [RG: Features](https://software.retreat.guru/features)
- Deposits: per program, "People can pay a deposit or the total," with a deposit cut-off date; installment plans in equal payments at a chosen frequency, final payment due e.g. 3 days before start; scheduled payments auto-charge the card on file; payment-reminder emails (disabled by default) — [RG: Installment and Scheduled Payments](https://help.retreat.guru/knowledge/scheduled-payments)
- Donations can be added to the registration form (global donation types, renameable or hideable per program); can be collected in full at registration alongside the deposit; shown on the guest statement — [RG: Donations](https://help.retreat.guru/knowledge/donations)

**Retreat Guru: waitlist**
- When capacity or rooms fill, online registration switches to an "add me to the waitlist" form (first/last/email required, extra questions allowed). Joining is automatic; **promotion is manual**: the registrar uses "Click to register" or a bulk email containing a registration-link code. Optional "Restrict registration to people on the waitlist." Last Contact column, CSV export — [RG: Manage a Waitlist](https://help.retreat.guru/knowledge/create-a-waiting-list)

**Retreat Guru: emails**
- Automated: registration confirmation (global or per-program), pre-arrival (N days before, by guest type, filterable by balance due / secondary form status), post-departure (N days after), payment received, cancellation, abandoned-registration follow-up, multi-person notification, Quick Add confirmation. Manual: payment request, waitlist "space available," one-off, bulk. Internal: new-registration notice to registrar/program contact, guest-edit notice, room repair. Template codes such as `{{first_name}}`, `{{important_notices}}` — [RG: Emails](https://help.retreat.guru/knowledge/emails-v2)

**Retreat Guru: reports**
- Printable participant rosters, registration reporting with arrival/departure quick links, occupancy report, housekeeping reports, meal reports, banquet event order, accounting reports — [RG: Features](https://software.retreat.guru/features)
- Export Data, Change Log, Payout Reporting, Accounting Report articles exist — [RG: Features category](https://help.retreat.guru/knowledge/features?hsLang=en)

**Mindbody**
- Class/course waitlists enabled site-wide ("Enable Waitlists"), with a per-class "How many can waitlist?" limit and a waitlist lock window; raising capacity does **not** pull people off the waitlist automatically; a client needs a valid pricing option to hold a waitlist spot (checked at join, used when a spot opens) — [Mindbody: waitlists for courses](https://support.mindbodyonline.com/s/article/Enrollments-Waitlists?language=en_US); [Mindbody: payment for waitlists](https://support.mindbodyonline.com/s/article/When-someone-reserves-a-spot-on-a-class-enrollment-waitlist-does-it-require-them-to-pay?language=en_US) (search snippets)
- Late cancel = cancelled after the cancellation window, often deducting a session from the pricing option; no-show = registered but neither attended nor cancelled ("Absent") — [Mindbody glossary](https://support.mindbodyonline.com/s/article/203254253-MINDBODY-glossary?language=en_US) (search snippet)
- Late-cancel and no-show fees shown in checkout policy text (example: 1440-minute window, $10 late cancel, $20 no-show); a "Pay Teachers for No-Shows" setting — [Mindbody: consumer cart v2](https://support.mindbodyonline.com/s/article/Consumer-cart-v2-branded-web-tools?language=en_US); [Mindbody: paying staff for no-shows](https://support.mindbodyonline.com/s/article/Paying-staff-for-no-shows?language=en_US) (search snippets)
- Self check-in screen exists — [Mindbody: Self Check In](https://support.mindbodyonline.com/s/article/203259053-Self-sign-in?language=en_US) (search snippet, not opened)
- A third-party add-on (Bitlancer "Waitlist Assistant") markets automatic waitlist-to-class filling after late cancels, suggesting native auto-fill is limited — [Bitlancer listing](https://integrations.mindbodyonline.com/partners/bitlancer) (search snippet)

**Momence**
- Class waitlists with three fill methods: first come first served (auto text to first person), double opt-in (texts one person at a time, moves on after a reply window, default 10 minutes), "fast fingers first" (texts everyone; first reply wins); cutoff before class start; drag-to-reorder — [Momence: Waitlist FAQs – Classes](https://help.momence.com/en/articles/12028307-waitlist-faqs-classes) (search snippet)
- Appointment waitlists: Manual, Double Opt-in, Fastest Fingers First; joining doesn't charge — [Momence: Waitlist FAQs – Appointments](https://help.momence.com/en/articles/12026801-waitlist-faqs-appointments) (search snippet)
- Cancellation policy settings with automatic late-cancel/no-show fee charging and up to three automatic card retries — [Momence product update](https://momence.substack.com/p/feature-updates-easily-change-class) (search snippet)
- Payment plans and subscriptions/packs exist as help topics — [Momence: Payment Plan FAQs](https://help.momence.com/en/articles/12029882-payment-plan-faqs); [Momence: Subscriptions and Packs](https://help.momence.com/en/articles/6974708-subscriptions-and-packs-overview) (titles only)

**Regpack**
- Admin license types: Account Owner (everything incl. admin management), Super Admin (full, limitable by owner), Financial Admin (financials; user data limitable), API Admin, Collaborator (read/write user info and reports, add products, comments, emails; no financials listed), Guest (read-only user info). No field-level hiding of sensitive data described — [Regpack: Admin License Types](https://help.regpack.com/admin-license-types-and-access-levels)
- Project access can be granted to all projects or project-by-project (search snippet) — [Regpack: Inviting and Managing Admins](https://help.regpack.com/hc/en-us/articles/5834354700571)
- Retreat page (marketing): group registration "in one flow," conditional logic, add-on questions for "room type, dietary needs, session choices, and travel details," "dietary and medical info," "Unlimited fields, waivers, and e-signatures," deposits plus scheduled installments with a reminder before each charge, confirmation and automated pre-retreat emails — [Regpack: Retreat Registration](https://www.regpacks.com/solutions/retreat-registration-software)

**UltraCamp**
- Payment plans auto-collect card/ACH on a schedule; can be tied to sessions, limited by date or payment type; session-balance vs account-balance plans; an option (e.g. "apply for financial aid") can trigger a special plan, possibly checkout without paying — [UltraCamp: Payment Plans](https://help.ultracamp.com/hc/en-us/articles/7229142977044-Payment-Plans) (search snippet)
- Feature page lists custom questions and online forms, forms attached to options, "scholarships, vouchers, third-party pay," transportation and camper pickup authorizations — [UltraCamp features](https://www.ultracamp.com/features.html) (search snippet; direct fetch returned 404)
- Health settings: collect medication info and log medication distribution; medical incident logs restricted to permitted admins; saved incidents not editable by default (corrections added as a new entry; optional strike-through) — [UltraCamp: Managing Health Settings](https://help.ultracamp.com/hc/en-us/articles/50922473005076) (search snippet; direct fetch returned 403)

**CampBrain**
- Unlimited forms, triggered per selected session so "Parents see only those camp options and forms that are a fit for their child"; health document from a template with predefined sections; "Cabinizer" drag-and-drop cabin assignment for campers and staff — [CampBrain: Special needs / simplified sign-ups](https://campbrain.com/special-needs/)
- Customer chooses which forms/fields are online and required, and which forms parents complete when; sibling/early-bird discounts, discount codes, tiered pricing; Square integration — [CampBrain: Service Description](https://campbrain.com/saasdescription/) (search snippet)

### Inferences
- For a dharma center, Retreat Guru's combination of per-program forms + secondary form + admin-only fields + per-question role permissions is the closest existing model to "collect once, show each team only its slice."
- Studio tools (Mindbody, Momence) optimize for high-frequency paid classes; their distinctive features (late-cancel fees, pricing-option deductions) run counter to a dana model and are mostly irrelevant to RIM except as a waitlist-fill reference.
- Camp tools treat health data as a separate, permissioned record (logs, incident entries) rather than just form answers.

### Gaps
- Retreat Guru check-in/"arrived" status: no dedicated check-in feature found in docs (see the arrivals section).
- UltraCamp help center blocks direct fetches (403); feature claims come from search snippets.
- Mindbody and Momence articles were seen only as search snippets, not read in full.

---

### Complete list of distinct features found (all products)

Forms and data
1. Reusable forms assigned per program (registration / remote / waitlist) — Retreat Guru
2. Conditional (follow-up) questions — Retreat Guru, Regpack, CampBrain (form triggers per session)
3. Required-per-form (not per-field) — Retreat Guru
4. Read-only information blocks inside forms — Retreat Guru
5. Secondary (later, pre-arrival) form with completion tracking — Retreat Guru
6. Admin-only field sets (staff notes never shown to guest) — Retreat Guru
7. Per-question role visibility ("Registration Data Permissions") — Retreat Guru
8. Person-level vs registration-level answers — Retreat Guru
9. Multi-person / group registration with one payer — Retreat Guru, Regpack
10. Group-leader remote registration (each guest fills own details) — Retreat Guru
11. Abandoned-registration capture and follow-up email — Retreat Guru
12. Password-protected programs — Retreat Guru
13. Custom registration statuses and color flags (e.g. "special needs") — Retreat Guru
14. Auto-matching registrations to person records by name+email — Retreat Guru
15. Waivers and e-signatures — Regpack; UltraCamp (camp examples); Deer Park (liability checkbox)
16. Emergency contacts — Deer Park forms; CampBrain (vendor claim)
17. Health intake (allergies, conditions, medications, psychiatric diagnoses) — Deer Park; CampBrain/UltraCamp health modules
18. Medication administration log and immutable incident log — UltraCamp
19. Pickup authorizations — UltraCamp
20. Change log / audit trail — Retreat Guru
21. Participant portal (bookings, statement, balance, online links) — Retreat Guru

Pricing and money
22. Free with optional donation — Retreat Guru
23. Suggested donation / pay-what-you-can (including $0) — Retreat Guru, Shambhala centers
24. Sliding scale range (with or without floor) — Retreat Guru, Momence (slider, also at POS)
25. Named tiers (Supporter/Benefactor/Sustainer/Basic/Reduced; Benefactor/Sustaining/Supported/Scholarship) — Spirit Rock, IMS
26. Scholarship rate requiring separate application (Google Form) — Spirit Rock
27. Scholarship chosen at registration with "simple questions" — IMS
28. Reserved spaces for BIPOC; BIPOC/Young Adult scholarship rates — IMS, Spirit Rock
29. Member/student discounted rates — ZMM
30. Donation add-on at registration; separate end-of-retreat teacher dana — Retreat Guru; Spirit Rock, IMS, BCBS
31. Deposits with cut-off date — Retreat Guru, Spirit Rock, IMS, Regpack
32. Equal installment plans auto-charged; payment reminders — Retreat Guru, Spirit Rock, Regpack, UltraCamp, Momence
33. Option-triggered payment plan (e.g. financial-aid applicants check out without paying) — UltraCamp
34. Tiered discounts by income after aid decision (vendor blog guidance) — Regpack
35. Late-cancel / no-show fees and session deductions — Mindbody, Momence
36. Sliding-scale cancellation fees by weeks-out; lower fees for scholarship recipients — Spirit Rock, IMS
37. Alternative payment tracking (check, cash); personal credit — Retreat Guru

Capacity and waitlist
38. Waitlist form with custom questions; manual promotion via registration link — Retreat Guru
39. "Restrict registration to waitlisted people" — Retreat Guru
40. Auto-fill methods: first-come auto, double opt-in with timeout, fastest-fingers — Momence
41. Waitlist lock window; waitlist size limit — Mindbody
42. Lottery sign-up with no payment, then a short window to register — IMS, Spirit Rock
43. Scholarship waitlist separate from main waitlist — Spirit Rock
44. Exclude guest types (teachers) from capacity — Retreat Guru
45. Commuter spots opened only after residential fills — Spirit Rock
46. Prerequisite interview before registering (first sesshin) — ZMM

Lodging, meals, logistics
47. Room inventory shown during registration; flexible room types (single/double/triple) — Retreat Guru
48. Room blocks per program; staff rooms; manual room assignment; switch room mid-stay — Retreat Guru
49. Medical-need priority for single rooms — Spirit Rock
50. Cabin assignment drag-and-drop for participants and staff — CampBrain
51. Meal plans per program; per-registration meal overrides — Retreat Guru
52. Meal type + diet notes fields feeding a printable kitchen Meal Report with totals and notes — Retreat Guru
53. Bulk/extra meals for staff and walk-ins — Retreat Guru
54. Housekeeping list (arrivals/departures, same-day turnover priority, housekeeping notes) — Retreat Guru
55. Rideshare board — Spirit Rock
56. Transportation as a registration item — UltraCamp, Regpack ("travel details")

Communication and follow-up
57. Confirmation email (global or per program) — Retreat Guru, Regpack
58. Pre-arrival emails N days before, filtered by balance / form completion — Retreat Guru
59. Post-departure emails N days after — Retreat Guru
60. Internal new-registration notice to registrar/program contact — Retreat Guru
61. SMS waitlist offers — Momence

Staff access
62. Role-based admin licenses (owner, super, financial, collaborator, read-only guest) — Regpack
63. Health data restricted to health staff / camp director — UltraCamp and CampBrain camps (camp-stated policy)
64. Printable rosters for teams — Retreat Guru

---

## How do they handle donation-based or sliding-scale pricing, scholarships, and "no one turned away"?

### Takeaway
Retreat Guru natively supports suggested-donation (including $0) and sliding-scale ranges, and centers layer named tiers and a scholarship rate on top; scholarship *review* happens outside the software (Spirit Rock uses a Google Form) or through a "Free" application program. Teacher dana is almost always collected separately at the end of the retreat, not in registration. Studio tools offer a sliding-scale slider (Momence) but no dana concept; camp tools handle aid as an application plus a special payment plan.

### Cited Findings
- Retreat Guru "Suggested donation" lets guests "pay whatever they want, including nothing at all"; the suggestion is not enforced and can be left blank — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Retreat Guru "Sliding scale": guest chooses any amount within a low–high range; a $100–$0 range requires at least $100 (a required minimum); $0–$0 allows any amount; several sliding-scale prices can coexist — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Retreat Guru "Free" method is "mostly used for application forms, such as volunteer programs, events, and scholarships" — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Retreat Guru docs do not describe a scholarship-tier feature or deposits within the pricing article — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Spirit Rock 2026: five named sliding-scale rates (Supporter "Maximum generosity," Benefactor, Sustainer "Our standard rate," Basic "Partially subsidized," Reduced "Subsidized rate"); scholarship rate $475 with three types (Muditā/Karuṇa, BIPOC, Young Adult 18–26) requiring a separate Google Form application; limited to "significant financial need," max two per year; about 20% of participants receive them; recipients must pay a deposit within 72 hours of selection — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)
- Spirit Rock: registration fees do not include teacher dana; "an invitation to offer dana to the teachers and to Spirit Rock" at retreat end — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)
- IMS: tiers Benefactor / Sustaining ("the actual cost to IMS") / Supported (50% of cost) / Scholarship (chosen during registration by answering "some simple questions"); only amounts above Sustaining are tax-deductible; fees don't compensate teachers; deposit required even for scholarship applicants; "IMS reserves a number of spaces for each retreat for people who identify as BIPOC" — [IMS Fees](https://www.dharma.org/retreats/retreat-center/fees/)
- ZMM: "financial concerns should not prevent you from attending"; sliding scale plus member/student rates (e.g. $350 program, $295 practicing members, $250 MRO students) (search snippet) — [ZMM Hazy Moon Sesshin](https://zenmountainmonastery.secure.retreat.guru/program/hazy-moon-sesshin-5/)
- Vallecitos (on Retreat Guru): sliding scale $665–$2,625, describes itself as dana-based, published scholarship rate plus limited additional scholarships (search snippet) — [Vallecitos listing](https://vallecitos.secure.retreat.guru/program/2026-cultivating-embodied-insight/)
- Shambhala centers: online form has a "Pay what you can afford" amount field (Asheville); "Pay what you can" box plus a "Patron Price" option (Albuquerque); hardship handled by contacting the office for reduced amount or periodic payments (Lexington) or volunteer exchange (Dallas) (search snippets) — [Asheville](https://asheville.shambhala.org/?p=1502); [Albuquerque](https://albuquerque.shambhala.org/?p=1686); [Lexington](https://lexington.shambhala.org/?p=1531); [Dallas](https://dallas.shambhala.org/?p=2913)
- BCBS: teachers are unpaid beyond basic costs; dana for teachers left in a box outside the hall (older secondary source) — [Tricycle resource guide](https://tricycle.org/magazine/resource-guide-dharma-no-dollars-day/)
- Deer Park: "standard registration fees are set at a reduced level to make retreat attendance more accessible" (search snippet) — [Deer Park forms](https://deerparkmonastery.org/retreats/clarity-hamlet/119727/register)
- Momence: sliding scale alongside a fixed price; checkout slider starts mid-range; also available at POS so staff can ask what a customer wants to pay; subscriptions have "Customers pick price" (search snippet) — [Momence: Settings & Restrictions FAQs – Classes](https://help.momence.com/en/articles/12027801-settings-restrictions-faqs-classes); [Momence Glossary](https://help.momence.com/en/articles/7869547-momence-term-glossary)
- UltraCamp: a "financial aid" option can trigger a payment plan "unique to Financial Aid applicants — perhaps a plan where they can check out without paying" (search snippet) — [UltraCamp: Payment Plans](https://help.ultracamp.com/hc/en-us/articles/7229142977044-Payment-Plans)
- CampBrain camps: a Financial Assistance Application inside CampBrain; a payment plan can be requested without applying for aid (camp guidance) — [The Trustees CampBrain tips 2026](https://thetrustees.org/wp-content/uploads/2025/12/CampBrain-Tips-for-Registrants-2026.pdf) (search snippet)
- Regpack (blog guidance, ~4 years old): conditional aid questions, tiered income-based discounts applied after approval, final balance due date after aid decision — [Regpack blog](https://www.regpacks.com/blog/verify-financial-need-campers/) (search snippet)

### Inferences
- "No one turned away" in the field is implemented as (a) a $0-floor suggested donation for low-cost offerings, and (b) a scholarship rate plus a human review for high-cost residential retreats. None of the products has a first-class "no one turned away" workflow; it is a policy expressed in copy plus a registrar conversation.
- Separating "registration fee" (covers food/lodging) from "teacher dana" (given at the end) is the dominant pattern among Insight centers; registration software only handles the former.
- Retreat Guru's $100–$0 sliding scale is a direct model for RIM's "a few retreats have a required minimum."

### Gaps
- No product found that tracks dana given *at the end* of a retreat (in-person or post-retreat link) tied to the registration record. Retreat Guru's post-departure email could carry a link, but I found no doc showing this.
- How Spirit Rock moves an approved scholarship applicant into Retreat Guru at the $475 rate is not documented publicly.

---

## How do they handle sensitive answers (health, trauma, accessibility, dietary) and who on staff can see them?

### Takeaway
Retreat Guru lets admins restrict each registration question to specific team roles and keep admin-only fields off the public form; dietary answers flow into the kitchen report. Camps treat health as a restricted module with logs. Meditation centers collect mental-health and medical history (Deer Park) but publish nothing about who sees it.

### Cited Findings
- Retreat Guru "Registration Data Permissions": "Control which members of your team can access guest responses to certain registration questions by setting admin user roles" — [RG: Features](https://software.retreat.guru/features)
- Role permissions are set on each field; example: Birth Date visible only to the Registrar role on the edit-registration page — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- No separate "sensitive question" flag described; no doc on how medical information is stored or protected — [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Retreat Guru team members: by default only Registrar-role admins manage Team Members; custom roles require contacting support — [RG: Team Members](https://help.retreat.guru/knowledge/team-members)
- Dietary: "Meal Type" (menu choice) and "Diet notes" (restrictions, incl. "medically severe restrictions" in the forms example) feed the kitchen Meal Report — [RG: Meals and Meal Reporting](https://help.retreat.guru/knowledge/meals-and-meal-reporting); [RG: Forms and Fields](https://help.retreat.guru/knowledge/forms)
- Retreat Guru registration flags include "special needs" — [RG: Features](https://software.retreat.guru/features)
- Deer Park forms ask about allergies, ongoing medical conditions and medications, and "any psychiatric or psychological diagnoses and mental health medications," plus a liability-release checkbox and an emergency contact "not attending the retreat"; special diets cannot be accommodated (search snippet) — [Deer Park forms](https://deerparkmonastery.org/retreats/clarity-hamlet/119727/register)
- Spirit Rock prioritizes remaining single rooms for "serious medical needs"; ill participants should "Notify the registration department"; accessibility is not addressed on the retreat page — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)
- Regpack: role licenses (Collaborator read/write, Guest read-only) but no field-level hiding described — [Regpack: Admin License Types](https://help.regpack.com/admin-license-types-and-access-levels)
- UltraCamp: medical incident logs restricted to admins with permission; corrections append rather than overwrite (search snippet) — [UltraCamp: Managing Health Settings](https://help.ultracamp.com/hc/en-us/articles/50922473005076)
- Camps on CampBrain state that only health staff see camper health information (Camp Billings) or that it is shared only with essential staff and emergency medical professionals (PEEC) (search snippets) — [Camp Billings](https://campbillings.org/parent-info/medical-forms/); [PEEC](https://www.peec.org/camp-registration-overview/)

### Inferences
- The strongest pattern for RIM's case (volunteer teams needing parts of rosters) is per-question visibility by role (Retreat Guru) rather than per-module or per-license access (Regpack).
- Splitting "what the kitchen needs" (meal type, diet notes) from "what only the registrar/teacher needs" (health, mental health) is how Retreat Guru avoids exposing medical detail on kitchen reports, though its docs do not say whether diet notes themselves are role-restricted.

### Gaps
- Retreat Guru does not document which roles can open the Meal Report or Housekeeping List.
- No meditation center publicly describes who sees health or trauma disclosures, or whether teachers see them.
- I found no product with a guest-facing explanation at the question ("only the registrar sees this").

---

## Lodging, roommates, meals, transportation: how are they collected and given to the people who need them?

### Takeaway
Retreat Guru is the only product with a full chain from registration choice to operational output: room inventory at booking → room assignment/switching → housekeeping list; meal plan + diet fields → kitchen Meal Report. Roommate requests and rides are not documented as features anywhere; centers use free-text, notes fields, or external boards.

### Cited Findings
- Room inventory shown during registration; flexible room types (same room sold as single/double/triple); program room blocks; staff rooms; bookings chart; switch rooms — [RG: Features](https://software.retreat.guru/features)
- Help articles exist for room blocks, manual room assignment, switching rooms mid-stay, room bookings chart — [RG: Features category](https://help.retreat.guru/knowledge/features?hsLang=en)
- Lodging-based pricing = tuition + per-day meals + lodging selection — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Meals configured globally, per program (override meal periods per day), and per registration (default, no meals, or custom); Kitchen Notes per program; Meal Report by date range with daily totals per meal and meal type, "Not Specified" count, asterisk for diet notes with expand-all, printable, plus extra meals for walk-ins/staff — [RG: Meals and Meal Reporting](https://help.retreat.guru/knowledge/meals-and-meal-reporting)
- Housekeeping List: arrivals/departures for a day, priority flag for same-day turnover, booked lodging type, last/next occupied, stay dates, admin-only "housekeeping notes" field — [RG: Housekeeping All Rooms Report](https://help.retreat.guru/knowledge/housekeeping-all-rooms-report)
- Retreat Guru "rooms and lodging" release note merges full and self-guided lodging versions (April 2026); does not document roommate requests or gender-specific rooms — [RG: Rooms and Lodging](https://help.retreat.guru/knowledge/rooms-and-lodging-v2)
- Retreat Guru waitlist doc suggests asking "gender identification for dormitory-specific programs" — [RG: Manage a Waitlist](https://help.retreat.guru/knowledge/create-a-waiting-list)
- Spirit Rock: 80 rooms mostly single, 16 double; "guaranteed single room" at top tier; Rideshare Board at spiritrock.org/rideshare — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)
- Regpack (marketing): add-on questions for "room type, dietary needs, session choices, and travel details"; roommate requests not mentioned — [Regpack: Retreat Registration](https://www.regpacks.com/solutions/retreat-registration-software)
- CampBrain Cabinizer: drag-and-drop cabin assignments for campers and staff — [CampBrain](https://campbrain.com/special-needs/)
- UltraCamp lists transportation and pickup authorizations among features (search snippet) — [UltraCamp features](https://www.ultracamp.com/features.html)

### Inferences
- RIM's day retreats with meals map to Retreat Guru's "custom number of meals per registration" plus a Meal Report: kitchen needs counts and diet notes, not names and health.
- Rides are handled by community boards (Spirit Rock) rather than registration software; a simple "can offer / need a ride" question with a roster view for a hospitality team would exceed what these tools document.

### Gaps
- No product documents roommate/bunkmate requests as a feature.
- No product documents ride matching.

---

## Retreat applications and approval: can a registrar or teacher approve before a place is confirmed?

### Takeaway
No product documents a built-in approve/decline step on a registration. Centers achieve it through workarounds: lotteries (sign up without payment, selected people get a short window to register), separate scholarship applications (Google Form), prerequisite interviews, "Free" application programs, password-protected programs, and custom registration statuses.

### Cited Findings
- Retreat Guru Free pricing is used "for application forms, such as volunteer programs, events, and scholarships" — [RG: Pricing Methods](https://help.retreat.guru/knowledge/pricing-options-for-programs)
- Retreat Guru custom registration statuses and password-protected programs — [RG: Features](https://software.retreat.guru/features)
- Retreat Guru rental inquiries are the only "inquiry" workflow listed; applications/approval are not on the features page — [RG: Features](https://software.retreat.guru/features)
- Retreat Guru waitlist promotion is manual (registrar sends registration link) and can be restricted to waitlisted people — [RG: Manage a Waitlist](https://help.retreat.guru/knowledge/create-a-waiting-list)
- IMS lottery: selected applicants get an email and must complete registration within one week; others go onto a random waitlist; prior non-selected applicants could request special consideration (2023 page, search snippet) — [IMS lottery sign-up](https://dharma.org/retreats/775)
- Spirit Rock lottery retreats: "Registering for a lottery does not ensure a space"; successful applicants have a short window to complete registration and pay (search snippet) — [Spirit Rock lottery on Retreat Guru](https://spirit-rock.secure.retreat.guru/program/labor-day-insight-meditation-retreat-lottery-288x21)
- Spirit Rock scholarships: separate application; declined applicants "automatically added to the scholarship waitlist" — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)
- Spirit Rock commuter eligibility requires at least one prior weeklong silent residential Insight retreat — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)
- ZMM: first-time sesshin participants "must have a pre-sesshin interview before you register" (search snippet) — [ZMM Founding Sesshin](https://zenmountainmonastery.secure.retreat.guru/program/founding-sesshin-6/)
- Insight Retreat Center: application plus $100 deposit to enter lottery (search snippet) — [Insight Retreat Center](https://www.insightretreatcenter.org/?p=26901)
- Deer Park runs a "Retreat Volunteer Application" as its own registration form (search snippet) — [Deer Park volunteer application](https://deerparkmonastery.org/retreats/retreat-volunteer-application/207272/register)
- SFZC: Tassajara summer stays "by reservation only," reservation request per retreat; scholarship availability posted per retreat (search snippets) — [SFZC Tassajara 2026](https://blogs.sfzc.org/blog/2026/01/12/tassajara-summer-retreats-2026/); [SFZC Scholarship Policies](https://sfzc.org/files/SFZC_ScholarshipPoliciesProcedures)

### Inferences
- An explicit "held pending review" state (application received → approved → pay/confirm) would be a genuine gap-filler; the field approximates it with two separate programs (an application program and a real program) or with a lottery.

### Gaps
- Whether Retreat Guru custom statuses can block confirmation emails or payment until a status changes is not documented.
- No source shows a teacher (rather than registrar) approving applications inside software.

---

## Arrivals/check-in, departures, and post-retreat follow-up

### Takeaway
Retreat Guru covers arrivals and departures operationally (arrival quick links, occupancy and housekeeping reports) and offers automated pre-arrival and post-departure emails, but no documented check-in button. Studio tools have self check-in and attendance (no-show) tracking. Follow-up dana is a center practice, not a software feature.

### Cited Findings
- Retreat Guru: arrival reporting and arrival/departure quick links in the registration list; occupancy report for "a better sense of guest arrivals and departures"; housekeeping reports — [RG: Features](https://software.retreat.guru/features)
- Retreat Guru Housekeeping List does not describe check-in features — [RG: Housekeeping All Rooms Report](https://help.retreat.guru/knowledge/housekeeping-all-rooms-report)
- Retreat Guru pre-arrival emails (N days before, per guest type, filtered by balance due / secondary form status) and post-departure emails (N days after); "Pre-Arrival Emails" described as sent "at whatever time intervals you choose" — [RG: Emails](https://help.retreat.guru/knowledge/emails-v2); [RG: Features](https://software.retreat.guru/features)
- Retreat Guru docs do not describe reminder emails or status-triggered emails beyond these — [RG: Emails](https://help.retreat.guru/knowledge/emails-v2)
- Mindbody self check-in screen; absent status for no-shows (search snippets) — [Mindbody: Self Check In](https://support.mindbodyonline.com/s/article/203259053-Self-sign-in?language=en_US); [Mindbody glossary](https://support.mindbodyonline.com/s/article/203254253-MINDBODY-glossary?language=en_US)
- Spirit Rock and IMS: dana invitation at the end of the retreat — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat); [IMS Fees](https://www.dharma.org/retreats/retreat-center/fees/)
- Spirit Rock: mid-retreat departures due to illness are not refundable; full waitlist gets openings first-come in the last two weeks — [Spirit Rock Labor Day 2026](https://www.spiritrock.org/programs/retreats/356r26-labor-day-insight-retreat)

### Inferences
- For RIM, the useful post-retreat pattern is Retreat Guru's post-departure email, which could carry the dana invitation online for people who didn't give at the retreat.
- A simple arrival check-in list for greeters (name, arrived yes/no) is not documented in Retreat Guru; studio tools are the closer model.

### Gaps
- Not found: a documented "checked in" status in Retreat Guru (it may exist via custom statuses, unconfirmed).
- Not found: UltraCamp/CampBrain check-in/check-out docs (UltraCamp help blocked; CampBrain public pages silent).
- Not found: which registration system IMS, BCBS, and SFZC use. IMS says online registration is preferred and it does "not accept registration by email" — [IMS Fees](https://www.dharma.org/retreats/retreat-center/fees/)
