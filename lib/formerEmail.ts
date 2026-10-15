import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Former sign-in addresses (2026-10-15). When an admin changes a member's
 * email, or two accounts for one person are merged, the old address is kept
 * here so RIM still recognizes it. Every door that looks a person up by email
 * asks this module second, after the current address:
 *
 *   - /login (and the auth catch-all): "That address has moved", then one
 *     button sends the code to the account's current address.
 *   - /join: routes to that same page instead of making a second account.
 *   - guest registration, the Stripe webhook, check-email: link to the account.
 *   - admin "+ Add member", an admin email change, the member import: refuse
 *     or skip, so the address never becomes a second account.
 *
 * A current address always wins: an address an account uses now is released
 * from this table, and lookups check current addresses first.
 */

type FormerEmailClient = Pick<Prisma.TransactionClient, "formerEmail">;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** The account a former address now belongs to, or null. */
export async function accountForFormerEmail(
  email: string,
): Promise<{ id: string; email: string; firstName: string | null; lastName: string | null } | null> {
  const row = await db.formerEmail.findUnique({
    where: { email: normalizeEmail(email) },
    select: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  return row?.user ?? null;
}

/**
 * An address shown to someone who typed a former one: first letter and
 * domain only ("s•••@rootedinmindfulness.org"). Enough to recognize your own
 * address; a person who knows only the old address doesn't learn the new one.
 */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

/** Remember an address an account no longer signs in with. */
export async function recordFormerEmail(
  client: FormerEmailClient,
  args: { userId: string; email: string; reason: "changed" | "merged"; byUserId?: string | null },
): Promise<void> {
  const email = normalizeEmail(args.email);
  const data = { userId: args.userId, reason: args.reason, createdById: args.byUserId ?? null };
  await client.formerEmail.upsert({
    where: { email },
    create: { email, ...data },
    update: { ...data, createdAt: new Date() },
  });
}

/** An address that becomes someone's current address stops being a former one. */
export async function releaseFormerEmail(client: FormerEmailClient, email: string): Promise<void> {
  await client.formerEmail.deleteMany({ where: { email: normalizeEmail(email) } });
}
