---
name: livekit-self-hosted
description: "HISTORICAL — the LiveKit/OnlyOffice DigitalOcean droplet was DESTROYED session 161 (2026-07-09): DNS records (docs/livekit/livekit-turn) removed, ONLYOFFICE_* env removed, no DigitalOcean dependency remains. Supersedes the earlier 'droplet stays' state. Sessions are Zoom; files are Google. See [[project-zoom-migration]] + [[project-google-workspace-files]]"
metadata:
  node_type: memory
  type: project
  originSessionId: 6701f809-b23e-4f5d-8d5d-dfd59f7456cd
  modified: 2026-08-09T14:45:15.171Z
---

> **Nothing here is live infrastructure anymore.** The DigitalOcean droplet
> (`RIM-LiveKit`, which self-hosted the LiveKit server from session 150 and
> co-hosted OnlyOffice from session 154) was **destroyed in session 161**
> (2026-07-09), after the LiveKit room retired (s159, Zoom cutover) and
> OnlyOffice retired (s161). The `docs` / `livekit` / `livekit-turn` DNS
> records were removed and `ONLYOFFICE_URL` / `ONLYOFFICE_JWT_SECRET` came out
> of Vercel. RIM has **no DigitalOcean dependency**. (`LIVEKIT_*` Vercel vars:
> remove if any still exist — nothing reads them; noted in
> `RIM_Stack_Reference.md`.)

**History, for cost-reasoning reference only:** LiveKit Cloud metered
downstream data at $0.12/GB (~$260–620/mo at RIM's all-camera circle scale),
which drove the s150 move to a ~$58/mo flat DO droplet — and that operational
burden in turn helped justify the s159 "Zoom is the room" cutover. The old
SSH/firewall/OnlyOffice runbook detail lives in git history of this file and
`RIM_OnlyOffice.md` if ever needed.

**How to apply:** Don't propose DigitalOcean, LiveKit, RNNoise/Krisp, or
in-browser-room work — sessions run on Zoom ([[project-zoom-migration]],
`RIM_Zoom.md`) and documents live in Google ([[project-google-workspace-files]],
`RIM_GoogleWorkspace.md`).
