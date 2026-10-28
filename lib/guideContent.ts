import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The RIM Guide's knowledge, served live (2026-10-27). Volunteers chat with a
 * shared Claude project whose only knowledge is this: the topic files in
 * volunteer-guide/ (shipped with the deploy, next.config.ts) and the public
 * pages' own words, read from the site at the moment of asking. One source for
 * Claude Code and the volunteers' guide, so a push updates both and nothing is
 * ever re-uploaded. Read by app/api/guide-mcp/[key]/route.ts.
 *
 * Since the guide signs each volunteer in (lib/guideAuth.ts), it also reads
 * the signed-in screens' words and code and the design docs, below; nothing
 * here reads the database (people's details come through lib/guideData.ts,
 * behind the site's own gates). Email addresses are blanked in what it serves.
 */

const GUIDE_DIR = path.join(process.cwd(), "volunteer-guide");

export type GuideTopic = { slug: string; title: string; file: string };

/** "3-programs-and-registration.md" → slug "programs-and-registration". */
export async function listGuideTopics(): Promise<GuideTopic[]> {
  const files = (await readdir(GUIDE_DIR)).filter((f) => /^\d+-[a-z0-9-]+\.md$/.test(f)).sort();
  return Promise.all(
    files.map(async (file) => {
      const text = await readFile(path.join(GUIDE_DIR, file), "utf8");
      const title = text.match(/^#\s+(.+)$/m)?.[1].trim() ?? file;
      return { slug: file.replace(/^\d+-/, "").replace(/\.md$/, ""), title, file };
    }),
  );
}

async function topicText(slug: string): Promise<{ topic: GuideTopic; text: string } | null> {
  const topic = (await listGuideTopics()).find((t) => t.slug === slug.trim().toLowerCase());
  if (!topic) return null;
  return { topic, text: await readFile(path.join(GUIDE_DIR, topic.file), "utf8") };
}

/** A topic's sections, split at its ##, ### and #### headings. */
function sections(text: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  let heading = "";
  let lines: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^#{2,4}\s+(.+)$/);
    if (m) {
      if (lines.join("").trim()) out.push({ heading, body: lines.join("\n").trim() });
      heading = m[1].trim();
      lines = [line];
    } else {
      lines.push(line);
    }
  }
  if (lines.join("").trim()) out.push({ heading, body: lines.join("\n").trim() });
  return out;
}

/** A whole topic, or the section whose heading contains `section`. */
export async function readGuideTopic(slug: string, section?: string): Promise<string | null> {
  const found = await topicText(slug);
  if (!found) return null;
  if (!section?.trim()) return found.text;
  const want = section.trim().toLowerCase();
  const match = sections(found.text).filter((s) => s.heading.toLowerCase().includes(want));
  return match.length ? match.map((s) => s.body).join("\n\n") : null;
}

/** Longest a search result quotes a section before pointing to read_guide. */
const SECTION_CAP = 3000;

const STOP = new Set(["the", "and", "not", "can", "can't", "for", "with", "what", "why", "how", "does", "doesn't", "when", "where", "who", "this", "that", "there", "their", "they", "from", "into", "about", "was", "are", "you", "your", "our", "has", "have", "isn't", "don't"]);

/** The sections that mention the most of the query's words, best first: the
 *  guide's topics and the design docs, or only one of them. */
export async function searchGuide(query: string, limit = 6, within: "guide" | "docs" | "both" = "both"): Promise<string> {
  const words = query.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return "Ask with a few words, such as \"waiting list email\".";
  const scored: { score: number; where: string; body: string }[] = [];
  const sources: { title: string; slug: string; text: string }[] = [];
  if (within !== "docs") {
    for (const topic of await listGuideTopics()) {
      sources.push({ title: topic.title, slug: topic.slug, text: await readFile(path.join(GUIDE_DIR, topic.file), "utf8") });
    }
  }
  if (within !== "guide") {
    for (const doc of DESIGN_DOCS) {
      const text = await designDocText(doc);
      if (text) sources.push({ title: `Design doc ${doc}`, slug: doc, text });
    }
  }
  for (const topic of sources) {
    const text = topic.text;
    for (const s of sections(text)) {
      const hay = s.body.toLowerCase();
      const head = s.heading.toLowerCase();
      // How many of the words it holds counts most; repeats count a little.
      let score = 0;
      for (const w of words) {
        if (head.includes(w)) score += 3;
        if (hay.includes(w)) score += 4 + Math.min(2, hay.split(w).length - 2);
      }
      if (score > 0) scored.push({ score, where: `${topic.title} (${topic.slug})${s.heading ? `, "${s.heading}"` : ""}`, body: s.body });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return `Nothing in the guide matches "${query}". Try other words, or read a topic.`;
  return scored
    .slice(0, limit)
    .map((s) => `From ${s.where}:\n\n${s.body.length > SECTION_CAP ? `${s.body.slice(0, SECTION_CAP)}\n\n(The section goes on: read it with read_guide.)` : s.body}`)
    .join("\n\n---\n\n");
}

// ─── The design docs: why RIM is built the way it is ─────────────────────────

/**
 * The project's design references the guide may read (2026-10-27): the
 * intentions behind each screen. Not served: the session log, UP_NEXT, the
 * backlog, the stack reference and the sign-in doc, and retired or historical
 * docs. Email addresses are blanked, Jesse's aside.
 */
export const DESIGN_DOCS = [
  "RIM_Web_Design_Philosophy.md", "RIM_Public_Pages.md", "RIM_System_Architecture.md",
  "RIM_Feature_Interconnections.md", "RIM_Role_Design.md", "RIM_Offering_Model.md",
  "RIM_Registration.md", "RIM_Registration_App.md", "RIM_ProgramEditor.md", "RIM_CourseEditor.md",
  "RIM_Scheduler.md", "RIM_Member_Area.md", "RIM_MemberRegistry.md", "RIM_Hub_Model.md",
  "RIM_Zoom.md", "RIM_GoogleWorkspace.md", "RIM_Tutorials.md", "RIM_Email_Engineering.md",
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g;
const KEYISH = /\b(sk|pk|rk)_(test|live)_[A-Za-z0-9]+|\bre_[A-Za-z0-9_]{20,}|\bwhsec_[A-Za-z0-9]+/g;
/** No one's address and nothing that looks like a key leaves through the guide. */
export function redactPrivate(text: string): string {
  return text
    .replace(EMAIL, (m) => (m.toLowerCase() === "jesse@rootedinmindfulness.org" ? m : "[an email address]"))
    .replace(KEYISH, "[a key]");
}

function docName(raw: string): string | null {
  // "program editor", "RIM_ProgramEditor" and "programeditor.md" are one doc.
  const key = (s: string) => s.toLowerCase().replace(/\.md$/, "").replace(/^rim[_\s-]*/, "").replace(/[\s_-]+/g, "");
  return DESIGN_DOCS.find((d) => key(d) === key(raw.trim())) ?? null;
}

async function designDocText(doc: string): Promise<string | null> {
  try {
    return redactPrivate(await readFile(path.join(process.cwd(), doc), "utf8"));
  } catch {
    return null;
  }
}

/** Longest a design doc's answer runs before pointing to a narrower section. */
const DOC_CAP = 14_000;

/** A design doc's opening and its headings, or the sections whose heading has `section`. */
export async function readDesignDoc(raw: string, section?: string): Promise<string> {
  const doc = docName(raw);
  if (!doc) return `There's no design doc "${raw}". They are: ${DESIGN_DOCS.join(", ")}.`;
  const text = await designDocText(doc);
  if (!text) return `${doc} can't be read just now.`;
  const all = sections(text);
  if (!section?.trim()) {
    const intro = all[0]?.heading ? "" : all[0]?.body ?? "";
    const headings = text.split("\n").filter((l) => /^#{2,3}\s/.test(l)).map((l) => l.replace(/^(#+)\s+/, (_m, h: string) => (h.length === 2 ? "- " : "  - ")));
    return `${doc}\n\n${intro.slice(0, 3000)}${intro.length > 3000 ? "\n\n(The opening goes on.)" : ""}\n\nIts sections (read one by giving words from its heading):\n${headings.join("\n")}`;
  }
  const want = section.trim().toLowerCase();
  const match = all.filter((s) => s.heading.toLowerCase().includes(want));
  if (!match.length) return `No section of ${doc} has "${section}" in its heading. Read the doc without a section to see its headings.`;
  const body = match.map((s) => s.body).join("\n\n");
  return body.length > DOC_CAP ? `${body.slice(0, DOC_CAP)}\n\n(This goes on: ask for a narrower section.)` : body;
}

// ─── The signed-in screens: their words and the code behind them ─────────────

type Screen = { title: string; where: string; files: string[] };

async function screenList(): Promise<Record<string, Screen>> {
  const raw = JSON.parse(await readFile(path.join(GUIDE_DIR, "screens.json"), "utf8")) as Record<string, Screen | string>;
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_"))) as Record<string, Screen>;
}

async function screenFiles(screen: Screen): Promise<string[]> {
  const out: string[] = [];
  for (const entry of screen.files) {
    if (entry.endsWith("/")) {
      try {
        const found = (await readdir(path.join(process.cwd(), entry), { recursive: true }))
          .map((f) => path.join(entry, String(f)))
          .filter((f) => /\.(tsx|ts)$/.test(f) && !f.endsWith(".d.ts"));
        out.push(...found.sort());
      } catch {
        /* a folder not shipped reads as empty */
      }
    } else {
      out.push(entry);
    }
  }
  return out;
}

const SCREEN_CAP = 40_000;

/** The screens it can read, or one screen's words with their files and lines. */
export async function screenWords(slug?: string, part?: string): Promise<string> {
  const screens = await screenList();
  if (!slug?.trim()) {
    return `The signed-in screens whose words can be read:\n${Object.entries(screens).map(([k, s]) => `- ${k}: ${s.title} (${s.where})`).join("\n")}`;
  }
  const screen = screens[slug.trim().toLowerCase()];
  if (!screen) return `There's no screen "${slug}". The screens are: ${Object.keys(screens).join(", ")}.`;
  let words: { files: Record<string, [number, string][]> };
  try {
    words = JSON.parse(await readFile(path.join(GUIDE_DIR, "generated-screen-words.json"), "utf8"));
  } catch {
    return "The screens' words can't be read just now (they are made when the site is deployed). Read the code instead with screen_code.";
  }
  const want = part?.trim().toLowerCase();
  const files = (await screenFiles(screen)).filter((f) => !want || f.toLowerCase().includes(want));
  if (!files.length) return `No file of ${slug} has "${part}" in its name. Its files: ${(await screenFiles(screen)).join(", ")}.`;
  const blocks = files.map((f) => {
    const lines = words.files[f] ?? [];
    return `### ${f}\n${lines.length ? lines.map(([n, t]) => `${n}: ${t}`).join("\n") : "(no words)"}`;
  });
  const body = `${screen.title}, at ${screen.where}. Each line is the line in the code where the words are; "…" stands for something filled in, such as a name.\n\n${blocks.join("\n\n")}`;
  return body.length > SCREEN_CAP
    ? `${body.slice(0, SCREEN_CAP)}\n\n(This goes on: ask again with part set to one file's name, such as "${files[files.length - 1].split("/").pop()?.replace(/\.tsx?$/, "")}".)`
    : body;
}

const CODE_LINES = 160;

/** Lines of code from one screen's file, numbered, around a line or between two. */
export async function screenCode(file: string, around?: number, from?: number, to?: number): Promise<string> {
  const clean = file.trim().replace(/^\/+/, "");
  const screens = await screenList();
  const allowed = new Set((await Promise.all(Object.values(screens).map(screenFiles))).flat());
  if (!allowed.has(clean)) {
    return `${clean} isn't one of the screens' files. Find a screen's files with screen_words, then read one by its full name.`;
  }
  let text: string;
  try {
    text = await readFile(path.join(process.cwd(), clean), "utf8");
  } catch {
    return `${clean} can't be read just now.`;
  }
  const lines = redactPrivate(text).split("\n");
  let start = 1;
  let end = Math.min(lines.length, CODE_LINES);
  if (around && around > 0) {
    start = Math.max(1, Math.floor(around) - 60);
    end = Math.min(lines.length, start + CODE_LINES - 1);
  } else if (from && from > 0) {
    start = Math.floor(from);
    end = Math.min(lines.length, to && to >= start ? Math.min(Math.floor(to), start + CODE_LINES - 1) : start + CODE_LINES - 1);
  }
  const shown = lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join("\n");
  return `${clean}, lines ${start} to ${end} of ${lines.length}:\n\n${shown}`;
}

// ─── A public page's words, read live ────────────────────────────────────────

/** Most of a page's words returned at once (the longest public page is ~12k). */
const PAGE_CAP = 60_000;

/** Areas that need sign-in or aren't pages; the guide reads only public pages. */
const NOT_PUBLIC = /^\/(api|account|admin|tools|session|login|_next)(\/|$)/;

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", middot: "·", rarr: "→", larr: "←",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

/** The visible words inside the page's <main>, as plain Markdown-ish lines. */
function pageText(html: string): { title: string; body: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  let main = html.match(/<main[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? html;
  main = main
    .replace(/<(script|style|noscript|svg|template|nav|footer)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<h1\b[^>]*>/gi, "\n\n# ")
    .replace(/<h2\b[^>]*>/gi, "\n\n## ")
    .replace(/<h[3-6]\b[^>]*>/gi, "\n\n### ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|section|article|header|ul|ol|li|h[1-6]|blockquote|figure|figcaption|summary|details|dt|dd|label|form)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const body = decode(main)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l, i, all) => l && !(l === all[i - 1]))
    .join("\n")
    .replace(/\n(#+ )/g, "\n\n$1");
  return { title, body };
}

/**
 * The words on one public page right now, fetched from the site itself.
 * `origin` is the site's own address (the route passes NEXTAUTH_URL), never
 * the request's Host, and a redirect off the site is refused.
 */
export async function publicPageWords(origin: string, rawPath: string): Promise<string> {
  let p = rawPath.trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    return "That doesn't look like a page address. Give the part after the site name, such as /new-to-rim.";
  }
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (!/^\/[a-z0-9\-/]*$/i.test(p) || p.includes("..")) {
    return "That doesn't look like a page address. Give the part after the site name, such as /new-to-rim.";
  }
  if (NOT_PUBLIC.test(p)) {
    return `${p} is behind sign-in, so its words can't be read here. Use the site map and the other topics, or ask the volunteer to copy the words from their screen.`;
  }
  const res = await fetch(`${origin}${p}`, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const final = new URL(res.url);
  if (final.origin !== new URL(origin).origin) {
    return `${p} leads off RIM's site, so its words aren't read here.`;
  }
  const finalPath = final.pathname;
  if (NOT_PUBLIC.test(finalPath)) {
    return `${p} asks a visitor to sign in, so its words can't be read here. Ask the volunteer to copy the words from their screen.`;
  }
  if (!res.ok) return `${p} didn't open (status ${res.status}). Check the address in the site map.`;
  const { title, body } = pageText(await res.text());
  const moved = finalPath !== p ? ` (it opens ${finalPath})` : "";
  const words = body.length > PAGE_CAP ? `${body.slice(0, PAGE_CAP)}\n\n(The page goes on; this is its first part.)` : body;
  return `Page ${p}${moved}, read just now. Browser tab: ${title}\n\n${words}`;
}
