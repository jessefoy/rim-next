import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendResponsesUpdatedEmail } from "@/lib/email";
import { recordRegistrationEvent } from "@/lib/registrationEvents";
import { mergeAnswers, type QuestionLike } from "@/lib/registrationAnswers";

// ─── POST — registrant submits their updated responses via self-service link ──

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { customFields } = body;

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

    // Their changes merged over what's stored, by question id; an old answer
    // stored by wording is kept, never rewritten (lib/registrationAnswers.ts).
    const program = await db.program.findUnique({
      where: { slug: registration.programSlug },
      select: { registrationFields: true },
    });
    const questions = Array.isArray(program?.registrationFields)
      ? (program.registrationFields as unknown as QuestionLike[]).filter((q) => q && typeof q.label === "string")
      : [];
    const merged = customFields !== undefined ? mergeAnswers(registration.customFields, customFields, questions) : undefined;

    // Apply the updates and clear the token (single-use)
    await db.registration.update({
      where: { id: registration.id },
      data: {
        ...(merged !== undefined && { customFields: merged as Prisma.InputJsonObject }),
        editToken:          null,
        editTokenExpiresAt: null,
      },
    });

    // History only when something changed (a resubmission of the same answers isn't news).
    if (merged !== undefined && JSON.stringify(merged) !== JSON.stringify(registration.customFields ?? {})) await recordRegistrationEvent({
      kind: "answers-changed-by-them",
      programId: registration.programId,
      programSlug: registration.programSlug,
      registrationId: registration.id,
      actorId: registration.userId,
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
