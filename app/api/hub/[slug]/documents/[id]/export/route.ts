import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!member && !isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findUnique({ where: { id } });
  if (!doc || doc.hubId !== hub.id || !doc.isNative) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${doc.label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;

  if (!doc.body) {
    return new Response(`# ${doc.label}\n\n(No content)`, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Convert BlockNote JSON to Markdown server-side
  const { ServerBlockNoteEditor } = await import("@blocknote/server-util");
  const editor = ServerBlockNoteEditor.create();
  const markdown = await editor.blocksToMarkdownLossy(doc.body as any[]);
  const fullMarkdown = `# ${doc.label}\n\n${markdown}`;

  return new Response(fullMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
