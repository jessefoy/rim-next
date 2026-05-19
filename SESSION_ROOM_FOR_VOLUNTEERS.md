# The RIM Session Room — Plain-English Notes for Volunteers

_Last updated May 2026 (session 117)_

This doc is for hosts, teachers, registrars, and anyone else in the Sangha who'll be running or attending sessions in the RIM session room — the video space that replaces Zoom for our online programs.

Over the last few sessions of work we made a lot of changes. The short version: **the session room should now feel almost identical to Zoom**, so you can use what you already know. If you've ever clicked "Mute" in Zoom, the same click is in the same place here.

This is a walkthrough of what changed, why, and what you'll actually see.

---

## What the room is, briefly

When a virtual or hybrid program goes live, members click "Join" from their dashboard and arrive in a full-page video room called the RIM Session Room. It's built on a service called LiveKit (the engine), wrapped in our own interface designed to match Zoom's familiar layout.

You don't need to download anything. No Zoom account. No Google account. It runs in the browser and uses your normal RIM login.

---

## What you'll see

### Top of the screen

A thin dark bar:

- **Left:** if you're a host-team member but not the assigned host today, you'll see a "Step in as Host" button.
- **Center:** the program name.
- **Right:** a "Speaker | Gallery" toggle and a fullscreen button. Speaker view focuses on whoever's currently talking. Gallery shows the grid.

### The video area

The dark space where everyone's tiles live. If someone has their camera off, you'll see either:

- Their **uploaded presence photo** (they can set this in Settings inside the room, or in their member account)
- Or a **colored circle with their initials** if they haven't uploaded a photo

There's no more generic gray silhouette — everyone has something personal.

A 3px **yellow outline** appears around whoever is currently speaking.

At the bottom-left of each tile: their name in plain white text. If they're muted, a small red mic-with-a-slash appears next to their name. If they're a host, a small "Host" pill appears next to their name.

If anyone raises their hand, a yellow banner appears across the top of the video area: "Jane raised their hand," with a "View" button to jump straight to the participants panel.

### Bottom of the screen — the control bar

Six clusters, in this order, matching Zoom exactly:

1. **Mute / Unmute** — click the big mic button to toggle yourself. The small upward arrow next to it opens a device picker (which microphone, which speaker).
2. **Start Video / Stop Video** — same pattern. Arrow next to it opens a camera picker.
3. **Participants** — opens the right-side panel showing everyone in the room. Shows a count badge.
4. **Chat** — opens the chat sidebar on the right.
5. **Share Screen** — turns green when you're sharing.
6. **Reactions** — opens a small popover with five quick reactions: raise hand (✋), heart, namaste (🙏), yes (✓), no (✗). The hand stays raised until you click it again to lower it; the others auto-clear after 5 seconds.
7. **Settings** — opens the right-side settings panel (presence photo, audio devices, camera).
8. **End / Leave** — red button on the far right. As a host, clicking it asks: "End Meeting for All" or "Leave Meeting." As a regular member: just "Leave."

The control bar **fades out after about 3 seconds of inactivity**, like Zoom. Move your mouse or press any key and it slides back. The room is meant to feel like a meditation space when you're sitting in it; the chrome shouldn't be in your face the whole time.

### The participants panel

Click "Participants" in the control bar:

- **You're at the top** of the list, marked "(you)," with a small "Host" pill if you're a host.
- Other participants below, sorted alphabetically.
- People with raised hands float to the top of the remote list.
- Each row shows their name, signal (if any), mic state, and — if you're a host — a "Mute" button next to their name (or a "Muted" pill if they're already muted).
- At the bottom (host only): a "Mute All" button.
- If more than 10 people are in the room, a search box appears at the top.

### The chat sidebar

Click "Chat" in the control bar. Chat now has **real history** — refresh the page or join late, and you'll see the prior messages. (Before, the chat reset every time.)

**Direct messages work like Zoom.** Above the message box is a "To:" dropdown. Default is "Everyone." Pick a participant's name and your message goes only to them. Private messages have a teal left border and a "(private)" label so you can tell at a glance who saw what.

You can also send and receive in real time without the page being refreshed.

### Settings panel

Click the gear icon in the control bar:

- **Audio:** dropdown to pick your microphone and your speakers.
- **Video:** dropdown to pick your camera.
- **Presence photo:** upload, change, or remove the photo that shows on your tile when your camera is off.

Your device choices are remembered across sessions.

---

## What hosts can do

Same as Zoom hosts, with the items we support:

| Action | Where |
|---|---|
| Mute one person | Participants panel, "Mute" button next to their name |
| Mute all | Participants panel footer |
| End the session for everyone | End button → "End Meeting for All" |
| Step in as host | Top-left of the page header (if you're host-team but not assigned today) |
| Pin someone to focus | Switch to Speaker view, then hover their tile and click the pin icon |

Things Zoom hosts have that we don't: spotlight (a host-driven global pin that everyone sees), remove participant, lock the meeting, recording, and breakout rooms. None of these were in our old session room either; they're not gone — they were never there. If we need any of them, that's a separate feature build.

---

## What's behind the scenes (so you're not surprised)

- **Audio quality** is now noticeably better. Voices should sound full, not phone-call thin. Teachers get extra-high-fidelity audio that preserves singing bowls and bells; regular speakers and listeners get clean speech audio. Echo cancellation, noise suppression, and automatic gain are all on by default. Headphones still help — there's a one-line hint at the audio-prompt screen reminding people that speakers can cause echo for others.
- **Video quality** uses the H.264 codec — the same one Zoom uses — at up to 2.5 Mbps and 30 fps. Should look noticeably sharper than what we had before. The room background is pure black to match Zoom's depth.
- **Host privileges** are determined by who's assigned the session (HostAssignment), who's marked as the program's teacher (ProgramTeacher), who has the HOST_MANAGER role, or who's ADMIN. All checked server-side, so the Host pill on someone's name is a UI cue — actual host actions are validated by the server every time.
- **Guests** can join Open Access programs via a guest link without an account. They show up in chat and the participants panel with the name they typed at the door.

---

## What may still be imperfect (and what's next)

These are known follow-ups, not bugs we missed:

- The "Spotlight" feature (host pins someone for everyone) — we have local pin (Speaker view) but not the host-driven global one.
- "Test Microphone" and "Test Speakers" buttons in Settings — useful for troubleshooting, not yet built.
- "Mirror my video" toggle in Settings — Zoom has this; we don't yet.
- Background blur and virtual backgrounds — removed earlier and not rebuilt.

If something feels off when you're testing — audio, video, or any UI behavior — tell Jesse. The changes in this session were guided by what the Sangha actually noticed in the first few rounds of testing, and that feedback is how we keep closing the gap.

---

## For our co-creator with Claude

The work to bring the session room to this point spanned multiple Claude Code sessions and a lot of incremental changes. The full technical record is in `session-log.md`. The system architecture and stack reference are in `RIM_System_Architecture.md` and `RIM_Stack_Reference.md`. If you're touching anything in `components/session/` or `components/VideoRoom.tsx`, read those first.
