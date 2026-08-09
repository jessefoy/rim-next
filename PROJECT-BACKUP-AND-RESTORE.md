# Project Backup & Restore Guide

Everything you need to get back up and running on a new machine.

---

## What Lives Where

| What | Where | How to Access |
|---|---|---|
| All app code (Next.js, CSS, API routes) | GitHub `jessefoy/rim-next` | `git clone https://github.com/jessefoy/rim-next.git` |
| Claude memory files | GitHub `rim-next/.claude-memory/` | Cloned with the repo |
| Database (members, programs, lessons) | Neon Postgres (cloud) | Connection string in Vercel env vars |
| File uploads (audio, PDFs, images) | Vercel Blob (cloud) | Managed via Vercel dashboard |
| Environment variables | Vercel dashboard | `npx vercel env pull .env.local` |
| Email service | Resend (transactional), Flodesk (newsletter) | Cloud dashboards |
| Video conferencing | Zoom (2 Pro pool seats; S2S OAuth) | Zoom admin dashboard |
| Team documents & files | Google Workspace (service account) | Google Cloud console + Drive |
| Gmail integration | Google Cloud OAuth2 | Cloud console |
| DNS / domain | Your registrar | rootedinmindfulness.org |
| Stripe (dana/donations) | Stripe Dashboard | Test keys in Vercel env |

---

## Restore on a New Machine

### 1. Install Prerequisites

```bash
# Install Node.js (v20+)
brew install node

# Install Claude Code
npm install -g @anthropic-ai/claude-code
```

### 2. Clone the Repos

```bash
cd ~/Sites
git clone https://github.com/jessefoy/rim-next.git
```

### 3. Install Dependencies

```bash
cd ~/Sites/rim-next
npm install
```

### 4. Pull Environment Variables from Vercel

```bash
# You'll need to log in to Vercel first
npx vercel login

# Link to the project
npx vercel link

# Pull all env vars
npx vercel env pull .env.local
```

This pulls all secrets: `AUTH_SECRET`, `RESEND_API_KEY`, `POSTGRES_PRISMA_URL`, `STRIPE_SECRET_KEY`, the `ZOOM_*` S2S credentials, the Google service-account keys, `CRON_SECRET`, and everything else.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Verify the Build

```bash
npm run build
```

If it builds clean, you're good. Push to GitHub and Vercel auto-deploys.

### 7. Restore Claude Code Memory

The Claude memory files are backed up in `rim-next/.claude-memory/` — a mirror of
the live memory directory (`MEMORY.md` index + one file per memory). Refreshed
session 171 (2026-08-08); refresh it at closing whenever memory has changed
meaningfully. To restore:

```bash
# Create the Claude project directory
mkdir -p ~/.claude/projects/-Users-$(whoami)-Sites-rim-next/memory

# Copy the whole mirror back
cp rim-next/.claude-memory/*.md \
   ~/.claude/projects/-Users-$(whoami)-Sites-rim-next/memory/
```

(The old rim-website memory backup was dropped session 171 — that project is
retired; its last snapshot is recoverable from git history.)

> **Note:** The Claude project directory path includes your username and the full path to the repo. If your new machine has a different username or directory structure, adjust the paths accordingly. The pattern is `~/.claude/projects/-Users-USERNAME-Sites-REPO-NAME/memory/`.

### 8. Start Working

```bash
cd ~/Sites/rim-next
claude
```

Claude will pick up the CLAUDE.md in the repo root and the restored memory files automatically.

---

## Ongoing Backup Routine

At the end of every Claude session:

1. **Commit and push both repos** — any uncommitted code goes to GitHub
2. **Sync memory files** — copy from `~/.claude/projects/` into `rim-next/.claude-memory/`, commit, push

Claude knows to do this automatically when asked (it's in the project memory).

---

## Key Accounts & Dashboards

| Service | URL |
|---|---|
| Vercel (hosting + env vars) | https://vercel.com/dashboard |
| GitHub | https://github.com/jessefoy |
| Neon (Postgres database) | https://console.neon.tech |
| Sanity Studio | https://rooted-in-mindfulness.sanity.studio/ |
| Resend (transactional email) | https://resend.com |
| Flodesk (newsletter) | https://flodesk.com |
| Stripe (donations) | https://dashboard.stripe.com |
| LiveKit (video) | https://cloud.livekit.io |
| Google Cloud (Gmail API) | https://console.cloud.google.com |

---

## What You Do NOT Need to Back Up

- **Database** — lives in Neon cloud, not on your machine
- **Uploaded files** — live in Vercel Blob, not on your machine
- **Sanity content** — lives in Sanity cloud
- **Environment secrets** — live in Vercel, pulled on demand
- **node_modules** — rebuilt with `npm install`
- **`.next/` build cache** — rebuilt with `npm run build`

The only things that live on your machine are the git repos (backed up to GitHub) and the Claude memory files (backed up to `.claude-memory/` in the repo).
