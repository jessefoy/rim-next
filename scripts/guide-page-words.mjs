// Capture the visible words of RIM's public pages from the live site, as
// Markdown, for the RIM Guide file pack. Usage: node scripts/guide-page-words.mjs volunteer-guide/7-public-page-words.md
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(new URL("../package.json", import.meta.url));
const cheerio = require("cheerio");

const ORIGIN = "https://rim-next.vercel.app";
const STATIC = [
  "/", "/new-to-rim", "/why-we-practice", "/care", "/our-roots", "/handful-of-leaves",
  "/about", "/community-programs", "/donate", "/diversity", "/outreach", "/join",
  "/community-care-agreements", "/volunteerism/volunteer",
  "/kalyana-mitta/community-groups-events",
  "/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group",
  "/kalyana-mitta/kalyana-mitta-group-application",
];

const clean = (s) => s.replace(/\s+/g, " ").trim();

async function get(path) {
  const res = await fetch(ORIGIN + path, { redirect: "follow" });
  return { status: res.status, url: res.url, html: await res.text() };
}

function words(html) {
  const $ = cheerio.load(html);
  $("br").replaceWith(" ");
  $("script, style, noscript, svg, nav, header.nav, footer, .nav, .site-footer, [aria-hidden='true']").remove();
  const title = clean($("title").first().text());
  const root = $("main").length ? $("main").first() : $("body");
  const out = [];
  const seen = new Set();
  root.find("h1, h2, h3, h4, p, li, blockquote, summary, label, a.pp-btn, button, figcaption, dt, dd").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    // Skip a block whose words a nearer block already carries.
    if (tag === "p" && $(el).parents("li, blockquote, dd").length) return;
    if ((tag === "a" || tag === "button") && $(el).parents("p, li").length) return;
    const text = clean($(el).text());
    if (!text) return;
    const key = tag + "|" + text;
    if (seen.has(key)) return;
    seen.add(key);
    if (tag === "h1") out.push(`### Title: ${text}`);
    else if (tag === "h2") out.push(`#### ${text}`);
    else if (tag === "h3" || tag === "h4") out.push(`**${text}**`);
    else if (tag === "li") out.push(`- ${text}`);
    else if (tag === "blockquote") out.push(`> ${text}`);
    else if (tag === "a" || tag === "button") out.push(`[Button: ${text}]`);
    else if (tag === "summary") out.push(`[Opens: ${text}]`);
    else if (tag === "label") out.push(`[Form field: ${text}]`);
    else out.push(text);
  });
  return { title, body: out.join("\n\n") };
}

const outFile = process.argv[2];
const parts = [];
const home = await get("/community-programs");
const $p = cheerio.load(home.html);
const programPaths = [...new Set($p("a[href^='/programs/']").map((_, a) => $p(a).attr("href").split(/[?#]/)[0]).get())]
  .filter((h) => /^\/programs\/[^/]+$/.test(h)).sort();

for (const path of [...STATIC, ...programPaths]) {
  const page = await get(path);
  if (page.status !== 200) { parts.push(`## ${path}\n\n(Not available: status ${page.status})`); continue; }
  const { title, body } = words(page.html);
  const finalPath = new URL(page.url).pathname;
  const moved = finalPath !== path ? ` (opens ${finalPath})` : "";
  parts.push(`## ${path}${moved}\n\nBrowser tab: ${title}\n\n${body}`);
  process.stderr.write(`${path} ${body.split(/\s+/).length} words\n`);
}
const today = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
const intro = `# The public pages, word for word

Captured from the live site (${ORIGIN}) on ${today}. Use this file to quote a page's current words exactly, in a note's "Now:" line. If a volunteer quotes words that differ from these, the page may have changed since this capture: say so in the note.

How to read it: each page starts with its address. "Title:" is the page's main heading, "####" lines are its section headings, bold lines are smaller headings, "[Button: …]" is a button or link styled as one, "[Opens: …]" is a line that opens to show more, and "[Form field: …]" is a label on a form. The site's menu and footer are left out; they are the same on every page.

Program pages (addresses starting /programs/) hold words the registration team writes in the program editor. The other pages' words are part of the site itself, and only Jesse changes them.

`;
writeFileSync(outFile, intro + parts.join("\n\n---\n\n") + "\n");
console.log(`${STATIC.length} pages and ${programPaths.length} program pages`);
