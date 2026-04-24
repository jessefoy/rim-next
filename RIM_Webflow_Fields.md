# RIM Webflow Field Reference

Quick reference for wiring Webflow elements to RIM Next data using `rim-connect.js`.

---

## How it works

Every Webflow page that uses live data needs `data-rim-*` attributes on elements in the designer. That's it — the script tag is already loaded site-wide from **Site Settings → Custom Code → Head Code**. No per-page setup required.

---

## Attribute vocabulary

| Attribute | Put it on | What it does |
|---|---|---|
| `data-rim-list="programs"` | Outer container div | Fetches the programs list, clones the template per item |
| `data-rim-item` | One child div inside the list | The card template — styled by you, cloned by JS |
| `data-rim-page="programs"` | Body or outer wrapper | Fetches a single program using `?slug=` from the URL |
| `data-rim-field="fieldName"` | Any text element | Sets text content from a field |
| `data-rim-html="fieldName"` | A **Div Block** only | Sets inner HTML (use for rich text / description) |
| `data-rim-href="/path/[slug]"` | A Link element | Sets the href; `[fieldName]` tokens are replaced |
| `data-rim-bg="fieldName"` | Any element | Sets `background-image: url(...)` on the element |
| `data-rim-src="fieldName"` | An Image element | Sets the image src |
| `data-rim-show="fieldName"` | Any element | Visible only when that field has a value |
| `data-rim-hide="fieldName"` | Any element | Hidden when that field has a value |
| `data-rim-state="loading"` | Div inside list container | Shown while fetching |
| `data-rim-state="empty"` | Div inside list container | Shown if no results |
| `data-rim-state="error"` | Div inside list container | Shown if fetch fails |

---

## Programs Listing Page (`/community-programs`)

**Body or wrapper:** no special attribute needed
**List container:** `data-rim-list="programs"`
**Item template:** `data-rim-item` on the card div

### Fields available inside `data-rim-item`

| Field | `data-rim-field` value | Element type | Always present? |
|---|---|---|---|
| Program name | `name` | Heading | ✓ |
| Category | `category.name` | Text | Optional |
| Schedule + format | `scheduleLabel` | Text Block | Optional |
| Program image | `data-rim-src="programImage"` | Image | Optional |
| Tagline | `tagline` | Text Block | Optional |
| Announcement | `specialAnnouncement` | Text Block | Optional |
| Dana note | `danaText` | Text Block | Optional |
| Link to detail page | `data-rim-href="/program-detail?slug=[slug]"` | Link Block | — |

### Example structure
```
Div  [data-rim-list="programs"]
  ├── Div  [data-rim-state="loading"]   → "Loading…"
  ├── Div  [data-rim-state="empty"]     → "No programs found."
  └── Div  [data-rim-item]              ← style this as your card
        ├── Heading  [data-rim-field="name"]
        ├── Text     [data-rim-field="scheduleLabel"]
        ├── Text     [data-rim-field="category.name"]
        └── Link     [data-rim-href="/program-detail?slug=[slug]"]
```

---

## Program Detail Page (`/program-detail`)

**Status: live.** Webflow page ID `69e985cd8cdb73f2540a9b47`, published at `/untitled/program-detail`.

**URL pattern:** `/program-detail?slug=monday-sitting-group`
**Links from listing:** set `data-rim-href` to `/program-detail?slug=[slug]`
**Body or outer wrapper:** `data-rim-page="programs"`

### What's currently wired (as of 2026-04-24)

Confirmed by reading the published HTML. If the Webflow page is re-audited, update this section to match.

**Hero**

| What | Attribute | Value |
|---|---|---|
| Background image | `data-rim-bg` | `programImage` |
| Category label | `data-rim-field` | `category.name` |
| Program name | `data-rim-field` | `name` |
| Tagline | `data-rim-field` + `data-rim-show` wrapper | `tagline` |

**Pull Quote**

| What | Attribute | Value |
|---|---|---|
| Section wrapper | `data-rim-show` | `pullQuote` |
| Quote text | `data-rim-field` | `pullQuote` |
| Quote source | `data-rim-field` | `pullQuoteSource` |

**Description** *(Div Block, not Text Block)*

| What | Attribute | Value |
|---|---|---|
| Description body | `data-rim-html` | `descriptionHtml` |

*No `data-rim-show` wrapper — renders always. Programs without a description will show an empty block.*

**Program Notes** *(Div Block, not Text Block)*

