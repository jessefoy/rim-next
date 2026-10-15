import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sendSignInCodeEmail } from "@/lib/email";
import { addVerifiedMemberToFlodesk } from "@/lib/flodesk";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    maxAge: 90 * 24 * 60 * 60,  // 90 days — stays signed in between infrequent visits
    updateAge: 24 * 60 * 60,    // refresh expiry at most once per day on activity
  },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
      name: "Rooted In Mindfulness",
      // 6-digit numeric code instead of the default long random token.
      // Codes are user-typeable (works across browsers / PWAs / contexts
      // where a magic link can't reliably route back to the original app).
      // crypto.randomInt is uniformly distributed across the range — no
      // modulo bias.
      generateVerificationToken: async () => randomInt(100000, 1000000).toString(),
      // Shorter expiry than the default 24h because 6-digit codes have
      // only 1M combinations; tightening the window reduces brute-force
      // surface area. 30 minutes is a humane balance — long enough that
      // a user can walk away from their email, come back, and still sign
      // in without re-requesting.
      maxAge: 30 * 60,
      // Custom email — code displayed prominently, no magic link.
      sendVerificationRequest: async ({ identifier: email, token }) => {
        const existing = await db.user.findUnique({
          where: { email },
          select: { emailVerified: true },
        });
        // "New user" here means "has never completed a code verification" —
        // not "has never agreed to terms." `/join` sets agreedToTerms BEFORE
        // the code email goes out, so branching on agreedToTerms would send
        // every /join user the routine returning-member code email. Branching
        // on emailVerified (which NextAuth's PrismaAdapter sets only after
        // first successful verification) correctly classifies:
        //   - Door B /join user, first sign-in: emailVerified is null → warm welcome variant
        //   - Door A first-time visitor (no /join): no User row → warm welcome variant
        //   - Door A returning member: emailVerified is set → quiet code variant
        const isNewUser = !existing || existing.emailVerified === null;
        await sendSignInCodeEmail({ to: email, code: token, isNewUser });
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login/error",
  },
  events: {
    // A sign-in with a code proves the address. A member who has agreed joins
    // Flodesk's Members segment then, once (lib/flodesk.ts); after that this
    // is one indexed read. Best-effort, never blocks the sign-in.
    async signIn({ user }) {
      if (user?.id) await addVerifiedMemberToFlodesk(user.id);
    },
  },
  callbacks: {
    // No sign-in code is sent to, or accepted for, an address that is only a
    // former one (lib/formerEmail.ts): that would make a second account at the
    // old address. Covers every way a code is asked for, including a code
    // requested before an admin changed the address. Fail-safe on a database
    // error, like the existence checks at the doors.
    async signIn({ user }) {
      const address = user?.email?.trim().toLowerCase();
      if (!address) return true;
      try {
        if (await db.user.findUnique({ where: { email: address }, select: { id: true } })) return true;
        return !(await db.formerEmail.findUnique({ where: { email: address }, select: { id: true } }));
      } catch (err) {
        console.error("[auth] Former address check failed", err);
        return true;
      }
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { firstName: true, roles: true, agreedToTerms: true, archivedAt: true },
        });
        if (dbUser?.firstName) {
          session.user.name = dbUser.firstName;
        }
        session.user.roles = dbUser?.roles ?? [];
        session.user.agreedToTerms = dbUser?.agreedToTerms ?? false;
        session.user.archivedAt = dbUser?.archivedAt?.toISOString() ?? null;
      }
      return session;
    },
  },
});
