import "server-only";
import { promises as fs } from "fs";
import path from "path";
import ts from "typescript";

/**
 * The words on the site's pages, changed through the RIM Guide (2026-10-28,
 * Jesse: "be able to edit the content on the site, so we don't have to build
 * an independent editor for that"). Pages like Home and About, and every
 * screen's labels, are written into the site's code, so a change is a commit
 * to that code on GitHub, and Vercel puts it on the site a minute or two later.
 *
 * Words only: the change is made on the file as GitHub has it now, and is
 * refused unless the file reads afterwards exactly as before except for the
 * words in text and quoted strings, and none of those is an address, a class,
 * an import or another setting (wordsOnlyChange). A Content editor can't
 * change anything else in the code this way.
 *
 * Needs GITHUB_CONTENT_TOKEN: a fine-grained token for this one repository
 * with Contents: read and write. GITHUB_REPO is "owner/name" (default
 * jessefoy/rim-next); commits go to main.
 */

const ROOT = process.cwd();
const REPO = (process.env.GITHUB_REPO ?? "jessefoy/rim-next").trim();
const BRANCH = "main";

/**
 * The files whose words may change: every page and component, except the API,
 * the admin pages and the sign-in pages (where a word can be a gate).
 */
const CLOSED = ["app/api/", "app/admin/", "app/login/", "app/guide/"];
export function pageFileAllowed(file: string): boolean {
  if (typeof file !== "string" || file.includes("..") || file.startsWith("/") || file.includes("\\")) return false;
  if (!/\.tsx$/.test(file)) return false;
  // One plain path only: "app/./admin" reaches app/admin on GitHub (review, 2026-10-28).
  if (path.posix.normalize(file) !== file || file.split("/").some((seg) => !seg || seg === "." || seg === "..")) return false;
  if (!/^[\w\-()[\]./]+$/.test(file)) return false;
  if (CLOSED.some((c) => file.startsWith(c))) return false;
  return file.startsWith("app/") || file.startsWith("components/");
}

/** A file with server actions in it runs on the server when a form is sent: never changed. */
const hasServerActions = (src: string) => /["']use server["']/.test(src);

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) await walk(rel, out);
    else if (pageFileAllowed(rel)) out.push(rel);
  }
  return out;
}

// ─── Finding words as a page shows them ─────────────────────────────────────

const APOS = "(?:'|’|‘|&rsquo;|&lsquo;|&apos;|&#39;)";
const QUOTE = "(?:\"|“|”|&ldquo;|&rdquo;|&quot;|&#34;)";
const DASH = "(?:—|–|&mdash;|&ndash;|-)";

/**
 * A pattern for words as a visitor reads them, matching how the code may
 * write them: line breaks and indents between words, entities for
 * apostrophes, quotes, dashes and ampersands.
 */
