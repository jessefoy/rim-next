import { NextRequest, NextResponse } from "next/server";
import { answerFor, oldAnswers, type QuestionLike } from "@/lib/registrationAnswers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extractBlockNoteText } from "@/lib/renderRichContent";
import { canUseRegistration } from "@/lib/toolAuth";
import { recordRegistrationEvent } from "@/lib/registrationEvents";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const registrations = await db.registration.findMany({
    // Exclude held (PENDING_PAYMENT) rows — not real registrations until paid,
    // so they don't belong on the roster or the CSV export.
    where: { programSlug: slug, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "asc" },
    // Never the edit link's key or the Stripe session (2026-10-23).
    select: {
      id: true, programId: true, programSlug: true, firstName: true, lastName: true, email: true, phone: true,
      status: true, donationStatus: true, customFields: true, waitlistPosition: true, notes: true, createdAt: true,
    },
  });

  if (format === "csv") {
    // A column for each of the program's questions, in order, read by the
    // question's id or (older) its wording; then a column for each old answer
    // no current question has, under its wording then (lib/registrationAnswers.ts).
    const prog = await db.program.findUnique({ where: { slug }, select: { registrationFields: true } });
    const questions = Array.isArray(prog?.registrationFields)
      ? (prog.registrationFields as unknown as QuestionLike[]).filter((q) => q && typeof q.label === "string")
      : [];
    const oldCols: { key: string; label: string }[] = [];
    const seenOld = new Set<string>();
    for (const r of registrations) {
      for (const { key, label } of oldAnswers(r.customFields, questions)) {
        if (!seenOld.has(key)) {
          oldCols.push({ key, label });
          seenOld.add(key);
        }
      }
    }

    const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`;

    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Status",
      "Donation Status",
      ...questions.map((q) => q.label),
      ...oldCols.map((c) => c.label),
      "Waitlist Position",
      "Notes",
      "Registered At",
    ]
      .map(csvEscape)
      .join(",");

    const rows = registrations.map((r) => {
      const custom = (r.customFields as Record<string, string>) ?? {};
      return [
        csvEscape(r.firstName),
        csvEscape(r.lastName),
        csvEscape(r.email),
        csvEscape(r.phone ?? ""),
        csvEscape(r.status),
        csvEscape(r.donationStatus),
        ...questions.map((q) => csvEscape(answerFor(r.customFields, q))),
        ...oldCols.map((c) => csvEscape(String(custom[c.key] ?? ""))),
        csvEscape(r.waitlistPosition != null ? String(r.waitlistPosition) : ""),
        csvEscape(extractBlockNoteText(r.notes) ?? ""),
        csvEscape(r.createdAt.toISOString()),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    // A download carries everyone's contact details and answers: it is kept
    // in the program's history (2026-10-23).
    await recordRegistrationEvent({
      kind: "downloaded",
      programId: registrations[0]?.programId ?? null,
      programSlug: slug,
      actorId: session.user.id,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${slug}-registrations.csv"`,
      },
    });
  }

  return NextResponse.json({ registrations });
}
