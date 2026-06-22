# RIM OnlyOffice — self-hosted document editing

OnlyOffice Docs (Community, self-hosted) is the office-document editing surface
for hub documents — `.docx` / `.xlsx` / `.pptx`, with live co-editing, comments,
version history, and real pages. RIM owns the document records, identity,
permissions, storage, and the surrounding hub UI; OnlyOffice owns only the
editing canvas. Each editing session is minted by RIM, so every editor is a
real, named RIM person (no external accounts) — the reason we chose self-hosted
OnlyOffice over Google Docs.

This doc is the operational reference. **§1 is the infra install (Slice 0).**
Later sections cover the app integration (editor-config, save callback) as those
slices land.

---

## 1. Infrastructure — OnlyOffice on the LiveKit droplet

### Where it runs
Co-hosted on the existing 8 GB LiveKit droplet (`104.248.229.126`, `RIM-LiveKit`,
NYC1). That box runs a 3-container LiveKit stack at
`/root/livekit.rootedinmindfulness.org/` (caddy + livekit + redis, **all host
networking**). OnlyOffice runs as a **separate, isolated stack** at
`/root/onlyoffice/` so its bundled Redis/Postgres can't collide with LiveKit's
host-network Redis (port 6379), and with **hard resource caps** so it can never
starve a live session.

### Why there's a "shim"
The LiveKit Caddy is the `caddyl4` build in **pure Layer-4 mode**: it routes by
TLS SNI on `:443` and raw-proxies the decrypted TCP stream to a local port — it
cannot add HTTP headers. OnlyOffice behind an SSL-terminating proxy **requires
`X-Forwarded-Proto: https`** or it emits document URLs over `http://` and the
browser blocks them on the HTTPS page (the most-reported OnlyOffice-proxy bug;
there is no env var to force it). So a tiny HTTP shim (`caddy:2-alpine`) sits
between the L4 Caddy and OnlyOffice and injects that header.

### Traffic path
```
browser → :443  (LiveKit Caddy, SNI = docs.rootedinmindfulness.org)
        → terminate TLS, raw TCP →  127.0.0.1:8081  (OnlyOffice shim)
        → + X-Forwarded-Proto: https →  onlyoffice-docs:80  (Document Server)
```
LiveKit's own routes (`livekit.` → 7880, `livekit-turn.` → 5349) are untouched.

---

### Files

**`/root/onlyoffice/docker-compose.yaml`**
```yaml
# OnlyOffice Docs (Community) + a header-injecting shim, isolated from the
# LiveKit stack. The LiveKit Caddy (host net, :443) routes the docs. SNI to the
# shim on 127.0.0.1:8081; the shim adds X-Forwarded-Proto:https (which the
# Layer-4 Caddy can't) and forwards to OnlyOffice on its internal :80.
services:
  onlyoffice-docs:
    image: onlyoffice/documentserver:latest
    container_name: onlyoffice-docs
    restart: unless-stopped
    environment:
      - JWT_ENABLED=true
      - JWT_SECRET=${ONLYOFFICE_JWT_SECRET}
      - JWT_HEADER=Authorization
    volumes:
      - ds_logs:/var/log/onlyoffice
      - ds_data:/var/www/onlyoffice/Data
      - ds_lib:/var/lib/onlyoffice
    networks: [onlyoffice]
    mem_limit: 3g
    cpus: 1.5

  onlyoffice-proxy:
    image: caddy:2-alpine
    container_name: onlyoffice-proxy
    restart: unless-stopped
    depends_on: [onlyoffice-docs]
    ports:
      - "127.0.0.1:8081:8081"   # only the host-net LiveKit Caddy reaches this
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    networks: [onlyoffice]

networks:
  onlyoffice:
    driver: bridge

volumes:
  ds_logs:
  ds_data:
  ds_lib:
```

**`/root/onlyoffice/Caddyfile`** (the shim — plain HTTP Caddy)
```
:8081 {
	reverse_proxy onlyoffice-docs:80 {
		header_up X-Forwarded-Proto https
		header_up X-Forwarded-Host docs.rootedinmindfulness.org
	}
}
```

**`/root/onlyoffice/.env`** (generated; never commit)
```
ONLYOFFICE_JWT_SECRET=<from: openssl rand -hex 32>
```

