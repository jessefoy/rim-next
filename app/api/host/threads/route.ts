import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  sendNewThreadEmail,
  type NewThreadEmailData,
} from "@/lib/email";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}

// GET /api/host/threads — list threads (default: OPEN + CLOSED, not ARCHIVED)
// Query: ?category=OPERATIONAL|CONTEMPLATION  ?status=OPEN|CLOSED|ARCHIVED|all
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const statusParam = searchParams.get("status");

  // Build status filter
  let statusFilter: string | string[] | undefined;
  if (statusParam === "all") {
    statusFilter = undefined; // no filter
  } else if (statusParam === "OPEN" || statusParam === "CLOSED" || statusParam === "ARCHIVED") {
    statusFilter = statusParam;
  } else {
    statusFilter = ["OPEN", "CLOSED"]; // default: hide archived
  }

  const threads = await db.hostThread.findMany({
    where: {
      ...(category ? { category: category as "OPERATIONAL" | "CONTEMPLATION" } : {}),
      ...(Array.isArray(statusFilter)
        ? { status: { in: statusFilter as ("OPEN" | "CLOSED" | "ARCHIVED")[] } }
        : statusFilter
        ? { status: statusFilter as "OPEN" | "CLOSED" | "ARCHIVED" }
        : {}),
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(
    threads.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      status: t.status,
      author: t.author,
      replyCount: t._count.replies,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
  );
}

// POST /api/host/threads — create a thread
// Body: { title, body, category }
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const reqBody = await request.json().catch(() => null);
  const { title, body: threadBody, category } = (reqBody ?? {}) as {
    title?: string;
    body?: any;
    category?: string;
  };

  if (!title?.trim() || !threadBody) {
    return Response.json({ error: "Title and body are required" }, { status: 400 });
  }
  if (category !== "OPERATIONAL" && category !== "CONTEMPLATION") {
    return Response.json({ error: "Invalid category" }, { status: 400 });
  }

  const thread = await db.hostThread.create({
    data: {
      title: title.trim(),
      body: threadBody,
      category,
      authorId: session.user.id,
    },
  });

  // Notify all hub members (fire-and-forget)
  void (async () => {
    try {
      const author = await db.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true },
      });
      const authorName =
        [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
        author?.email ||
        "Someone";

      const recipients = await db.user.findMany({
        where: {
          roles: { hasSome: ["HOST", "HOST_MANAGER", "ADMIN"] },
          archivedAt: null,
          NOT: { id: session.user.id },
        },
        select: { id: true, email: true, firstName: true },
      });

      await db.alert.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          type: "NEW_THREAD" as const,
          message: `${authorName} started a new thread: "${title.trim()}"`,
          linkUrl: `/account/hub/host-team/conversations/${thread.id}`,
        })),
        skipDuplicates: true,
      });

      await Promise.all(
        recipients.map((u) =>
          sendNewThreadEmail({
            to: u.email,
            firstName: u.firstName,
            authorName,
            threadTitle: title.trim(),
            category,
            threadId: thread.id,
          } as NewThreadEmailData)
        )
      );
    } catch (e) {
      console.error("[threads] notification error:", e);
    }
  })();

  return Response.json({ id: thread.id, ok: true }, { status: 201 });
}
