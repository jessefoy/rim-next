import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";

// ── BlockNote JSON → Markdown ────────────────────────────────────────────────
// Legacy path: documents that were never edited after the Tiptap migration
// (session 97, 2026-04-28) still hold BlockNote JSON. Exported as .md.
// New saves are HTML strings — those go through the HTML path below.

function inlineToMd(content: any[]): string {
  return (content || []).map((c: any) => {
    if (!c) return "";
    if (c.type === "link") {
      const text = inlineToMd(c.content || []);
      return `[${text}](${c.href ?? ""})`;
    }
    let t: string = c.text ?? "";
    if (!t) return "";
    if (c.styles?.bold && c.styles?.italic) t = `***${t}***`;
    else if (c.styles?.bold) t = `**${t}**`;
    else if (c.styles?.italic) t = `*${t}*`;
    if (c.styles?.code) t = `\`${t}\``;
    return t;
  }).join("");
}

function blockToMd(block: any, depth = 0): string {
  if (!block || typeof block !== "object") return "";
  const inner = inlineToMd(block.content || []);
  const kids = (block.children || []).map((b: any) => blockToMd(b, depth + 1)).join("\n");
  const indent = "  ".repeat(depth);
  let line = "";
  switch (block.type) {
    case "heading":
      line = `${"#".repeat(block.props?.level ?? 2)} ${inner}`; break;
    case "bulletListItem":
      line = `${indent}- ${inner}`; break;
    case "numberedListItem":
      line = `${indent}1. ${inner}`; break;
    case "checkListItem":
      line = `${indent}- [ ] ${inner}`; break;
    case "quote":
      line = `> ${inner}`; break;
    case "codeBlock":
      line = `\`\`\`\n${inner}\n\`\`\``; break;
    case "table": {
      const rows = (block.content?.rows || []).map((row: any) =>
        "| " + (row.cells || []).map((cell: any) => inlineToMd(cell.content || [])).join(" | ") + " |"
      ).join("\n");
      line = rows; break;
    }
    default:
      line = inner;
  }
  return [line, kids].filter(Boolean).join("\n");
}

function blocksToMarkdown(blocks: any[]): string {
  return blocks.map((b) => blockToMd(b)).join("\n\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!member)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findUnique({ where: { id } });
  if (!doc || doc.hubId !== hub.id || !doc.isNative) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseName = doc.label.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  // Empty document
  if (!doc.body) {
    return new Response(`# ${doc.label}\n\n(No content)`, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.md"`,
      },
    });
  }

  // HTML string — Tiptap era (since session 97). Export as .html.
  if (typeof doc.body === "string") {
    const html = [
      "<!DOCTYPE html>",
      '<html lang="en">',
      `<head><meta charset="utf-8"><title>${escapeHtml(doc.label)}</title></head>`,
      "<body>",
      `<h1>${escapeHtml(doc.label)}</h1>`,
      doc.body,
      "</body>",
      "</html>",
    ].join("\n");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.html"`,
      },
    });
  }

  // BlockNote JSON array — legacy, unmigrated content. Export as .md.
  if (Array.isArray(doc.body)) {
    const markdown = blocksToMarkdown(doc.body);
    return new Response(`# ${doc.label}\n\n${markdown}`, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.md"`,
      },
    });
  }

  return NextResponse.json({ error: "Cannot export this document" }, { status: 500 });
}
