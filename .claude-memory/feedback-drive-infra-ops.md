---
name: feedback-drive-infra-ops
description: "On infra/server/terminal work, drive it yourself (DO console via the Chrome extension, run checks yourself); hand Jesse only ONE short command when his auth is unavoidable"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1303d913-99f8-4c22-b0fb-eb0ef06ff016
---

For infrastructure / server / terminal tasks, Claude should **drive** the work — operate the DigitalOcean console through the Chrome browser extension, run the external verifications (port probes, HTTPS checks) itself — rather than hand Jesse long multi-step command blocks to paste. When a step genuinely requires Jesse's own machine (SSH that needs his password or Secure-Enclave key), give him exactly ONE short command, not a block to work through.

**Why:** During the session-152 server hardening (DO Cloud Firewall, OS updates + reboot, SSH IP-restriction) Jesse said "I'm not sure what I am doing." The session went well precisely because Claude drove the console and ran the checks, tapping Jesse in only for the single command his authentication required. Jesse is a capable developer but is not a server-ops specialist and doesn't want to fumble through a wall of terminal commands.

**How to apply:**
- Default infra sessions to "I'll drive": use the Chrome extension on the DO console, run probes/curl checks from here, report what I see in plain English.
- Only involve Jesse for steps I literally cannot do (his SSH auth / hardware key) — and then it's ONE short command, with the why stated plainly.
- Hard limit to remember: a sandboxed Claude shell CANNOT SSH into the droplet — see [[livekit-self-hosted]] for the access model. Route to Jesse-interactive or the DO web Console instead of retrying SSH.
- This is the ops-work counterpart to the co-creation stance in [[user-jesse]] and [[feedback-engagement]].
