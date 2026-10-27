# The RIM Guide

What volunteers' shared Claude project ("RIM Guide", in RIM's Claude for Nonprofits workspace) knows, so they can ask how the site works and why, and turn what they notice into a clear note for Jesse. Started 2026-10-27.

**How it reaches the project:** the **RIM Guide connector** (`app/api/guide-mcp/[key]/route.ts`, `lib/guideContent.ts`) serves these files and the public pages' own words, read live. The project holds only the instructions. A push to `main` updates the guide; nothing is uploaded by hand.

- `INSTRUCTIONS.md` is pasted into the project's **Set project instructions**. Not served by the connector. If it changes, paste it again (the one manual step).
- `1-…` to `6-…` are the guide's topics. The connector serves every `<number>-<name>.md` here; the name after the number is the topic's name.
- This README is not served.

**Everything served is visible to every volunteer.** No member names except Jesse, no personal contact details, no dana amounts, no keys or IDs, nothing from the session log or UP_NEXT.

**Keeping it current:** when a session changes something a topic describes, update that topic in the same commit. The public pages' words need nothing: the connector reads them live.

**Setup (once):** `GUIDE_CONNECTOR_KEY` (a random string of 24+ characters) is set in Vercel. A workspace owner adds the connector in Claude (Organization settings > Connectors > Add > Custom > Web) at `https://rim-next.vercel.app/api/guide-mcp/<the key>`; after the domain move the address changes with it, and the connector must be re-added. Each volunteer presses **Connect** once (Customize > Connectors).