export function wordsPattern(words: string): RegExp | null {
  const trimmed = words.trim();
  if (trimmed.length < 3) return null;
  let src = "";
  for (const ch of trimmed) {
    if (/\s/.test(ch)) {
      if (!src.endsWith("\\s+")) src += "\\s+";
    } else if (ch === "'" || ch === "’" || ch === "‘") src += APOS;
    else if (ch === "\"" || ch === "“" || ch === "”") src += QUOTE;
    else if (ch === "—" || ch === "–") src += DASH;
    else if (ch === "&") src += "(?:&|&amp;)";
    else if (ch === " ") src += "(?:\\s+|&nbsp;)";
    else src += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  return new RegExp(src, "g");
}

export type WordsMatch = { file: string; line: number; text: string; context: string };

/** Where these words are in the pages' code, as this deploy has it. */
export async function findPageWords(words: string, limit = 12): Promise<WordsMatch[] | null> {
  const re = wordsPattern(words);
  if (!re) return null;
  const files = [...(await walk("app")), ...(await walk("components"))];
  const found: WordsMatch[] = [];
  for (const file of files) {
    const src = await fs.readFile(path.join(ROOT, file), "utf8").catch(() => "");
    if (hasServerActions(src)) continue;
    for (const m of src.matchAll(re)) {
      const line = src.slice(0, m.index).split("\n").length;
      const lines = src.split("\n");
      const context = lines
        .slice(Math.max(0, line - 3), line + 2)
        .map((l, i) => `${Math.max(1, line - 2) + i}: ${l}`)
        .join("\n");
      found.push({ file, line, text: m[0], context });
      if (found.length >= limit) return found;
    }
  }
  return found;
}

/** The page a file draws, when it is a page: app/about/page.tsx → /about. */
export function pageAddress(file: string): string | null {
  const m = file.match(/^app\/(.*?)\/?page\.tsx$/);
  if (!m) return null;
  const parts = m[1].split("/").filter((p) => p && !/^\(.*\)$/.test(p));
  if (parts.some((p) => p.startsWith("["))) return null;
  return `/${parts.join("/")}`;
}

// ─── Words only ──────────────────────────────────────────────────────────────

const TEXT_KINDS = new Set([
  ts.SyntaxKind.JsxText,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

function leaves(node: ts.Node, sf: ts.SourceFile, out: ts.Node[] = []): ts.Node[] {
  const kids = node.getChildren(sf);
  if (kids.length === 0) out.push(node);
  else for (const k of kids) leaves(k, sf, out);
  return out;
}

/** Attributes whose quoted value a visitor reads. */
const WORD_ATTRS = new Set(["alt", "title", "aria-label", "aria-description", "placeholder", "label"]);

/** Names in a list of a page's words (and its metadata) whose value a visitor reads. */
const WORD_PROPS = new Set([
  "title", "description", "body", "text", "heading", "subheading", "eyebrow", "lead", "intro", "summary",
  "caption", "quote", "source", "attribution", "question", "answer", "note", "blurb", "excerpt", "alt",
  "label", "cta", "ctaLabel", "buttonLabel", "tagline", "subtitle",
]);

/** Whether a node sits inside a call (fetch, JSON.stringify, any function): a list of words never does. */
function insideCall(node: ts.Node): boolean {
  for (let n = node.parent; n && !ts.isSourceFile(n); n = n.parent) {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) return true;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isFunctionLike(n)) return false;
  }
  return false;
}

const tagName = (el: ts.Node) =>
  ts.isJsxElement(el) ? el.openingElement.tagName.getText() : "";

/**
 * Whether this piece is words a visitor reads (2026-10-28, after review: only
 * what is known to be words may change, never "anything not known to be a
 * setting", which let a role check or an address through). Text between tags
 * (not in a script or style), a quoted string shown between tags, the value of
 * a word attribute (alt, title, aria-label, placeholder, label), or the value
 * of a word name in a list of words or the metadata. Null when it is, or why not.
 */
function notWords(node: ts.Node): string | null {
  const p = node.parent;
  if (!p) return "part of how the page works";
  if (node.kind === ts.SyntaxKind.JsxText) {
    const tag = tagName(p).toLowerCase();
    return tag === "script" || tag === "style" ? "code inside a script or style" : null;
  }
  if (node.kind === ts.SyntaxKind.StringLiteral || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
    if (ts.isJsxAttribute(p) && WORD_ATTRS.has(p.name.getText())) return null;
    if (ts.isJsxExpression(p) && p.parent) {
      if (ts.isJsxAttribute(p.parent) && WORD_ATTRS.has(p.parent.name.getText())) return null;
      if ((ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent)) && tagName(p.parent).toLowerCase() !== "script" && tagName(p.parent).toLowerCase() !== "style") return null;
    }
    if (ts.isPropertyAssignment(p) && p.initializer === node && WORD_PROPS.has(p.name.getText().replace(/^["']|["']$/g, "")) && !insideCall(p)) return null;
    return "part of how the page works (a setting, an address or a check), not words a visitor reads";
  }
  return "part of how the page works";
}

/**
 * Whether `after` differs from `before` only in words: the same code with the
 * same shape, where each piece that changed is text or a quoted string that
 * isn't a setting. Returns null when it is, or why not.
 */
export function wordsOnlyChange(file: string, before: string, after: string): string | null {
  const a = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const b = ts.createSourceFile(file, after, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diag = (sf: ts.SourceFile) => (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length ?? 0;
  if (diag(b) > diag(a)) return "the change would break the page's code";
  const la = leaves(a, a);
  const lb = leaves(b, b);
  if (la.length !== lb.length) return "the change would add or remove more than words (formatting, a link or code)";
  let changed = 0;
  for (let i = 0; i < la.length; i++) {
    const x = la[i];
    const y = lb[i];
    if (x.kind !== y.kind) return "the change would turn words into code";
    const tx = x.getText(a);
    const ty = y.getText(b);
    if (tx === ty) continue;
    if (!TEXT_KINDS.has(x.kind)) return "the change would touch code, not words";
    const why = notWords(x);
    if (why) return `those words are ${why}`;
    changed++;
  }
  return changed > 0 ? null : "nothing would change";
}

/** Words as they must be written where they go: in page text, or inside quotes. */
function encodeFor(node: ts.Node | undefined, src: string, words: string): string {
  if (node && node.kind === ts.SyntaxKind.JsxText) {
    return words
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;")
      .replace(/'/g, "&rsquo;")
      .replace(/"/g, "&quot;");
  }
  // An attribute's quoted words take entities, not backslashes.
  if (node && node.kind === ts.SyntaxKind.StringLiteral && node.parent && ts.isJsxAttribute(node.parent)) {
    return words.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/\n/g, " ");
  }
  if (node && ts.isStringLiteralLike(node)) {
    const q = src[node.getStart()];
    let w = words.replace(/\\/g, "\\\\").replace(/\n/g, " ");
    if (q === "`") w = w.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    else w = w.split(q).join(`\\${q}`);
    return w;
  }
  return words;
}

/** The text-ish node holding [start, end), if one holds all of it. */
function holder(sf: ts.SourceFile, start: number, end: number): ts.Node | undefined {
  return leaves(sf, sf).find((n) => TEXT_KINDS.has(n.kind) && n.getStart(sf) <= start && n.getEnd() >= end);
}

// ─── GitHub ─────────────────────────────────────────────────────────────────

async function github<T>(url: string, init: RequestInit = {}): Promise<{ status: number; json: T }> {
  const token = process.env.GITHUB_CONTENT_TOKEN?.trim();
  if (!token) throw new NoGithubError();
  const res = await fetch(`https://api.github.com/repos/${REPO}${url}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

export class NoGithubError extends Error {
  constructor() {
    super("GITHUB_CONTENT_TOKEN isn't set");
    this.name = "NoGithubError";
  }
}

export type PageChange =
  | { ok: true; before: string; after: string; commitUrl: string; page: string | null }
  | { ok: false; error: string };

/**
 * Change these words in this file, as GitHub has it now, and commit it to
 * main. `find` is the words as a visitor reads them (or as the code has
 * them); they must appear exactly once in the file.
 */
export async function changePageWords(input: {
  file: string;
  find: string;
  replaceWith: string;
}): Promise<PageChange> {
  // The repository is public, so the commit names no one: who made the
  // change is kept in RIM's own history (lib/contentChanges.ts).
  const { file, find, replaceWith } = input;
  if (!pageFileAllowed(file)) return { ok: false, error: `${file} isn't one of the site's page files.` };
  const re = wordsPattern(find);
  if (!re) return { ok: false, error: "Give at least a few words to find." };
  if (!replaceWith.trim()) return { ok: false, error: "The new words are empty. To remove words, include the words around them and give those without them." };
  if (replaceWith.length > 4000) return { ok: false, error: "That's more than a passage of words. Change it a paragraph at a time." };

  for (let attempt = 0; attempt < 2; attempt++) {
    const got = await github<{ content?: string; sha?: string; message?: string }>(
      `/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${BRANCH}`,
    );
    if (got.status === 404) return { ok: false, error: `${file} isn't on the site any more.` };
    if (got.status !== 200 || !got.json.content || !got.json.sha) {
      console.error("[pageWords] GitHub read failed", got.status, got.json.message);
      return { ok: false, error: "GitHub didn't answer just now, so nothing changed. Try again in a moment." };
    }
    const before = Buffer.from(got.json.content, "base64").toString("utf8");
    if (hasServerActions(before)) return { ok: false, error: `${file} runs on the server when a form is sent, so its words are changed by Jesse. Send him a note.` };
    const matches = [...before.matchAll(re)];
    if (matches.length === 0) return { ok: false, error: `Those words aren't in ${file} as the site has it now. Find them again.` };
    if (matches.length > 1) return { ok: false, error: `Those words are in ${file} ${matches.length} times. Include more of the words around them, so only one place matches.` };
    const m = matches[0];
    const start = m.index!;
    const end = start + m[0].length;
    const sf = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = holder(sf, start, end);
    // Inside quotes only: a match that takes in a quote mark could swap it (review, 2026-10-28).
    if (node && node.kind !== ts.SyntaxKind.JsxText && !(start > node.getStart(sf) && end < node.getEnd())) {
      return { ok: false, error: "Give only the words inside the quotes, not the quote marks." };
    }
    if (!node) return { ok: false, error: "Those words run across a link, bold text or a line of code. Change the words on each side of it separately." };
    const written = encodeFor(node, before, replaceWith.trim());
    const after = before.slice(0, start) + written + before.slice(end);
    const why = wordsOnlyChange(file, before, after);
    if (why) return { ok: false, error: `Nothing changed: ${why}.` };

    const page = pageAddress(file);
    const put = await github<{ commit?: { html_url?: string }; message?: string }>(
      `/contents/${file.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `Words on ${page ?? file}, changed through the RIM Guide\n\n"${m[0].replace(/\s+/g, " ")}"\n→ "${replaceWith.trim()}"`,
          content: Buffer.from(after, "utf8").toString("base64"),
          sha: got.json.sha,
          branch: BRANCH,
        }),
      },
    );
    if (put.status === 409 || put.status === 422) continue; // changed meanwhile: read it again
    if (put.status !== 200 && put.status !== 201) {
      console.error("[pageWords] GitHub write failed", put.status, put.json.message);
      return { ok: false, error: "GitHub didn't take the change, so nothing changed. Try again in a moment." };
    }
    return { ok: true, before: m[0], after: written, commitUrl: put.json.commit?.html_url ?? "", page };
  }
  return { ok: false, error: "That file was changing at the same moment. Try again." };
}
