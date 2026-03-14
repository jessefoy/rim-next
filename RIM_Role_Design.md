# RIM Role Design
**The thinking behind each volunteer role — workflows, intentions, and design decisions**

This document captures the design process for each volunteer role and hub at RIM. It records not just what was built, but why — the real-world workflow, the pastoral intentions, the tradeoffs considered, and the decisions made. It is a permanent reference for future coordinators, for designing subsequent hubs consistently, and for Claude Code understanding the spirit behind what it's building.

**Claude Code: Read the relevant role section before building any hub feature.**

---

## How to Use This Document

Each role section follows the same structure:
- **What this role actually does** — the real human workflow, not a job description
- **The two dimensions** — every role at RIM has a technical/logistical dimension and a relational/pastoral dimension. Both matter equally.
- **What the system needs to support** — organized by when in the workflow it's needed
- **Design decisions and why** — the tradeoffs considered and the choices made
- **What's deferred and why** — things intentionally not built yet
- **Phase 1 scope** — exactly what gets built first

---

## Virtual Host (Host Team)

### What this role actually does

A virtual host facilitates RIM's online sessions on Google Meet. Their job has two equally important dimensions:

**Technical/logistical:** Log into the correct room account before the session, open the space, manage the technical environment, monitor chat, handle any issues, close the room when the session ends.

**Relational/pastoral:** Arrive 12 minutes early to hold a welcoming space as members gather. Foster genuine community connection during that pre-session window. Welcome people — especially new ones — in a way that feels warm and human, not procedural. Keep the container safe and aligned with RIM's spirit while the teacher is teaching. Embody presence, because presence fosters presence.

These two dimensions are inseparable. A host who is technically competent but not present is missing the point. A host who is present but technically unprepared creates chaos. Both are required.

### The two-host ideal

The ideal is eventually two hosts per session: one holding the relational space, one handling the technical and tracking side. This isn't always realistic, but it's the design target. The system should support it when it's possible — including a "silent host" role where one person tracks attendance and flags while remaining largely invisible to participants.

### The host coordinator

The host coordinator is a team steward role, still developing. Their responsibilities:
- Keep the team organized and supported
- Train new hosts
- Ensure the team is following the mission and vision of the role
- Handle technical questions and backend issues
- Lead the team's ongoing learning and practice
- Be the go-to person — not Jesse

The coordinator is not an administrator in the traditional sense. They are a pastoral lead for the team. Jesse may offer contemplations and engage in team conversations, but the coordinator holds day-to-day responsibility. This is part of RIM's broader intention: building a community that doesn't depend entirely on Jesse.

### The program landscape

Most of RIM's virtual offerings are **open** — drop-ins, good morning/evening sessions, dharma study. No registration required. Members and sometimes guests just show up.

A smaller number of programs require **registration** — courses, retreats, structured programs.

This distinction matters significantly for what a host can know before and during a session:
- Registered programs: a roster exists. The system knows who's coming.
- Open programs: no roster. People appear in the room. The system only knows who's there once they arrive.

### What the system needs to support

#### Before the session (registered programs only)
- A simple roster of who registered
- For open programs: nothing — there is nothing to show yet

#### During the session
- A live view that populates automatically as members click the Meet link from their logged-in dashboard
- New member flag — first time attending anything at RIM
- Returning-after-absence flag — member who hasn't attended in 6+ weeks
- Registered but hasn't shown up — for registered programs only
- One-tap to mark a person: "remember this person for a post-session note"
- Nothing else. The host needs to be present with people. This view is glanced at, not worked.

**Critical design principle:** The live view must require almost no interaction. A tap is acceptable. Reading, typing, or deciding during a session is not. If using the tool pulls the host out of presence, the tool is wrong.

#### After the session (post-session form)
The post-session window — while the session is still fresh — is where the real work happens. Hosts should expect to spend up to five minutes here. This is part of the role, not optional.

The form has two sections:

**Section one — flagged people**
Each person the host tapped during the session appears here with a note field and a routing choice:

| Flag type | What it means | Routes to |
|---|---|---|
| Gentle follow-up | Someone who seemed uncertain, a new person who might appreciate a reach-out | Jesse + host coordinator |
| Jesse only | Something sensitive happened — someone in the chat suggested they were in a dark place, something that needs careful pastoral attention | Jesse alone, private |
| Technical issue | Something went wrong with the room, the account, the tech | Host coordinator |
| No action needed | The tap was precautionary; nothing required | Nobody |

