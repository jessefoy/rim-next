// The RIM Guide's screen words (2026-10-27): for each screen listed in
// volunteer-guide/screens.json, the words a person reads on it (labels, hints,
// buttons, headings, confirm questions, messages), pulled from the code with
// the TypeScript parser and written, with their line numbers, to
// volunteer-guide/generated-screen-words.json for the connector's
// screen_words tool (lib/guideContent.ts).
//
// Runs in `npm run build` before `next build`, so the guide always matches
// what was deployed. It never fails the build: on any error it writes
// nothing and says so, and screen_words then says it can't read screens.
// Run by hand: node scripts/guide-screens.mjs

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "volunteer-guide", "generated-screen-words.json");

/** Attributes whose words a person reads. */
const READ_ATTRS = new Set([
  "label", "placeholder", "title", "aria-label", "alt", "hint", "help", "helpText", "description",
  "summary", "heading", "legend", "emptyText", "empty", "confirmLabel", "cancelLabel", "submitLabel",
  "buttonLabel", "message", "note", "lead", "eyebrow", "caption", "subtitle", "body", "question", "ok",
]);
/** Attributes that are never words. */
const SKIP_ATTRS = /^(className|href|src|id|key|name|type|htmlFor|style|role|method|action|rel|target|autoComplete|inputMode|pattern|encType|accept|data-.*|aria-(controls|describedby|labelledby|hidden|live|current|expanded)|tabIndex|form|ref|as|prefetch|sizes|loading|scroll|lang|dir)$/;
/** Calls whose strings are never words. */
const SKIP_CALLS = /^(console\.|fetch$|redirect$|notFound$|router\.|db\.|require$|encodeURIComponent$|new URL|URLSearchParams|searchParams\.|.*\.(getItem|setItem|removeItem|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|startsWith|endsWith|includes|split|replace|match|test|toLocaleDateString|toLocaleTimeString|toLocaleString)$|Intl\.|useSearchParams|cn$|clsx$)/;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g;
const redact = (s) => s.replace(EMAIL, (m) => (m.toLowerCase() === "jesse@rootedinmindfulness.org" ? m : "[an email address]"));

const ENTITIES = {
  apos: "'", quot: "\"", amp: "&", rarr: "→", larr: "←", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", middot: "·", times: "×", lt: "<", gt: ">",
};
const decode = (t) => t.replace(/&([a-z]+);/gi, (all, e) => ENTITIES[e.toLowerCase()] ?? all);

function looksLikeWords(raw) {
  const s = raw.trim();
  if (s.length < 2 || !/[A-Za-z]/.test(s)) return false;
  if (/[{}<>;]|=>|==|\$\{|^[/.#@]|^https?:|^mailto:|^\w+:\/\//.test(s)) return false;
  const tokens = s.split(/\s+/);
  // Class names and keys: lowercase tokens joined by - or : or _.
  if (tokens.every((t) => /^[a-z0-9_:[\].-]+$/.test(t)) && tokens.some((t) => /[-_:]/.test(t))) return false;
  const words = tokens.filter((t) => /[A-Za-z]{2,}/.test(t));
  if (words.length >= 2) return /[a-z]/.test(s);
  // One word: only a capitalised one, as a button or heading reads.
  return /^[A-Z][a-z’'&]+[.?!…:]?(\s*[→←])?$/.test(s) || /^[→←]\s*[A-Z][a-z]+/.test(s);
}

function filesFor(entry) {
  const full = path.join(ROOT, entry);
  if (!existsSync(full)) return [];
  if (statSync(full).isDirectory()) {
    return readdirSync(full, { recursive: true })
      .map((f) => path.join(entry, String(f)))
      .filter((f) => /\.(tsx|ts)$/.test(f) && !/\.d\.ts$/.test(f))
      .sort();
  }
  return [entry];
}

function wordsIn(ts, file) {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const push = (node, words, prefix = "") => {
    const clean = redact(words.replace(/\s+/g, " ").trim());
    if (!clean) return;
    const line = lineOf(node);
    const t = prefix ? `${prefix}: ${clean}` : clean;
    const last = out[out.length - 1];
    if (!last || last[1] !== t) out.push([line, t]);
  };
  const literalText = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => `…${s.literal.text}`).join("");
    return null;
  };

  function visit(node, attrName) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) return; // "use client"
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = ts.isNewExpression(node) ? `new ${node.expression.getText(sf)}` : node.expression.getText(sf);
      if (SKIP_CALLS.test(callee)) return;
    }
    if (ts.isJsxText(node)) {
      const t = node.getText(sf);
      if (/[A-Za-z]/.test(t)) push(node, decode(t));
      return;
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (SKIP_ATTRS.test(name)) return;
      if (node.initializer) visit(node.initializer, name);
      return;
    }
    // A key in an object ({ label: … }) is not words; its value may be.
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf).replace(/["']/g, "");
      if (SKIP_ATTRS.test(key)) return;
      visit(node.initializer, READ_ATTRS.has(key) ? key : undefined);
      return;
    }
    if (ts.isBinaryExpression(node) && /^(===|!==|==|!=)$/.test(node.operatorToken.getText(sf))) return;
    if (ts.isCaseClause(node)) {
      node.statements.forEach((s) => visit(s));
      return;
    }
    if (ts.isElementAccessExpression(node)) return;
    const lit = literalText(node);
    if (lit !== null) {
      if (looksLikeWords(lit) || (attrName && READ_ATTRS.has(attrName) && /[A-Za-z]/.test(lit))) {
        push(node, lit, attrName && attrName !== "children" && READ_ATTRS.has(attrName) ? attrName : "");
      }
      if (ts.isTemplateExpression(node)) node.templateSpans.forEach((s) => visit(s.expression));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, ts.isJsxExpression(node) ? attrName : undefined));
  }
  visit(sf);
  return out;
}

async function main() {
  const ts = (await import("typescript")).default;
  const screens = JSON.parse(readFileSync(path.join(ROOT, "volunteer-guide", "screens.json"), "utf8"));
  const files = {};
  for (const [slug, screen] of Object.entries(screens)) {
    if (slug.startsWith("_")) continue;
    for (const entry of screen.files) {
      for (const file of filesFor(entry)) {
        if (!files[file]) files[file] = wordsIn(ts, file);
      }
    }
  }
  writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString(), files }));
  const lines = Object.values(files).reduce((n, f) => n + f.length, 0);
  console.log(`RIM Guide: words from ${Object.keys(files).length} screen files (${lines} lines).`);
}

main().catch((err) => {
  console.error("RIM Guide: screen words not made (the build goes on):", err?.message ?? err);
});
