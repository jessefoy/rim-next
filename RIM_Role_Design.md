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

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · March 2026*
*This is a living document. Add a new role section each time a hub goes through this design process.*
