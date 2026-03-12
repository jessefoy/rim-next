# RIM System Architecture
**Structural decisions and the reasoning behind them**

This document records the foundational architectural decisions for how RIM's member data system and volunteer hub system work together. It is not a features doc — that's FEATURES.md. It is not a design philosophy doc — that's RIM_Web_Design_Philosophy.md. It is the structural model that governs how those features are built.

**Claude Code: Read this before working on any hub, member data, role, or permission-related feature.**

---

## The Two Systems

### Member Registry (`/admin/members`)

The Member Registry is the authoritative record of every person in the RIM community. It holds canonical member profiles: contact info, member status, household, tags, admin notes, registration history, course access, and role assignments.

**Who has direct access:** ADMIN and REGISTRAR only. No other roles should be granted access to `/admin/members`. This is not a filtering problem to solve — it is a boundary to maintain.

**What it is:** The system of record. Not a tool for volunteers to do their work. Not a filtered view for different roles.

### Hubs (`/account/hub/[slug]`)

Hubs are team workspaces for RIM's volunteer groups. Each hub serves one team. Members see only the hubs they belong to.

**Current hubs:** Host Team, People Team, Greeter Team, AV Team, Housekeeping, Plant Care, Newsletter, Sangha Care, KM Support, Silent Meditation, Volunteer Coordination (all OPERATIONAL) + Board and Teacher Council (GOVERNANCE).

**What they are:** Task-specific workspaces. Each hub currently provides Announcements, Documents, Conversations, and a Members tab. The Host Team hub also has a Schedule tab.

---

## The Core Architectural Principle

> **Volunteers access member data through their hub — not through the Member Registry.**

When a hub needs to surface member data, it does so as a **scoped projection**: only the fields relevant to that role, only the people within that role's scope, only the actions that role's work requires.

The Member Registry is never given to volunteers in filtered form. A restricted Member Registry is not the answer — it creates confusion, invites permission creep, and blurs the boundary between administrative authority and volunteer work.

### The right mental model

| System | Purpose |
|---|---|
| Member Registry | Canonical record authority |
| Hub member views | Task-specific projections of that data |

The same person may appear in multiple places — as a participant in a Host Team roster, a follow-up item in a People Team queue, a full profile in the Registry for ADMIN/REGISTRAR. Same person, different shape, different purpose.

---

## The Permission Framework

When designing member data access for any hub, answer four questions:

| Dimension | Question |
|---|---|
| **Fields** | What data does this role actually need to see? |
| **Scope** | Which people does that apply to? |
| **Actions** | What can they do? (view / mark attendance / add note / message / etc.) |
| **Purpose** | Which specific workflow is this access serving? |

This is the framework for every future hub data view. If a proposed feature can't clearly answer all four, it's not scoped tightly enough.

---

## The Build Model

**One hub role at a time.** Each hub with a member data need gets its own scoped view built specifically for that role's workflow. This approach:

- Keeps each implementation tight and testable
- Forces clear thinking about what each role actually needs
- Prevents permission creep
- Creates a reusable pattern that each subsequent hub can follow

---

## Decision Rule for Future Roles

When a new hub or role needs access to member data, ask one question:

**Does this role need a workflow view of people, or authority over member records?**

- Workflow view → build it inside the hub as a scoped projection
- Authority over records → grant REGISTRAR or ADMIN access to the Member Registry

Most volunteers need workflow views. Almost no one outside ADMIN and REGISTRAR needs the Registry.

---

## Multiple Roles

A person may belong to multiple hubs. Their effective permissions are the union of their hub memberships — but those permissions are still surfaced inside each hub's context, not combined into a single general-purpose people view.

Someone who is both a Host Team coordinator and a Volunteer Coordination member has two workspaces. They do not get a merged view of all member data across both.

---

## What's Next

The **Virtual Host Hub** is the first hub to receive a scoped member data view. It is the right starting point because:

- The host role already exists in the system
- The hub already has a schedule
- The scope is maximally clear: participants in the session the host is assigned to
- The required data is minimal: name, preferred name, attendance status

This implementation will establish the pattern for all subsequent hub data views.

---

## Naming

The system of record for member data is called the **Member Registry**. This is the preferred term in code comments, documentation, and conversation. Avoid "CRM," "CMS," "database," or "People Hub" when referring to this system.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · March 2026*
