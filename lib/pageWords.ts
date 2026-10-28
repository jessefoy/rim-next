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

/** An ampersand that doesn't already begin an entity (&nbsp;, &rsquo;, &#32; are kept as written). */
const BARE_AMP = /&(?!#?[a-z0-9]+;)/gi;

/** Words as they must be written where they go: in page text, or inside quotes. */
function encodeFor(node: ts.Node | undefined, src: string, words: string): string {
  if (node && node.kind === ts.SyntaxKind.JsxText) {
    return words
      .replace(BARE_AMP, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;")
      .replace(/'/g, "&rsquo;")
      .replace(/"/g, "&quot;")
      .replace(/\n/g, " ")
      // A space at either end is dropped where page text meets a line break
      // in the code (before a <br />, say); written as &#32; it stays a space
      // (2026-10-28: the guide's spaces before line breaks were lost).
      .replace(/^ +| +$/g, (m) => "&#32;".repeat(m.length));
  }
  // An attribute's quoted words take entities, not backslashes.
  if (node && node.kind === ts.SyntaxKind.StringLiteral && node.parent && ts.isJsxAttribute(node.parent)) {
    return words.replace(BARE_AMP, "&amp;").replace(/"/g, "&quot;").replace(/\n/g, " ");
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

/**
 * Where these words may change in this file: matches inside one piece of page
 * words (and inside its quotes). Matches in code, settings or across tags
 * don't count, so the same words in a link or a check never block a change
 * (2026-10-28: "Our programs," couldn't be changed because it also appeared
 * in code).
 */
function editableMatches(file: string, src: string, re: RegExp) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const all = [...src.matchAll(re)];
  const ok = all
    .map((m) => ({ m, start: m.index!, end: m.index! + m[0].length }))
    .map((x) => ({ ...x, node: holder(sf, x.start, x.end) }))
    .filter(({ node, start, end }) =>
      !!node &&
      !notWords(node) &&
      (node.kind === ts.SyntaxKind.JsxText || (start > node.getStart(sf) && end < node.getEnd())),
    );
  return { all: all.length, ok };
}

/** One change to one file's text: the file after it, and the words before and after; or why not. */
function applyOne(file: string, src: string, find: string, replaceWith: string):
  | { ok: true; src: string; before: string; after: string }
  | { ok: false; error: string } {
  const re = wordsPattern(find);
  if (!re) return { ok: false, error: "Give at least a few words to find." };
  if (!replaceWith.trim()) return { ok: false, error: "The new words are empty. To remove words, include the words around them and give those without them." };
  if (replaceWith.length > 4000) return { ok: false, error: "That's more than a passage of words. Change it a paragraph at a time." };
  const { all, ok } = editableMatches(file, src, re);
  if (all === 0) return { ok: false, error: `"${find}" isn't in ${file} as the site has it now. Find it again.` };
  if (ok.length === 0) return { ok: false, error: `"${find}" is in ${file} only where it isn't page words (in code, a setting, or across a link or bold text). Change the words on each side separately, or send Jesse a note.` };
  if (ok.length > 1) return { ok: false, error: `"${find}" is page words in ${file} ${ok.length} times. Include more of the words around it, so only one place matches.` };
  const { m, start, end, node } = ok[0];
  const written = encodeFor(node, src, replaceWith.replace(/^\n+|\n+$/g, ""));
  return { ok: true, src: src.slice(0, start) + written + src.slice(end), before: m[0], after: written };
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

export type WordsChange = { file: string; find: string; replaceWith: string };
export type ChangedWords = { file: string; page: string | null; before: string; after: string };

export type PageChange =
  | { ok: true; changes: ChangedWords[]; commitUrl: string }
  | { ok: false; error: string };

const MAX_CHANGES = 30;
const ghPath = (file: string) => file.split("/").map(encodeURIComponent).join("/");

/**
 * Change words in one or more page files, as GitHub has them now, in one
 * commit to main (2026-10-28: one change of eleven places was eleven commits,
 * eleven deploys and eleven approvals). Every change must apply, or nothing
 * is committed. `find` is the words as a visitor reads them (or as the code
 * has them); each must be page words in exactly one place in its file.
 */
export async function changePageWords(changes: WordsChange[]): Promise<PageChange> {
  // The repository is public, so the commit names no one: who made the
  // change is kept in RIM's own history (lib/contentChanges.ts).
  if (!changes.length) return { ok: false, error: "No changes were given." };
  if (changes.length > MAX_CHANGES) return { ok: false, error: `That's more than ${MAX_CHANGES} changes at once. Make them in groups.` };
  for (const c of changes) if (!pageFileAllowed(c.file)) return { ok: false, error: `${c.file} isn't one of the site's page files, so nothing changed.` };
  const files = [...new Set(changes.map((c) => c.file))];

  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await github<{ object?: { sha?: string } }>(`/git/ref/heads/${BRANCH}`);
    const head = ref.json.object?.sha;
    const commit = head ? await github<{ tree?: { sha?: string } }>(`/git/commits/${head}`) : null;
    const baseTree = commit?.json.tree?.sha;
    if (!head || !baseTree) {
      console.error("[pageWords] GitHub read failed", ref.status);
      return { ok: false, error: "GitHub didn't answer just now, so nothing changed. Try again in a moment." };
    }

    const done: ChangedWords[] = [];
    const tree: { path: string; mode: string; type: string; content: string }[] = [];
    for (const file of files) {
      const got = await github<{ content?: string }>(`/contents/${ghPath(file)}?ref=${head}`);
      if (got.status === 404) return { ok: false, error: `${file} isn't on the site any more, so nothing changed.` };
      if (got.status !== 200 || !got.json.content) return { ok: false, error: "GitHub didn't answer just now, so nothing changed. Try again in a moment." };
      const original = Buffer.from(got.json.content, "base64").toString("utf8");
      if (hasServerActions(original)) return { ok: false, error: `${file} runs on the server when a form is sent, so its words are changed by Jesse. Nothing changed.` };
      let src = original;
      for (const c of changes.filter((x) => x.file === file)) {
        const one = applyOne(file, src, c.find, c.replaceWith);
        if (!one.ok) return { ok: false, error: `${one.error} Nothing changed.` };
        src = one.src;
        done.push({ file, page: pageAddress(file), before: one.before, after: one.after });
      }
      const why = wordsOnlyChange(file, original, src);
      if (why) return { ok: false, error: `In ${file}: ${why}. Nothing changed.` };
      tree.push({ path: file, mode: "100644", type: "blob", content: src });
    }

    const pages = [...new Set(done.map((d) => d.page ?? d.file))];
    const newTree = await github<{ sha?: string }>(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree }) });
    const made = newTree.json.sha
      ? await github<{ sha?: string; html_url?: string }>(`/git/commits`, {
          method: "POST",
          body: JSON.stringify({
            message: `Words on ${pages.join(", ")}, changed through the RIM Guide\n\n${done
              .map((d) => `${d.page ?? d.file}: "${d.before.replace(/\s+/g, " ")}" → "${d.after}"`)
              .join("\n")}`,
            tree: newTree.json.sha,
            parents: [head],
          }),
        })
      : null;
    if (!made?.json.sha) {
      console.error("[pageWords] GitHub commit failed", newTree.status, made?.status);
      return { ok: false, error: "GitHub didn't take the change, so nothing changed. Try again in a moment." };
    }
    const moved = await github(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: made.json.sha, force: false }) });
    if (moved.status === 422 || moved.status === 409) continue; // main moved meanwhile: start again from it
    if (moved.status !== 200) {
      console.error("[pageWords] GitHub ref update failed", moved.status);
      return { ok: false, error: "GitHub didn't take the change, so nothing changed. Try again in a moment." };
    }
    return { ok: true, changes: done, commitUrl: made.json.html_url ?? "" };
  }
  return { ok: false, error: "The site's code was changing at the same moment. Try again." };
}
