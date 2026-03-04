import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";

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
      // Custom magic link email — welcoming for first-timers, simple for returning members.
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const existing = await db.user.findUnique({
          where: { email },
          select: { agreedToTerms: true },
        });
        // New user = no account yet, OR account exists but hasn't completed onboarding.
        const isNewUser = !existing || !existing.agreedToTerms;
        await sendMagicLinkEmail({ to: email, url, isNewUser });
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
