import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const registrations = await db.registration.findMany({
    where: { programSlug: slug },
    orderBy: { createdAt: "asc" },
  });

  if (format === "csv") {
    // Collect all unique custom field keys across all registrations (preserves order)
    const customKeys: string[] = [];
    const seenKeys = new Set<string>();
    for (const r of registrations) {
      if (r.customFields) {
        for (const k of Object.keys(r.customFields as Record<string, unknown>)) {
          if (!seenKeys.has(k)) {
            customKeys.push(k);
            seenKeys.add(k);
          }
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
      ...customKeys,
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
        ...customKeys.map((k) => csvEscape(String(custom[k] ?? ""))),
        csvEscape(r.waitlistPosition != null ? String(r.waitlistPosition) : ""),
        csvEscape(r.notes ?? ""),
        csvEscape(r.createdAt.toISOString()),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${slug}-registrations.csv"`,
      },
    });
  }

  return NextResponse.json({ registrations });
}
