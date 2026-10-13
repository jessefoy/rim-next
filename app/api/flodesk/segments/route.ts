import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFlodeskSegments } from "@/lib/flodesk";

// GET — every Flodesk segment (id + name), for the Program Manager's "link an
// existing segment" picker. Read-only. Same gate as program editing.
export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ segments: await listFlodeskSegments() });
  } catch (err) {
    console.error("[flodesk/segments] list failed", err);
    return NextResponse.json({ error: "Flodesk didn't answer. Try again in a moment." }, { status: 502 });
  }
}
