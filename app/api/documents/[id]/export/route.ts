import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUserAccessDocument } from "@/lib/documentAuth";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";
import { NextResponse } from "next/server";

function safeFileName(label: string) {
  return label.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "document";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toMarkdown(title: string, html: string) {
  // The native editor emits a known, sanitized subset of HTML. Converting that
  // subset here keeps export server-safe and produces an actual .md file (not
  // an HTML download wearing a Markdown filename).
  const body = html
    .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `\n\n\`\`\`\n${decodeEntities(code).trim()}\n\`\`\`\n\n`)
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n\n${"#".repeat(Number(level))} ${inlineMarkdown(text)}\n\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => `\n\n> ${inlineMarkdown(text).replace(/\n/g, "\n> ")}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `\n- ${inlineMarkdown(text)}`)
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n\n${inlineMarkdown(text)}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n");
  return `# ${title}\n${body ? `\n\n${body}` : "\n\n(No content)"}\n`;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function inlineMarkdown(value: string): string {
  return decodeEntities(value
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${inlineMarkdown(text)}](${href})`)
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**")
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "_$1_")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
  ).replace(/\n{3,}/g, "\n\n").trim();
}

function printDocument(title: string, html: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: auto; margin: 18mm; }
    :root { color: #292520; font-family: Georgia, "Times New Roman", serif; }
    body { max-width: 760px; margin: 0 auto; font-size: 12pt; line-height: 1.65; }
    h1, h2, h3, h4 { color: #31576d; line-height: 1.25; page-break-after: avoid; }
    h1 { font-size: 28pt; margin: 0 0 1.1em; }
    h2 { font-size: 20pt; margin-top: 1.7em; }
    h3 { font-size: 15pt; margin-top: 1.5em; }
    img, table, blockquote, pre { max-width: 100%; break-inside: avoid; }
    img { height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8d1c8; padding: 7px; text-align: left; vertical-align: top; }
    blockquote { margin-left: 0; padding-left: 1em; border-left: 3px solid #d8d1c8; color: #585149; }
    pre { white-space: pre-wrap; background: #f4efe8; padding: 1em; }
    .print-note { font-family: Arial, sans-serif; font-size: 10pt; color: #585149; margin-bottom: 2rem; }
    @media print { .print-note { display: none; } a { color: inherit; text-decoration: none; } }
  </style>
</head>
<body>
  <p class="print-note">Use your browser’s Print dialog to save this document as a PDF.</p>
  <main><h1>${escapeHtml(title)}</h1>${html || "<p><em>No content yet.</em></p>"}</main>
  <script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
}

/** Export a native document as Markdown or a print-ready page for Save as PDF. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canUserAccessDocument(id, session.user.id, session.user.roles ?? []);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await db.hubDocument.findUnique({
    where: { id },
    select: { label: true, body: true, docKind: true, deletedAt: true },
  });
  if (!doc || doc.deletedAt || doc.docKind !== "NATIVE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "md";
  const html = doc.body ? await renderContentBodyAsync(doc.body) : "";
  if (format === "print") {
    return new Response(printDocument(doc.label, html), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  if (format !== "md") return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });

  return new Response(toMarkdown(doc.label, html), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFileName(doc.label)}.md"`,
      "Cache-Control": "private, no-store",
    },
  });
}
