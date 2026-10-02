import fs from "fs";
import path from "path";
import { marked } from "marked";
import { HANDFUL_PATHS, type HandfulSlug } from "@/lib/handfulPaths";

/**
 * The two Handful of Leaves documents members read in the member area
 * (/account/handful-of-leaves and /account/handful-of-leaves/map).
 *
 * The words live in the vault, which is canonical:
 *   Dharma Study/10 — Dharma Canon/Handful of Leaves/
 *     A Handful of Leaves — An Introduction.md
 *     A Handful of Leaves — Categories & Elements (Community Edition).md
 * The repo copies in content/handful-of-leaves/ are derived works: verbatim
 * bodies under derived-work frontmatter (type, derives_from, sources_as_of,
 * status). When the vault changes, the copy is re-derived, never edited here.
 * Everything below transforms for display only (the title is lifted out of
 * the body, the Obsidian wikilink becomes a link, markdown becomes HTML); no
 * word of either document is changed.
 */

const DIR = path.join(process.cwd(), "content", "handful-of-leaves");

/** Obsidian note names the documents link to, and where each lives on the site.
    The vault's links name the note (with an alias after a pipe, as Obsidian
    writes them); "handful-of-leaves-categories-elements-final" is the slug an
    earlier version of the introduction used, kept so an older derived copy
    still resolves. */
const WIKILINK_TARGETS: Record<string, HandfulSlug> = {
  "A Handful of Leaves — Categories & Elements (Community Edition)": "map",
  "A Handful of Leaves — An Introduction": "introduction",
  "handful-of-leaves-categories-elements-final": "map",
};

export type HandfulDoc = {
  /** The document's own first-line heading. */
  title: string;
  /** The rest of the document, rendered. */
  html: string;
};

function readSource(slug: HandfulSlug): string {
  const raw = fs.readFileSync(path.join(DIR, `${slug}.md`), "utf8").replace(/\r\n/g, "\n");
  // Derived-work frontmatter: a leading block between two --- lines.
  return raw.replace(/^---\n[\s\S]*?\n---\n/, "");
}

/** The text of a document's first heading ("# Title"). */
function titleOf(source: string): string {
  const match = source.match(/^# (.+)$/m);
  return match ? match[1].trim() : "";
}

export function loadHandfulDoc(slug: HandfulSlug): HandfulDoc {
  const source = readSource(slug);
  const title = titleOf(source);
  const withoutTitle = source.replace(/^# .+\n/, "");

  // [[Note name]] or [[Note name|Shown text]] becomes a link to the member page
  // for that note: the alias is shown once, as the link text; with no alias the
  // note's own title is shown.
  const linked = withoutTitle.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_whole, target: string, alias?: string) => {
      const dest = WIKILINK_TARGETS[target.trim()];
      if (!dest) return alias ?? target;
      const label = alias ?? titleOf(readSource(dest));
      return `[${label}](${HANDFUL_PATHS[dest]})`;
    }
  );

  return { title, html: marked.parse(linked, { async: false, gfm: true }) as string };
}