**LiveKit `caddy.yaml`** — add `docs.` to `tls.certificates.automate`, and add
ONE layer4 route (a mirror of the existing `livekit.` route) pointing at the
shim. The new route, appended under `apps.layer4.servers.main.routes`:
```yaml
          - match:
              - tls:
                  sni:
                    - "docs.rootedinmindfulness.org"
            handle:
              - handler: tls
                connection_policies:
                  - alpn: ["http/1.1"]
              - handler: proxy
                upstreams:
                  - dial: ["localhost:8081"]
```

---

### Apply sequence (safe · validated · zero-downtime · reversible)

Run during a **no-session window**. The only LiveKit-risky step (the Caddy
reload) is gated behind a *local* OnlyOffice health check, is config-validated
first, and uses a **graceful reload** (no `:443` downtime).

**0 — Confirm DNS resolves**
```
dig +short docs.rootedinmindfulness.org      # must print 104.248.229.126
```

**1 — Create the OnlyOffice stack** (`mkdir`, generate the secret, write the two
files from above)
```
mkdir -p /root/onlyoffice && cd /root/onlyoffice
echo "ONLYOFFICE_JWT_SECRET=$(openssl rand -hex 32)" > .env
# write docker-compose.yaml and Caddyfile (contents above)
```

**2 — Start OnlyOffice + shim** (first boot ~60s)
```
cd /root/onlyoffice && docker compose up -d
```

**3 — Health-check LOCALLY, before touching the LiveKit Caddy**
```
curl -s http://127.0.0.1:8081/healthcheck      # must print: true
```
If this isn't `true`, stop and fix here — LiveKit is still untouched.

**4 — Add the docs. route to the LiveKit Caddy** (backup → edit → validate → graceful reload)
```
cd /root/livekit.rootedinmindfulness.org
cp caddy.yaml caddy.yaml.bak
# edit caddy.yaml: add docs. to automate + the docs. route (above)
docker compose exec caddy caddy validate --config /etc/caddy.yaml --adapter yaml
docker compose exec caddy caddy reload   --config /etc/caddy.yaml --adapter yaml
```
`validate` must pass before `reload`. `reload` is graceful — existing LiveKit
connections are not dropped.

**5 — Verify end-to-end**
```
docker compose logs --tail=40 caddy                          # look for the docs. cert being obtained
curl -sI https://docs.rootedinmindfulness.org/healthcheck    # → HTTP/2 200
```
Then open `https://docs.rootedinmindfulness.org/` — OnlyOffice's welcome page.

### Rollback (instant)
```
cd /root/livekit.rootedinmindfulness.org
cp caddy.yaml.bak caddy.yaml
docker compose exec caddy caddy reload --config /etc/caddy.yaml --adapter yaml
```
The OnlyOffice stack is independent — leave it or `docker compose down` in
`/root/onlyoffice`. Nothing about rollback touches LiveKit's own routes.

---

### RIM app side (lands with Slice 2)
The generated `ONLYOFFICE_JWT_SECRET` must ALSO be set in RIM's environment
(Vercel) — RIM signs each editor config with it and verifies the save callback's
JWT. Also set `ONLYOFFICE_URL=https://docs.rootedinmindfulness.org`.

### Operational notes
- **Resource caps:** OnlyOffice is capped at 3 GB / 1.5 vCPU of the box's
  8 GB / 4 vCPU, leaving LiveKit comfortable headroom. Tune in the compose.
- **Persistence:** documents live in RIM's storage, *not* in OnlyOffice — its
  bundled DB is transient editing state, so the three persisted volumes
  (logs / Data / lib) are sufficient; a restart drops only in-flight sessions.
- **Updating OnlyOffice:** `cd /root/onlyoffice && docker compose pull && docker compose up -d` — never touches the LiveKit stack.
- **Firewall:** no new port — OnlyOffice is reached only via the existing :443
  through Caddy; `127.0.0.1:8081` is localhost-only.

---

## 2. App integration — the save loop

`lib/onlyoffice.ts` is the hub: HS256 JWT sign/verify (via `node:crypto`, no dep),
the editor-config builder, the office-type mapping, blank-file seeding, and the
download/edited-file URL helpers. Three routes:

```
GET  /api/documents/[id]/editor-config   → JWT-signed config for DocsAPI.DocEditor (canAccessDocument-gated)
GET  /api/onlyoffice/download/[id]?token  → streams the file to the doc server (download-token-gated, NOT session)
POST /api/onlyoffice/callback             → the doc server posts edits back (JWT-only, NOT session)
```