**Section two — session reflection**
A single open text field. The spirit of the session, challenges that came up, anything worth the team remembering. This is contemplative as much as operational — it's how the team learns together and how the coordinator supports hosts over time. Optional but strongly encouraged.

**Section three — session resource**
If something came up during the session that the whole group would benefit from — a book reference, a PDF, a link — the host can add it here and it goes out to everyone whose attendance was recorded that night. Routes through support/registrar for now.

#### Automated emails
Two automated emails, both starting in disabled/draft state until the copy is written and approved by Jesse:

- **First-time attendee:** A warm, brief welcome. Triggered when a member attends their first RIM session of any kind.
- **Returning after absence:** A gentle "good to see you." Triggered when a member who hasn't attended in 6+ weeks shows up.

**Important:** Both emails must be written carefully enough that a false positive isn't damaging. Someone might be a regular on a different day than the host is familiar with. The tone should be warm and generic enough that receiving it unexpectedly doesn't feel like surveillance or make someone feel overlooked.

### Design decisions and why

**Why not a partial Member Registry view?**
Hosts are not record stewards. They don't need to browse member profiles, edit data, or see registration history. Giving them a filtered version of the Member Registry would blur the boundary between volunteer work and administrative authority, invite permission creep, and create confusion about what the host role actually is. The hub provides a task-specific projection only.

**Why track attendance via link click rather than manual check-in?**
Frictionless. The member does nothing extra. The host does nothing extra. The data appears naturally from behavior that's already happening. Manual check-in would require either the host or the member to do something, which creates friction, inconsistency, and pulls the host out of presence.

**Why flag types instead of free routing?**
At RIM's current size and role maturity, smart routing is premature. The coordinator role is still forming. The support/communications function is still carried by the registrar. Simple, honest routing to known people is more reliable than a system that tries to be clever. When the roles mature, the routing can too.

**Why start automated emails in disabled state?**
The words matter enormously at a dharma center. An automated email that sounds generic or surveillance-y would actively harm the community's trust. Better to build the infrastructure and wait for the right words than to send something wrong at scale.

**Why no email templates library in Phase 1?**
You don't yet know which situations recur enough to warrant a template. Build the simple version, run it, and let the patterns emerge. Templates written for imagined scenarios often miss the real ones.

### What's deferred and why

**Sensitive context flags (pre-session)**
The idea of attaching notes to a member's record that a host should be aware of before a session — fragility, a difficult history, something the care team wanted to flag. This raises serious privacy questions: who writes these notes, who can see them, under what circumstances, with what consent. The risks outweigh the benefits until there is a clear pastoral ethics framework around it. Deferred indefinitely until that framework exists.

**In-person and hybrid check-in**
The same attendance tracking logic applies — but for in-person, it probably means a QR code at the door that a logged-in member scans. Simple in principle, but a separate build. Noted for future phases.

**Email templates library**
A coordinator-maintained library of situational email templates for common post-session scenarios. Useful eventually. Premature now. The coordinator role needs to be more established before they can own and maintain this well.

**Multi-team routing logic**
As RIM develops a communications/support hub — an internal "switchboard" team that receives, filters, and routes information to the right person or team — the routing logic will mature. For now, flags go to Jesse and the coordinator. That's honest about where the roles actually are.

**The communications/support hub**
A future team concept: external-facing for general inquiries, internal-facing for routing information between teams. Like a sangha switchboard. When this team exists, post-session flags and resource requests will route through them. For now, that function lives with the registrar/general support person.

### Phase 1 scope

See the Claude Code session brief for the exact build spec.

---

## Registrar (Registrar Hub + Support Team)

### What this role actually does

The registrar is the operational backbone of RIM's program life cycle. From the moment a program is announced to the moment the last participant leaves, the registrar holds the logistical thread. Historically this role required managing five or six separate systems — a CMS, a form builder, an email platform, a project management tool, a spreadsheet, and an inbox. The new system exists specifically to collapse all of that into one place.

The registrar's work has two equally important dimensions:

