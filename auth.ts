import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sendSignInCodeEmail } from "@/lib/email";

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
      // surface area. 10 minutes is the industry standard (Slack, Apple).
      maxAge: 10 * 60,
      // Custom email — code displayed prominently, no magic link.
      sendVerificationRequest: async ({ identifier: email, token }) => {
        const existing = await db.user.findUnique({
          where: { email },
          select: { agreedToTerms: true },
        });
        // New user = no account yet, OR account exists but hasn't completed onboarding.
        const isNewUser = !existing || !existing.agreedToTerms;
        await sendSignInCodeEmail({ to: email, code: token, isNewUser });
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login/error",
  },
  callbacks: {
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
