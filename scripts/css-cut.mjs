#!/usr/bin/env node
// Content-anchored CSS block remover. Deletes the lines from the comment-banner
// directly above START_TEXT up to (but not including) the comment-banner
// directly above END_TEXT. Anchors on text content, not raw line numbers, so a
// shifting file can't misalign the cut. Verifies brace balance before writing.
//
// Usage: node scripts/css-cut.mjs "<START_TEXT>" "<END_TEXT>"
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "public/css/custom.css";
const [startText, endText] = process.argv.slice(2);
if (!startText || !endText) {
  console.error("need START_TEXT and END_TEXT");
  process.exit(1);
}

const lines = readFileSync(FILE, "utf8").split("\n");
const isBanner = (l) => /^\s*\/\*\s*[─═=]/.test(l);

function bannerAbove(matchText) {
  const idx = lines.findIndex((l) => l.includes(matchText));
  if (idx === -1) throw new Error(`text not found: ${matchText}`);
  let b = idx;
  while (b > 0 && !isBanner(lines[b])) b--;
  if (!isBanner(lines[b])) throw new Error(`no banner above: ${matchText}`);
  return b;
}

const start = bannerAbove(startText);
const end = bannerAbove(endText);
if (end <= start) throw new Error("end banner is not after start banner");

const removed = lines.slice(start, end);
const open = removed.join("\n").match(/\{/g)?.length ?? 0;
const close = removed.join("\n").match(/\}/g)?.length ?? 0;
if (open !== close) {
  console.error(`REFUSING: removed range is not brace-balanced (${open} open / ${close} close). No write.`);
  process.exit(2);
}

const kept = [...lines.slice(0, start), ...lines.slice(end)];
const total = kept.join("\n");
const tOpen = (total.match(/\{/g) ?? []).length;
const tClose = (total.match(/\}/g) ?? []).length;
if (tOpen !== tClose) {
  console.error(`REFUSING: file would be unbalanced (${tOpen}/${tClose}). No write.`);
  process.exit(3);
}

writeFileSync(FILE, total);
console.log(`Removed ${removed.length} lines (block ${open}/${close} braces balanced).`);
console.log(`Splice now reads:`);
console.log(kept.slice(Math.max(0, start - 2), start + 3).map((l) => "  | " + l).join("\n"));
console.log(`File total braces: ${tOpen}/${tClose}  |  lines: ${kept.length}`);