**Technical/logistical:** Build and publish programs (once Program Management is in Postgres). Monitor registrations, track capacity, manage waitlists. Coordinate check-in for in-person events. Ensure confirmation and reminder emails go out correctly. Give stakeholders visibility into participant numbers without manual updates. Maintain the donation and payment record for programs. Generate check-in materials when needed.

**Relational/pastoral:** The registrar is often the first human contact a person has with RIM after they've decided to engage. Answering a registration question, handling a payment concern, helping someone find the right program — these are not just logistics. They are the first moment of welcome. The registrar should handle logistical questions with warmth and clarity. For anything that carries emotional weight — someone struggling financially, someone asking questions that suggest they're in a difficult place, anything that feels like it needs a teacher's attention — they escalate to Jesse or the guiding teacher. The registrar holds the threshold. They don't have to hold everything on the other side of it.

### The support team dimension

The registrar is currently also RIM's primary support contact, answering support@rootedinmindfulness.org alone. This is not sustainable and not the right design. Support is a team function, and the registrar is one member of that team — the one whose lane is program logistics and registration questions. As the support team grows, other lanes will be staffed: pastoral questions to the teacher, general community questions to a future communications role, technical issues to an appropriate volunteer.

The infrastructure for this is the Support Inbox — a hub feature that surfaces the support@ Gmail inbox (and Jesse's jesse@inbox as a connected channel) inside the system, with claiming, routing, and thread history. When the Support Inbox is built, the registrar will use it as their primary tool for support work rather than working from Gmail directly. The system will surface member context alongside each email — who this person is, what they've registered for, whether they're on a waitlist — eliminating the manual lookup step that currently adds friction to every support interaction.

Until the Support Inbox is built, the registrar continues to work from Gmail. No interim tooling is required.

### The program coordinator distinction

The registrar handles the people side of a program: registrations, communications, check-in, and support. A future program coordinator role will handle the program side: building the offering, coordinating logistics, working with venues, teachers, and outside stakeholders on content and setup. These roles overlap at the edges — particularly around venue logistics and participant preparation — and that overlap is acceptable and expected. The boundary is not a wall; it is a default. When in doubt, the registrar owns the participant relationship and the program coordinator owns the program logistics.

This role split does not exist yet. It is a design target as RIM's volunteer structure matures.

### The stakeholder visibility principle

Multiple people have a legitimate need to see registration data without the ability to edit it: the teacher preparing to lead a session, an event or retreat coordinator finalizing numbers, a venue contact needing a headcount, a volunteer coordinator assigning roles. None of these people are the registrar. None of them should need to ask the registrar for an update.

The Registrar Hub should provide a read-only stakeholder view of active programs — participant count, capacity status, waitlist status, key names — accessible to any team member with a legitimate need. The goal is to make the registrar's manual update work unnecessary, not to give everyone administrative access.

### What the system needs to support

**Program management (Phase 3 — when programs move to Postgres)**

- Create, edit, and publish programs from within the hub
- Set capacity, registration open/close dates, pricing, waitlist behavior
- Attach confirmation and reminder email templates per program
- Program status visibility: draft, open, closed, full, waitlisted

**Registration management (active programs)**

- Per-program participant list: name, registration date, payment status, any form responses
- Waitlist view with position order
- Capacity alert when a program approaches or reaches its limit
- Ability to manually register someone, move them from waitlist, or cancel a registration
- Registration questionnaire responses visible inline — no export required

**Stakeholder visibility**

- Read-only program dashboard accessible to authorized team members
- Shows: registered count, capacity, waitlist count, program status
- No participant PII visible to stakeholders — headcount and status only, unless the stakeholder role explicitly requires names (e.g. retreat coordinator)

**Check-in tools**

- Digital check-in view per program: participant list, tap to mark present
- PDF export of participant list for in-person events (for those who prefer a printed sheet)
- Future: member self-check-in via phone (same "no holes" tracking model as the virtual attendance system)
- Device context: phone-first. The registrar or a check-in volunteer should be able to run this from a phone standing at a door.

**Support Inbox (future — high priority)**

- Surfaces support@rootedinmindfulness.org inside the hub
- Jesse's jesse@ connected as a routable channel — emails can be passed to him when needed
- Claiming: a team member claims a thread and owns the response
- Routing: one-click pass to Jesse or another team member
- Member context panel: if the sender is a known member, their profile data and registration history appear alongside the thread
- Thread history: full conversation visible to all support team members
- Status: open, claimed, resolved
- No email leaves the system without being claimed — nothing gets missed, nothing answered twice

**Technical approach:** The Support Inbox is built on the Gmail API using Google OAuth. Both support@rootedinmindfulness.org and jesse@rootedinmindfulness.org are Google Workspace accounts — this is what makes the integration possible. The Gmail API supports reading full thread history, sending replies, applying labels, and archiving, all programmatically. Inside the hub, each incoming thread can be enriched with member context by matching the sender's email address against the Member Registry — surfacing name, member status, registration history, and current program enrollments alongside the message. This is read/write: the registrar replies from inside the system and the response goes out from the actual Gmail account. No forwarding, no BCC workarounds. The OAuth connection is established once per account and stored as a server-side credential. This is the same pattern used by tools like Help Scout and Front, built natively into the RIM system.

**Payment and donation oversight**

- Per-program payment summary: amount collected, outstanding, refunded
- Donation record for programs with dana or suggested-donation pricing
- Lightweight — automation handles the transactions; the registrar needs visibility, not controls

### Design decisions and why

**Why does the registrar have Member Registry access when hosts do not?** The registrar holds administrative authority over participant records, not just a workflow view. They need to look up members, resolve duplicate records, correct registration errors, and handle edge cases that require seeing the full profile. This is categorically different from what a host needs. The boundary in the architecture document holds: hosts get workflow projections, the registrar gets registry access. Same system, different relationship to it.

**Why is the Support Inbox a separate hub feature and not just "use Gmail"?** Because the value isn't email management — it's the connection between the email and the member record. Every support tool on the market operates blind to your community data. Building it inside the system means the registrar sees immediately who they're talking to, what they've registered for, and what their history is. That's not possible from Gmail. The cost of building it is justified by how much manual lookup time it eliminates and how much better the support experience becomes for participants.

**Why keep check-in on phone rather than building a dedicated kiosk or QR system now?** The phone-in-hand model requires nothing new of the volunteer doing check-in. Everyone already has one. It works immediately. The self-check-in and QR system is the right eventual design — it's already conceptually solved by the virtual attendance model — but it requires a member-facing interface and a reliable internet connection at the venue. Build the simple version first, observe how it's used, and let the self-check-in feature follow naturally.

**Why is the program coordinator a deferred role rather than a current one?** Because the person currently doing registrar work is also doing program coordinator work, and artificially splitting the role now would create confusion without adding a second person. The role split becomes meaningful when there is actually a second person to fill it. The design documents both so that when that person appears, the boundaries are already thought through.

### What's deferred and why

**Support Inbox** The Gmail API integration is technically feasible and high priority, but it is its own significant build. It does not block the Registrar Hub's core functionality. It will be specced and built as a dedicated feature after the hub's core program and registration management is working.

**Member self-check-in** Requires a member-facing check-in interface and a reliable in-venue connection. The pattern is established by the virtual attendance system. Deferred until the registrar check-in tools are in use and the self-check-in flow can be tested in a real in-person context.

**Program coordinator role** Deferred until there is a second person to hold it. The design boundary is documented here so that the transition requires no rethinking — only role assignment.

**Stakeholder names visibility** Whether certain stakeholders (retreat venue coordinators, for example) should see participant names in addition to headcount is a privacy and permissions question that depends on the specific program and stakeholder relationship. Start with headcount-only for all stakeholders. Expand when a real use case requires it and the appropriate permission scope is clear.

**Sensitive context flags in registration** The idea of flagging a registration with a private note visible only to the teacher or registrar — someone who has asked for special accommodation, someone whose situation the teacher should know about before the session. This carries the same privacy framework questions as the Host role's deferred sensitive context flags. It needs a clear policy about who writes them, who can see them, and under what circumstances before it's built.

### Phase 1 scope

To be written as a dedicated spec after this role design is reviewed and approved. Will cover: migrating the existing /account/registrar functionality into the hub pattern at /account/hub/registrar/, per-program registration views, capacity and waitlist management, and the stakeholder visibility dashboard. Program creation and editing (Phase 3) is a separate spec. Support Inbox is a separate spec.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · March 2026*
*This is a living document. Add a new role section each time a hub goes through this design process.*
