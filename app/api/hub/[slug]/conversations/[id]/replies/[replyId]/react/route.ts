import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";

const ALLOWED_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"];

/**
 * Reactions are stored as JSON on HubConversationReply.reactions.
 *
 * Shape (current): { "🙏": ["userId1", "userId2"], "❤️": ["userId3"] }
 * Shape (legacy):  { "🙏": 3, "❤️": 1 }   ← old count-only format
 *
 * The legacy shape was the original implementation: it counted clicks but
 * didn't track WHO reacted, so toggling and per-user state were impossible
 * (and the same person could react infinitely). Anywhere we read reactions,
 * we normalize: a numeric value becomes [] (the count is preserved, but no
 * user can "own" a legacy reaction — they're treated as anonymous, kept for
 * historical totals only and surfaced via a normalize helper on the client).
 */
type LegacyReactions = Record<string, number | string[]>;

function readReactions(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const raw = value as LegacyReactions;
  const out: Record<string, string[]> = {};
  for (const [emoji, val] of Object.entries(raw)) {
    if (Array.isArray(val)) {
      out[emoji] = val.filter((v): v is string => typeof v === "string");
    } else if (typeof val === "number" && val > 0) {
      // Legacy: discard the count (no user info to migrate). Reactions in
      // the new format start fresh; the lost counts are a one-time cost.
      out[emoji] = [];
    }
  }
  return out;
}

/**
 * POST /api/hub/[slug]/conversations/[id]/replies/[replyId]/react
 *
 * Toggles the requesting user's reaction with the given emoji on the reply.
 * If they're already reacting with that emoji, the reaction is removed.
 * Otherwise it's added. One reaction per user per emoji per reply.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; replyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, id: threadId, replyId } = await params;
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { emoji } = (body ?? {}) as { emoji?: string };

  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    return Response.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const reply = await db.hubConversationReply.findUnique({ where: { id: replyId } });
  if (!reply || reply.threadId !== threadId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const reactions = readReactions(reply.reactions);
  const current = reactions[emoji] ?? [];
  const userId = session.user.id;
  const hasReacted = current.includes(userId);

  if (hasReacted) {
    // Toggle off
    const next = current.filter((id) => id !== userId);
    if (next.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = next;
    }
  } else {
    // Toggle on
    reactions[emoji] = [...current, userId];
  }

  await db.hubConversationReply.update({
    where: { id: replyId },
    data: { reactions },
  });

  return Response.json({ reactions });
}
