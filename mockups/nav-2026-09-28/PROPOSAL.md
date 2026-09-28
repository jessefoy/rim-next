# Nav proposal (Addendum C3), 2026-09-28

A proposal for Jesse's decision. Nothing here is built. Mockup: `index.html` in this folder (`?state=desktop | desktop-caps | mobile-a | mobile-b | sheet | sheet-desc`); screenshots in `shots/`.

## Audit of the current nav (live, measured)

- **Bar:** flush white, 100px tall on desktop and phone. Kept (the floating pill is a tombstone).
- **Desktop:** New to RIM (link) · Our Practice ▾ · Programs ▾ · Get Involved ▾ · Members ▾ · DONATE. All targets are 44px tall (backlog `2026-08-07-009` is already met).
- **Top-level labels are buttons, not links**, with no `aria-expanded`. Panels open on CSS `:hover` / `:focus-within`, with no hover intent, and **Esc does not close them**.
- **Panels:** 230px wide, white with no edge (over a white section a panel has no visible boundary). Each link already has a short line: titles 14px, lines 12px, divided by rules.
- **Donate:** "DONATE" typed in capitals, 12px bold tracked, on a hardcoded red (`#c23b3b`, not a token).
- **Phone:** an icon-only hamburger (44x44, labeled for screen readers only). The menu is one flat list of 13 links (53px each, 15px type), with Become a Member and Sign in first and Donate Today last. Esc closes it. **Focus is not moved into it or trapped, the page behind still scrolls, and focus does not return to the button.**

## The proposal (see the mockups)

**Desktop**
1. Each top-level label is a real link, with a small caret button beside it that opens the panel (the accessible split pattern): Our Practice → `/why-we-practice`, Programs → `/community-programs`, Get Involved → `/volunteerism/volunteer`. **Members has no single page**, so it stays a toggle only.
2. The panel opens on hover intent (about 300ms, with the same grace on leave), on click or Enter/Space on the caret, and closes on Esc (focus returns to the caret) or a click outside. `aria-expanded` and `aria-controls` are set on the caret. One panel is open at a time.
3. Panels are 340px wide, with 16px titles and 15px lines (up from 14 / 12), spacing instead of rules, and a Light Pampas hover. Lines are the brief's drafts, for Jesse's ear.
4. **Donate:** B, "Donate" in the site's pill voice (15px, sentence case), recommended; A, today's "DONATE", shown for comparison. The red becomes a token.

**Phone**
5. Header: the logo and a labeled **Menu** button (icon and word). Option **B adds a Donate pill** beside it (recommended: it is the site's one colored action, and RIM is donation-funded); option A is Menu alone. On phones the brand name drops in B to make room.
6. The open menu is a full-height sheet: a Close button where Menu was, **New to RIM** first as a highlighted row, then Our Practice, Programs and Get Involved under the desktop headings, with 48px rows at 18px. Sign in and Become a member sit together at the bottom, with Donate pinned full width beneath them.
7. Focus moves into the sheet and is trapped while it is open, the page behind does not scroll, and Esc and Close both close it and return focus to Menu.
8. **Descriptions on phones: recommended off.** The group headings carry the scent, and the sheet stays close to one screen. The `sheet-desc` screenshot shows them on, for comparison.

## What changes behavior (short list)

- Our Practice, Programs and Get Involved become links. A click on the label navigates; the caret opens the panel.
- Panels open with a short hover delay, close on Esc, and announce their state.
- The phone menu becomes a modal sheet: focus trapped, background locked, focus returned.
- Phone order: New to RIM first; Sign in and Join move from the top to the bottom.
- The phone header drops from 100px to 72px (sticky offsets such as the listing pages' `scroll-margin-top: 124px` would be rechecked).

## For Jesse's ear (labels)

- The draft lines rename **"Start a Community Group" → "Community Groups"** ("Practice with others near you") and **"Outreach for Organizations" → "Outreach"** ("Taking CARE for organizations"). The second reverses the 2026-09-25 ruling that the label say "for Organizations" so an organization recognizes it. The line now carries that; your call.
- On the phone, **Community Care Agreements** sits under Get Involved; on desktop it stays under Members.

## Audit of the proposal (impeccable: contrast, focus, targets)

- **Contrast:** panel lines (`--rim-text-muted` #666) on white 5.7:1, and on the hover ground about 5.5:1. The group labels (`--rim-mid`) on white about 6.5:1. White on the Donate red about 5.8:1. All pass AA.
- **Focus:** a 3px `--rim-mid` ring on the caret, Menu and Close (shown in the mockups). No `outline: none` anywhere.
- **Targets:** every control is 44px tall. **The caret is 28px wide**: that passes WCAG 2.5.8 (24px), but not RIM's own 44px floor. **RIM wins:** the build would give the caret a 44px hit area that extends invisibly under its padding.
- **The panel shadow:** RIM allows one shadow, `--card-shadow`, for white cards on the warm ground. The panel is a white card floating over the page, so the proposal uses that same lift plus a hairline edge, because a shadowless white panel over a white section has no boundary. This extends the sanctioned exception rather than adding a new one; Jesse decides.