**Traffic, end to end:** browser fetches editor-config from RIM → loads `api.js`
from the doc server → `DocsAPI.DocEditor(config)`. The **doc server** (on the
droplet) then fetches `document.url` (RIM's download route) and, on save, POSTs
to `callbackUrl` (RIM's callback). Both RIM URLs are built **deploy-relative**
from the editor-config request (`requestBaseUrl(req)`, not a fixed env) so the
loop stays on whatever host the editor was opened from.

`document.key = ${id}-${version}` — it MUST change whenever the file changes or
OnlyOffice serves a stale cached copy. The callback bumps `version` on save, so
the next open gets a fresh key.

### ⚠️ Gotcha #1 — the callback JWT nests the body under `payload` (the s155 save bug)
OnlyOffice signs its callback into the **`Authorization` header** (because the
container runs `JWT_HEADER=Authorization`). That header token, once verified,
has the shape `{ payload: { key, status, url, … }, iat, exp }` — the callback
fields are **under `payload`**, not at the top level. Reading `verified.status`
directly returns `undefined`, so `if (status === 2 || status === 6)` never
matches and **nothing ever saves** (the editor works, edits just vanish on
reopen). The fix, in `app/api/onlyoffice/callback/route.ts`:

```ts
const cb = verified.payload ?? verified;   // header-nested OR body-embedded token
const { key, status, url } = cb;
```

This was the real root of "edits don't persist," masquerading for a full session
as an SSRF-guard problem. **If a future change touches the callback, log the
verified token's keys before trusting any field.**

### ⚠️ Gotcha #2 — the edited-file URL host is internal; pin it before fetching
On save, `url` (the edited file the doc server wants RIM to download) comes back
with an **internal host** — a docker name / loopback / private IP — because the
doc server sits behind the Caddy-L4 + shim proxy and reports itself that way.
Vercel can't reach that host. `resolveEditedFileUrl(url)` rewrites the host to
the configured public `ONLYOFFICE_URL` origin (preserving path + signed query;
clearing `user:pass`) before `fetch`. This both makes it reachable **and** is a
*stronger* SSRF boundary than the old origin-equality check (`isDocumentServerUrl`,
removed) — we only ever fetch the host we trust, never the one we're handed.

### Save semantics
- **status 2 (MustSave, ~10s after the last editor closes):** claim the next
  `version` atomically, write `hub-docs/<id>/v<n>.<ext>` to Blob, update
  `storageKey`, then delete the previous version's blob.
- **status 6 (ForceSave, mid-session):** persist in place under the *same*
  version's blob (no bump) — bumping mid-session would strand the open editor's
  key.
- Always return `{"error":0}` on a *handled* request (even on a swallowed save
  failure) so OnlyOffice doesn't loop; failures are logged for Vercel.

---

## 3. The editor surface — `components/OnlyOfficeEditor.tsx`

Fetches editor-config, loads `api.js`, hands the config to `DocsAPI.DocEditor`.
Full-screen at `/account/documents/[id]/office` (server-gated by
`canUserAccessDocument`, re-checked when the client fetches editor-config).

### ⚠️ Gotcha #3 — DocEditor REPLACES its target node (the React crash)
`DocsAPI.DocEditor(id, config)` swaps the element with that id for an `<iframe>`.
If React owns that element and later mutates a sibling around it (toggling an
overlay, unmounting), React's commit-phase `insertBefore`/`removeChild`
references a node that's gone → **`NotFoundError: The object can not be found
here`**, white-screening the page. The correct pattern (now in the component):

- Render an **empty React-owned host** `<div ref={hostRef} className="oo-editor-mount" />`
  with **no JSX children**.
- In the effect, `document.createElement` the mount node, give it the id,
  `hostRef.current.replaceChildren(mount)`, and point `DocEditor` at it. React
  never reconciles the OnlyOffice node.
- Loading / stalled overlays are **trailing siblings** (after the host) so React
  only ever appends/removes nodes it owns.
- Cleanup: `destroyEditor()` then `hostRef.current.replaceChildren()`.

### ⚠️ Gotcha #4 — the loading overlay masks the doc server's real error
"Opening editor…" only clears on `onDocumentReady`, so a doc-server failure
(JWT, download, conversion) hides behind it forever. The component now surfaces
it: `onError` shows a banner with the error code, and a **25s readiness timeout**
reveals the editor surface + a banner so OnlyOffice's own message (e.g. "The
document security token is not correctly formed") is visible underneath. When
diagnosing a hang, that banner — not an endless overlay — is what you should see
on the current build; a bare endless overlay means a stale build/domain.

### Red herring to remember
A "stuck on Opening editor…" hang has TWO very different causes that look
identical: a JWT-secret mismatch (Vercel ≠ droplet) **and** the editor simply
failing to finish loading (download/convert). If the editor opens with **no
"security token" message**, the secret is fine — don't chase rotation. The s155
hang was *not* JWT (a 4-agent workflow ranked it #1; it was wrong); it was the
React crash masking the still-broken save. Instrument before theorizing.

---

## 4. Access, placement, and the doc page

`lib/documentAuth.ts::canAccessDocument` / `canEditDocument` are pure (author +
GUIDING_TEACHER always; COMMUNITY = every active member; HUB / COORDINATORS
scoped to the doc's placed hubs; ADMIN-alone does **not** auto-pass). The
editor-config route and the full-screen `/office` page both gate on it.

The hub **doc-view page** (`/account/hub/[slug]/documents/[id]`) is an office
doc's home: it branches on `docKind === "ONLYOFFICE"` → metadata + an **"Open in
editor" CTA** + the Comments panel, instead of native body / markdown export /
the native `/edit` link. The hub list-link points here (not straight to the
editor). This page is **`canAccessDocument`-gated as of Slice 4 (s156)** — it loads the
doc's placements + the viewer's memberships and requires the doc to live in this
hub (origin or a placement) AND the viewer to pass `canAccessDocument`, so a
shared/community doc resolves instead of 404ing. (Before s156 it was
`canAccessHub` + `doc.hubId === hub.id`, which matched only because office docs
were single-hub.) The native Edit link stays origin-only.

## 5. Comments (not topics)

The doc page's discussion panel reuses `HubConversationThread` (shared with hub
conversations), whose `title` is **required**. A document is its own subject, so
the panel (`HubDocConversationsClient`) **drops the title input** — you just "Add
a comment" — and derives a short heading from the comment's first line so the
~13 shared thread/list/detail surfaces keep working with **no schema change**.
The proper fix (true `title`-nullable) is ~13 consumer surfaces — backlogged.
(In-document, anchored comments are a separate thing: OnlyOffice's own in-editor
comments, enabled via the config `permissions.comment`.)

## 6. Current state & what's left

**Live on production, gated to coordinators** (`officeEnabled && isCoordinator`
in `HubDocumentsClient`). Working end-to-end: create → edit → **save** → comment.

**Slice 4 — ✅ shipped session 156** (the document filing system: freshness +
search, category governance, cross-hub sharing/visibility, the master directory
`/account/documents`). Canonical reference: **`RIM_Documents.md`**. The placement
create-path rejects `hubId === document.hubId`; the doc-view page moved to
`canAccessDocument` (see §4).

Open, in rough order:
- **Ungate** — drop `&& isCoordinator` so all hub members get office docs.
- **Slice 5** — migrate existing plain native docs → `.docx` (server-side).
- **Polish** — mobile editing, the still-slowish first open (download/convert
  warm-up), surfacing version history, the proper `title`-nullable comment fix.
- **Rotate `ONLYOFFICE_JWT_SECRET`** — it was pasted in the s154 chat
  (regenerate `/root/onlyoffice/.env` → `docker compose up -d --force-recreate
  onlyoffice-docs` → update Vercel Production → redeploy; the module-level const
  needs a cold start). Hygiene, not blocking.

## Pitfalls quick-reference
1. Callback fields are under `verified.payload` (header token) — read `?? verified`.
2. Edited-file URL host is internal — `resolveEditedFileUrl` pins it to `ONLYOFFICE_URL`.
3. DocEditor replaces its node — give it a non-React-owned mount; overlays trailing.
4. The loading overlay masks doc-server errors — surface `onError` + a timeout.
5. "Opening editor…" hang ≠ JWT by default — only if a "security token" message shows.
6. `document.key` must change when the file changes (the version bump does this).
7. The callback is JWT-only, session-less — the one deliberate exception.
