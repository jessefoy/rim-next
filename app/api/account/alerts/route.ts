import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET /api/account/alerts — return unread count + recent unread alerts for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await db.alert.findMany({
    where: { userId: session.user.id, read: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      message: true,
      linkUrl: true,
      read: true,
      createdAt: true,
    },
  });

  return Response.json({
    count: alerts.length,
    alerts: alerts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  });
}

// PATCH /api/account/alerts — mark alerts read
// Body: { id?: string } — if id provided, mark one; if omitted, mark all
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { id } = body as { id?: string };

  if (id) {
    // Mark single alert — ownership check
    await db.alert.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    });
  } else {
    // Mark all
    await db.alert.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
  }

  return Response.json({ ok: true });
}
