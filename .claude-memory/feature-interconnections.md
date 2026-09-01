---
name: feature-interconnections-map
description: How major features relate to and depend on each other. Read before proposing or building any new feature.
metadata: 
  node_type: memory
  type: project
  originSessionId: 3279c217-dfce-47fb-8f76-da2f1edfa43e
---

RIM Next is a deeply interconnected system. No feature exists in isolation. Before building anything, understand what it touches.

## The Three-Layer Architecture

```
Member Registry (/admin/members) — canonical record authority (ADMIN + REGISTRAR only)
    ↓ scoped projections
Hubs (/account/hub/[slug]) — team workspaces
    ↓ app links
Tools (/tools/*) — focused operational applications
```

Volunteers never see the Member Registry. They see scoped projections through their hub or tool. This boundary is intentional and must be maintained.

## Program Ecosystem

Program (Prisma) → connects to:
- **Registration** — capacity, waitlist, form responses, payment status
- **HostAssignment** — which hosts run which sessions (slugs are join keys — never change)
- **ProgramTeacher** — linked teacher accounts (Teacher pill + Co-host capability + bell-friendly audio in the session room)
- **ProgramCategory** — organizational grouping with sortOrder; its `kind` drives behavior (drop-in vs commitment) via `isOpenlyDroppable` — see `RIM_Offering_Model.md`
- **LiveKit room** — `livekitRoom` field = program slug
- **Open Access** — `isOpenAccess` + `guestAccessKey` for non-member guest joins
- **Dana/Donations** — four pricing modes via Stripe
- **Automated emails** — confirmation, reminder, dana nudge templates
- **Public page** (`/programs/[slug]`) — hero, details, CTA
- **Program Manager tool** (`/tools/programs`) — registrar creates/edits programs
- **Dashboard cards** — member sees their registered programs

Changing a program touches all of these. Adding a program field may need updates in the editor, public page, API, and dashboard.

## Hub Ecosystem

Hub → connects to:
- **HubMember** — access gate + coordinator status (authoritative for hosting capability / comms / pause when a row exists)
- **HubAppLink** — connects hub to tools in sidebar
- **Conversations** — threaded discussions with pinning, editable categories, reactions, subscription-based email notifications
- **Documents** — rich text (Tiptap) + PDF uploads, per-document notifications, author/coordinator locking
- **Activity stream** — computed union of document + conversation events
- **Three-stage lifecycle** — Active → Archived → Trash on both documents and threads
- **Home content** — coordinator-editable rich text
- **Welcome interstitial** — first-visit greeting
- **Dashboard hub cards** — unread badges based on lastVisitedAt

## Editor Ecosystem

One editor — **RimTiptapEditor** (Tiptap 3, plain-HTML storage) — serves every rich-text surface in three variants (minimal / message / document). Each placement has:
- A variant + its allowed blocks
- Its own output CSS class (all share the `.rim-content` base)
- A defined design intent

Canonical reference: **`RIM_Editor_Types.md`** (block library + placement registry). Adding a new editor surface requires a registry entry first. (The old two-editor BlockNote system and `RIM_Editor_Design.md` were retired in session 97.)

## Auth + Role Chain

User → roles[] → determines:
- Dashboard links visible
- Hub membership eligible
- Tool access (via `hasToolAccess()` or `UserToolAccess` grants)
- Member Registry access (ADMIN/REGISTRAR only)
- LiveKit session-room capability (identity-vs-capability split: isSessionHost / hasEndAllAuthority / isCoHost — see `RIM_SessionRoom.md`)

## Email System

Email templates (Prisma) → `lib/email.ts` → Resend
- Database-backed, admin-editable markdown
- Variable substitution with preview
- Triggered by: registration, role assignment, dana nudge, session attendance
- Connected to: programs, registrations, members, roles

## Why This Matters

When Jesse says "we need X feature," the first question is: what does X connect to? What existing systems does it touch? What pages need updating? What CSS prefixes apply? What design documents govern this area?

**How to apply:** Before proposing an implementation, trace the connections. Name them. Then build with awareness of the full picture.
