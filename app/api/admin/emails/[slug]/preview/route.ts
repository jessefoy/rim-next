import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderTemplateToHtml } from "@/lib/email";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/admin/emails/[slug]/preview
 * Body: { subject: string; body: string; variables: string[] }
 * Returns: { html: string } — the exact HTML that would be sent to a recipient.
 *
 * Uses the same renderTemplateToHtml() path as sendTemplatedEmail(), so the
 * preview is pixel-identical to what recipients receive.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await params; // slug unused — preview renders whatever body is sent

  const { body, variables } = await req.json() as {
    body: string;
    variables: string[];
  };

  // Build a preview context: every declared variable is a labelled placeholder.
  // Strings are truthy in Handlebars, so any {{#if}} blocks will render their
  // content — useful for previewing all conditional sections at once.
  const ctx: Record<string, string> = {};
  for (const v of variables) ctx[v] = `[${v}]`;

  try {
    const html = await renderTemplateToHtml(body, ctx);
    return NextResponse.json({ html });
  } catch (e) {
    // Handlebars compile or marked render failed — most often because the
    // template uses {{#each}} on a value that isn't an array. Surface the
    // error so the admin can fix it without leaving the editor.
    const msg = e instanceof Error ? e.message : "Unknown render error";
    const errorHtml = `<div style="padding:24px;color:#7a2020;font-family:monospace;font-size:13px;line-height:1.6;background:#f5e0e0;border:1px solid #c8a0a0;border-radius:4px;">
      <strong>Preview error:</strong> ${msg.replace(/</g, "&lt;")}
    </div>`;
    return NextResponse.json({ html: errorHtml });
  }
}
