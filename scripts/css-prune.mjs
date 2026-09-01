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
//
// ⚠️ VERIFY A PREFIX IS TRULY DEAD BEFORE ADDING IT. A prefix here silently
// deletes every rule whose selectors all start with it on --apply. Two entries
// were REMOVED (session 165) after becoming live again: `sic-` (the six-box
// sign-in-code form shim, session 145) and `sg-` (the /style-guide page,
// session 162). Grep both custom.css (`.prefix-`) and code (className usage)
// and confirm ZERO live hits before listing a prefix.
const DEAD_PREFIXES = [
  "si-", "bn-", "bear-", "mantine-", "fmt-", "rte-",
  "el-", "tt-", "img-", "rim-block-editor", "rim-prose-editor", "man-",
  // Session-room CSS, orphaned by the session-159 Zoom cutover (the in-browser
  // LiveKit room and its components were deleted; only their styles were left).
  // Verified session 171: zero live hits for each, repo-wide — the only apparent
  // matches for `lk-` were the substrings in `walk`/`chalk`/`vol-reminder-bulk-btn`,
  // which don't match because this script tests parsed class names, not substrings.
  "rim-tile", "rim-conference", "rim-focus", "vr-", "vs-room", "lk-", "rim-chat",
  // The rest of the same set, per the prefix inventory in RIM_SessionRoom.md:56:
  // control bar, participants panel, the hand/pin banners, and the greenroom.
  "rim-cb", "rim-pp", "rim-hand-banner", "rim-pin-banner", "gr-",
  // Third pass (review catch): families the RIM_SessionRoom.md inventory itself
  // omits — the /video-session page chrome, guest entry, settings panel, and the
  // in-room banners/prompts. Verified zero live classNames session 171.
  "vs-", "vre-room", "rim-spotlight-banner", "rim-reconnect-banner",
  "rim-audio-prompt", "rim-unmute-prompt", "rim-settings",
  // The member-facing My Registrations list/detail and its self-cancel flow
  // were removed for the simplified current release. Registration itself,
  // registrar management, dashboard commitments, and Zoom remain live.
  "mr-", "mpd-",
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
