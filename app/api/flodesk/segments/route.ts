import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFlodeskSegments } from "@/lib/flodesk";
import { canUseRegistration } from "@/lib/toolAuth";

// GET — every Flodesk segment (id + name), for the Registration app's "use an
// existing segment" picker (moved from the program editor, 2026-10-24).
// Read-only. Same gate as the Registration app.
export async function GET() {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ segments: await listFlodeskSegments() });
  } catch (err) {
    console.error("[flodesk/segments] list failed", err);
    return NextResponse.json({ error: "Flodesk didn't answer. Try again in a moment." }, { status: 502 });
  }
}