| What | Attribute | Value |
|---|---|---|
| Section wrapper | `data-rim-show` | `programNotesHtml` |
| Notes body | `data-rim-html` | `programNotesHtml` |

**Details**

| What | Attribute | Value |
|---|---|---|
| Schedule (day pattern) | `data-rim-field` | `scheduleLabel` |
| Time | `data-rim-field` | `timeLabel` |
| Location | `data-rim-field` + `data-rim-show` wrapper | `locationLabel` |
| Dana note | `data-rim-field` + `data-rim-show` wrapper | `danaText` |

**CTA** *(single-element drop-in — Div Block with `data-rim-html`)*

| What | Attribute | Value |
|---|---|---|
| CTA wrapper | `data-rim-show` | `ctaHtml` |
| CTA body | `data-rim-html` | `ctaHtml` |

`ctaHtml` is one prebuilt HTML fragment covering all guest states: register link / "Registration is closed" / "Members access Zoom via dashboard" / "Simply arrive in person · Members join online via dashboard". Simpler than wiring a register button + closed notice + membership note separately.

### Fields the API returns but Webflow isn't using yet

Available if you want to add them in a future pass:

| Field | Intended use | How to wire |
|---|---|---|
| `locationLink` | Google Maps URL for in-person venues | `data-rim-href="[locationLink]"` on a Link + `data-rim-show="locationLink"` on a wrapper |
| `formatLabel` | "In-Person" / "Zoom Only" / "In-Person & Zoom" | `data-rim-field="formatLabel"` on a Text element |
| `teacherNames` | Comma-separated list of facilitators | `data-rim-field="teacherNames"` + `data-rim-show="teacherNames"` on a section wrapper |
| `specialAnnouncement` | One-off notice for a program | `data-rim-field="specialAnnouncement"` + `data-rim-show="specialAnnouncement"` on a banner |
| `teachers` | Array of `{ name, slug }` for custom per-teacher rendering | Not supported by v3 list rendering inside detail pages — would require an API change or a second fetch |

### Complete field inventory (what `/api/public/programs/[slug]` returns)

| Field | Value | Notes |
|---|---|---|
| `id` | cuid string | Internal ID |
| `slug` | e.g. `monday-sitting-group` | Used in URLs |
| `name` | Program title | Always present |
| `tagline` | Short description | Optional |
| `programImage` | URL or null | Image src / bg |
| `pullQuote` | Quote text | Optional |
| `pullQuoteSource` | Attribution | Optional |
| `descriptionHtml` | HTML string | Optional — use `data-rim-html` |
| `programNotesHtml` | HTML string | Optional — use `data-rim-html` |
| `programFormat` | `in-person` / `virtual` / `hybrid` | Raw value |
| `formatLabel` | `In-Person` / `Zoom Only` / `In-Person & Zoom` | Human-readable |
| `scheduleLabel` | e.g. `Mondays` | Day/pattern only, no time |
| `timeLabel` | e.g. `9:30-10:30 AM CT` | Time only |
| `locationLabel` | e.g. `RIM Center + Online` | Computed from venue + format |
| `locationLink` | Google Maps URL or null | For map link href |
| `danaText` | Dana/donation note | Optional |
| `registrationEnabled` | true / false | |
| `registrationClosed` | true / false | Includes deadline check |
| `registrationUrl` | Full register URL | Explicit URL if needed separately |
| `ctaHtml` | HTML string | One-element drop-in covering all guest states |
| `specialAnnouncement` | Text or null | Optional |
| `category.name` | Category name | Optional |
| `category.slug` | Category slug | Optional |
| `teacherNames` | `"Jesse Foy, Teacher Two"` | Comma-separated string |
| `teachers` | Array of `{ name, slug }` | For custom teacher rendering |

---

## Live API endpoints

| Endpoint | Returns |
|---|---|
| `https://rim-next.vercel.app/api/public/programs` | All visible programs + categories |
| `https://rim-next.vercel.app/api/public/programs/[slug]` | Single program detail |

Both endpoints are public, CORS-enabled, and cached for 5 minutes (`s-maxage=300, stale-while-revalidate=86400`).

---

## How to audit what's actually wired

If you want to re-verify the Webflow page against this doc, the fastest path is:

```bash
curl -sL "https://www.rootedinmindfulness.org/untitled/program-detail" \
  | grep -oE 'data-rim-[a-z]+="[^"]*"' | sort -u
```

That's the authoritative list of what ships to visitors.
