#!/usr/bin/env node
// Rule-level dead-CSS remover (postcss-based, so it understands real rules).
// Removes a style rule ONLY IF every one of its selectors is "dead-rooted" —
// i.e. each selector contains at least one dead class and ZERO live classes.
// A selector grouped with any live selector (e.g. ".bn-block…, .lp-callout")
// is KEPT, so live rendered-output styling is never touched.
//
// Dry-run by default (prints what it WOULD remove). Pass --apply to write.
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const FILE = "public/css/custom.css";
const APPLY = process.argv.includes("--apply");

// Class names / prefixes that belong to removed features. Longer prefixes
// (rim-block-editor / rim-prose-editor) catch their --modifier variants without
// colliding with the live rim- / rim-content / rim-el- classes.
const DEAD_PREFIXES = [
  "si-", "sic-", "bn-", "bear-", "mantine-", "fmt-", "rte-", "sg-",
  "el-", "tt-", "img-", "rim-block-editor", "rim-prose-editor",
];

const classRe = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;
const isDeadClass = (name) => DEAD_PREFIXES.some((p) => name === p.replace(/-$/, "") || name.startsWith(p));

// A selector is dead if it has >=1 class and ALL its classes are dead.
function selectorIsDead(sel) {
  const classes = [...sel.matchAll(classRe)].map((m) => m[1]);
  if (classes.length === 0) return false; // no class → not a dead-feature selector
  return classes.every(isDeadClass);
}
// A rule is removable iff every comma-separated selector is dead.
function ruleIsDead(rule) {
  return rule.selectors.length > 0 && rule.selectors.every(selectorIsDead);
}

const css = readFileSync(FILE, "utf8");
const root = postcss.parse(css);

const removed = [];
root.walkRules((rule) => {
  // skip keyframe steps (parent is @keyframes) — selectors are %/from/to
  if (rule.parent && rule.parent.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
  if (ruleIsDead(rule)) {
    removed.push({ sel: rule.selector.replace(/\s+/g, " ").slice(0, 90), line: rule.source?.start?.line });
    rule.remove();
  }
});
// Drop now-empty @media / @supports containers.
let emptied = 0;
root.walkAtRules((at) => {
  if (/^(media|supports)$/.test(at.name) && at.nodes && at.nodes.length === 0) { at.remove(); emptied++; }
});

const out = root.toString();
const tOpen = (out.match(/\{/g) ?? []).length;
const tClose = (out.match(/\}/g) ?? []).length;

console.log(`${APPLY ? "APPLYING" : "DRY-RUN"} — rules to remove: ${removed.length}, empty at-rules dropped: ${emptied}`);
console.log(`Resulting brace balance: ${tOpen}/${tClose}  |  lines: ${out.split("\n").length} (was ${css.split("\n").length})`);
writeFileSync("/tmp/css-removed.txt", removed.map((r) => `L${r.line}  ${r.sel}`).join("\n"));
console.log("Full removed list → /tmp/css-removed.txt");

if (APPLY) {
  if (tOpen !== tClose) { console.error("REFUSING: unbalanced output. No write."); process.exit(2); }
  writeFileSync(FILE, out);
  console.log("Written.");
}
