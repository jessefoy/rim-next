# RIM Webflow Field Reference

Quick reference for wiring Webflow elements to RIM Next data using `rim-connect.js`.

---

## How it works

Every Webflow page that uses live data needs:
1. A `<script>` tag in **Page Settings → Before `</body>`**
2. `data-rim-*` attributes on elements in the designer

**Script tag (same for every page):**
```html
<script src="https://rim-next.vercel.app/rim-connect.js" defer></script>
```

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

**URL pattern:** `/program-detail?slug=monday-sitting-group`  
**Links from listing:** set `data-rim-href` to `/program-detail?slug=[slug]`  
**Body or outer wrapper:** `data-rim-page="programs"`

### Hero

| What | Attribute | Value | Element |
|---|---|---|---|
| Background image | `data-rim-src` | `programImage` | Image |
| Category label | `data-rim-field` | `category.name` | Text |
| Program name | `data-rim-field` | `name` | Heading H1 |
| Tagline | `data-rim-field` | `tagline` | Text Block |
| Tagline wrapper | `data-rim-show` | `tagline` | Div |

### Pull Quote *(wrap section in a Div with `data-rim-show="pullQuote"`)*

| What | Attribute | Value | Element |
|---|---|---|---|
| Section wrapper | `data-rim-show` | `pullQuote` | Div |
| Quote text | `data-rim-field` | `pullQuote` | Text Block |
| Quote source | `data-rim-field` | `pullQuoteSource` | Text |

### Description *(rich text — must be a Div Block, not a Text Block)*

| What | Attribute | Value | Element |
|---|---|---|---|
| Section wrapper | `data-rim-show` | `descriptionHtml` | Div |
| Description body | `data-rim-html` | `descriptionHtml` | **Div Block** |

### Details

| What | Attribute | Value | Element |
|---|---|---|---|
| Schedule (day pattern) | `data-rim-field` | `scheduleLabel` | Text |
| Time | `data-rim-field` | `timeLabel` | Text |
| Location | `data-rim-field` | `locationLabel` | Text |
| Map link | `data-rim-href` | `[locationLink]` | Link |
| Map link wrapper | `data-rim-show` | `locationLink` | Div |
| Format | `data-rim-field` | `formatLabel` | Text |
| Dana note | `data-rim-field` | `danaText` | Text Block |
| Dana wrapper | `data-rim-show` | `danaText` | Div |

### Facilitators

| What | Attribute | Value | Element |
|---|---|---|---|
| Section wrapper | `data-rim-show` | `teacherNames` | Div |
| Teacher names | `data-rim-field` | `teacherNames` | Text Block |

### Registration

| What | Attribute | Value | Element |
|---|---|---|---|
| Register button | `data-rim-show` | `registrationEnabled` | Link Block |
| Register link | `data-rim-href` | `/programs/[slug]/register` | Link Block |
| Closed notice | `data-rim-show` | `registrationClosed` | Div |
| Announcement | `data-rim-field` | `specialAnnouncement` | Text Block |
| Announcement wrapper | `data-rim-show` | `specialAnnouncement` | Div |

### All detail page fields (complete list)

| Field | Value | Notes |
|---|---|---|
| `id` | cuid string | Internal ID |
| `slug` | e.g. `monday-sitting-group` | Used in URLs |
| `name` | Program title | Always present |
| `tagline` | Short description | Optional |
| `programImage` | URL or null | Image src |
| `pullQuote` | Quote text | Optional |
| `pullQuoteSource` | Attribution | Optional |
| `descriptionHtml` | HTML string | Optional — use `data-rim-html` |
| `programFormat` | `in-person` / `virtual` / `hybrid` | Raw value |
| `formatLabel` | `In-Person` / `Zoom Only` / `In-Person & Zoom` | Human-readable |
| `scheduleLabel` | e.g. `Mondays` | Day/pattern only, no time |
| `timeLabel` | e.g. `9:30-10:30 AM CT` | Time only |
| `locationLabel` | e.g. `RIM Center + Online` | Computed from venue + format |
| `locationLink` | Google Maps URL or null | For map link href |
| `danaText` | Dana/donation note | Optional |
| `registrationEnabled` | true / false | |
| `registrationClosed` | true / false | Includes deadline check |
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

Both endpoints are public, CORS-enabled, and cached for 60 seconds.
