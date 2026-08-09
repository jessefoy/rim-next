---
name: backlog
description: Add a feature idea to RIM's git-tracked backlog at data/backlog.json. Use when Jesse says "remember that we need [X]", "add this to the backlog", "put that on the list", or otherwise asks for something to be captured for later rather than built now. Covers the item schema, the valid categories, and the commit-and-push step.
---

# Feature Backlog

When Jesse says **"remember that we need [X]"**, **"add this to the backlog"**, or similar:

1. Read `data/backlog.json`
2. If vague, ask 1–2 clarifying questions — capture intent accurately
3. Add a new item with all required fields (see below)
4. Write the file back
5. `git add data/backlog.json && git commit -m "Backlog: add [title]" && git push`
6. Confirm — `data/backlog.json` is the git-tracked source of truth. There is no in-app viewer (the old `/admin/ideas` page was intentionally removed); read the backlog directly from the file or on GitHub.

**Item structure:**
```json
{
  "id": "YYYY-MM-DD-NNN",
  "title": "Short title",
  "description": "Clear description of what needs to be built and why.",
  "category": "One of the categories below",
  "priority": "high | medium | low",
  "status": "open",
  "addedAt": "YYYY-MM-DD",
  "notes": ""
}
```

**Valid categories:** `Registration` | `Member Accounts` | `Admin Tools` | `Programs` | `Sessions & Zoom` | `Courses & Library` | `Email & Notifications` | `Dashboard` | `Nav & Layout` | `CSS & Design` | `Infrastructure`

`Programs` and `Sessions & Zoom` were renamed in session 171 (from `Programs & Sanity` and `LiveKit / Session Room`) — both old names referenced systems RIM no longer runs. Don't reintroduce them.
