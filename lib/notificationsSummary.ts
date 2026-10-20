/**
 * The once-a-day summary of team news (2026-10-20), for people who chose
 * "One email a day" in My Profile (User.teamEmailMode = "summary"). Their
 * team news isn't emailed as it happens (lib/email.ts sendTemplatedEmail);
 * each morning, after the coverage notices, one email lists what's new and
 * unread on each team, and links to Notifications. A notice goes in one
 * summary at most (summarizedAt). Template "notifications-daily-summary".
 */

import { db } from "@/lib/db";
import { emailButtonHtml, emailLink, sendTemplatedEmail } from "@/lib/email";

function md(text: string): string {
  return text.replace(/[\\`*_[\]<>#|]/g, (c) => `\\${c}`);
}

const pause = () => new Promise((r) => setTimeout(r, 600));

export async function sendDailySummaries(now: Date = new Date()): Promise<{ people: number; notices: number }> {
  // A week back, so a missed morning doesn't lose anything; read notices
  // and ones already emailed are left out.
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const people = await db.user.findMany({
    where: { teamEmailMode: "summary", archivedAt: null, emailVerified: { not: null } },
    select: { id: true, email: true, firstName: true, preferredName: true },
  });
  const counts = { people: 0, notices: 0 };
  for (const p of people) {
    try {
      const notices = await db.notification.findMany({
        // Due: team news not emailed one by one and not yet in a summary.
        where: { userId: p.id, category: "team", summarizedAt: null, readAt: null, createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        select: { id: true, sourceLabel: true, title: true },
      });
      if (!notices.length || !p.email) continue;
      const byTeam = new Map<string, string[]>();
      for (const n of notices) byTeam.set(n.sourceLabel, [...(byTeam.get(n.sourceLabel) ?? []), n.title]);
      const summary = [...byTeam.entries()]
        .map(([team, titles]) => `**${md(team)}**\n\n${titles.slice(0, 15).map((t) => `- ${md(t)}`).join("\n")}${titles.length > 15 ? `\n- And ${titles.length - 15} more` : ""}`)
        .join("\n\n");
      const url = emailLink("/account/notifications");
      await pause();
      await sendTemplatedEmail("notifications-daily-summary", p.email, {
        firstName: p.preferredName || p.firstName || "there",
        headline: notices.length === 1 ? "What's new on your teams: 1 update" : `What's new on your teams: ${notices.length} updates`,
        summary,
        notificationsUrl: url,
        notificationsButton: emailButtonHtml("Open Notifications", url),
      }, { throwOnFailure: true });
      // Marked only once it has gone: a failed send stays due for tomorrow.
      await db.notification.updateMany({ where: { id: { in: notices.map((n) => n.id) } }, data: { summarizedAt: now } });
      counts.people++;
      counts.notices += notices.length;
    } catch (err) {
      console.error("[notifications-summary] failed for one person", err);
    }
  }
  return counts;
}
