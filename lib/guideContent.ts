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
 * Everything here is visible to every volunteer: the topic files hold nothing
 * private (volunteer-guide/README.md), and page words come only from pages a
 * signed-out visitor can read.
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

/** The sections that mention the most of the query's words, best first. */
export async function searchGuide(query: string, limit = 6): Promise<string> {
  const words = query.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return "Ask with a few words, such as \"waiting list email\".";
  const scored: { score: number; where: string; body: string }[] = [];
  for (const topic of await listGuideTopics()) {
    const text = await readFile(path.join(GUIDE_DIR, topic.file), "utf8");
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
