import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFlodeskSegments } from "@/lib/flodesk";
import { canUsePrograms } from "@/lib/toolAuth";

// GET — every Flodesk segment (id + name), for the Program Manager's "link an
// existing segment" picker. Read-only. Same gate as program editing.
export async function GET() {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ segments: await listFlodeskSegments() });
  } catch (err) {
    console.error("[flodesk/segments] list failed", err);
    return NextResponse.json({ error: "Flodesk didn't answer. Try again in a moment." }, { status: 502 });
  }
}
