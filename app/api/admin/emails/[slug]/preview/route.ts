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

  // Fill every variable with a labelled placeholder so the preview is readable.
  let previewBody = body;
  for (const v of variables) {
    const placeholder = `[${v}]`;
    previewBody = previewBody.replaceAll(`{{${v}}}`, placeholder);
  }

  const html = await renderTemplateToHtml(previewBody);
  return NextResponse.json({ html });
}
