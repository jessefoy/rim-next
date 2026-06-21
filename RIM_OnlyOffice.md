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
