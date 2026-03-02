import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendResponsesUpdatedEmail } from "@/lib/email";

// ─── POST — registrant submits their updated responses via self-service link ──

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { customFields, comments } = body;

    // Look up registration by token
    const registration = await db.registration.findUnique({
      where: { editToken: token },
    });

    // Token not found, already used (cleared), or expired
    if (
      !registration ||
      !registration.editTokenExpiresAt ||
      registration.editTokenExpiresAt < new Date()
    ) {
      return NextResponse.json({ error: "Link expired or invalid" }, { status: 410 });
    }

    // Apply the updates and clear the token (single-use)
    await db.registration.update({
      where: { id: registration.id },
      data: {
        ...(customFields !== undefined && { customFields }),
        ...(comments !== undefined && { comments }),
        editToken:          null,
        editTokenExpiresAt: null,
      },
    });

    // Notify registrar — fire-and-forget
    await sendResponsesUpdatedEmail({
      registrantName: `${registration.firstName} ${registration.lastName}`,
      programTitle:   registration.programTitle,
      programSlug:    registration.programSlug,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update responses error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
