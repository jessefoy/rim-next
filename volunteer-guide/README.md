# The RIM Guide

What volunteers' shared Claude project ("RIM Guide", in RIM's Claude for Nonprofits workspace) knows, so they can ask how the site works and why, look at it as they see it, and turn what they notice into a clear note for Jesse. Started 2026-10-27.

**How it reaches the project:** the **RIM Guide connector** (`app/api/guide-mcp/[key]/route.ts`) serves everything, read live. The project holds only the instructions. A push to `main` updates the guide; nothing is uploaded by hand.

**Each volunteer signs in (2026-10-27).** The connector asks each person to sign in with their own RIM account (OAuth with PKCE, RIM as its own sign-in: `lib/guideAuth.ts`, `app/api/guide-oauth/*`, the Allow page `app/guide/connect/page.tsx`). It then reads what that person can read on the site, through the site's own gates, with their roles read fresh on every call. Read-only: nothing it does writes to RIM. Sign-ins are kept by hash in `guide_grants`; access lasts an hour and renews itself; a code or renewal used twice ends that connection.

**What it serves:**
- The topics here, `1-…` to `6-…` (every `<number>-<name>.md`; the name after the number is the topic's name), and the design docs listed in `DESIGN_DOCS` in `lib/guideContent.ts` (the intentions; not the session log, UP_NEXT, the backlog, the stack reference or the sign-in doc).
- **Every signed-in screen's words and code**, for the screens in `screens.json`. The words (labels, hints, buttons, messages, with file and line) are pulled from the code at build time by `scripts/guide-screens.mjs` into `generated-screen-words.json` (not committed). Add a screen to `screens.json` when one is built; a folder entry takes new files automatically.
- The public pages' words, read live.
- **RIM's data, as the person sees it** (`lib/guideData.ts`): programs and their settings (`canUsePrograms`), people registered with answers, notes and history (`canUseRegistration`; dana amounts only with `canSeeDanaAmounts`), the email templates (ADMIN, like `/admin/emails`), members (ADMIN or REGISTRAR, section by section as the Member Registry shows them), and their teams' members, conversations and schedule (`canAccessHub`, `canAccessHubScheduler`).

Email addresses (other than Jesse's) and anything shaped like a key are blanked in the topics, docs and code it serves. People's details come only through the data tools, behind the gates.

**Keeping it current:** when a session changes something a topic describes, update that topic in the same commit. Screen words, design docs and public pages need nothing: they are read from the deploy.

- `INSTRUCTIONS.md` is pasted into the project's **Set project instructions**. Not served by the connector. If it changes, paste it again (the one manual step).
- This README is not served.

**Setup (once):** `GUIDE_CONNECTOR_KEY` (a random string of 24+ characters) is set in Vercel; the sign-in signs with a key derived from `AUTH_SECRET`, so it needs no setting of its own. A workspace owner adds the connector in Claude (Organization settings > Connectors > Add > Custom > Web) at `https://rim-next.vercel.app/api/guide-mcp/<the key>`; after the domain move the address changes with it, and the connector must be re-added. Each volunteer presses **Connect** (Customize > Connectors), signs in to RIM in the window that opens, and presses **Allow**. Verified 2026-10-27: the connector works in chats inside the shared project.

**For volunteers:** `Getting started with the RIM Guide.pdf` (made from `getting-started.html` by printing it with headless Chrome) walks someone new to Claude through joining, connecting, opening the project and sending a note.
