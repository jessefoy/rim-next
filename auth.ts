import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
      name: "Rooted In Mindfulness",
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
          select: { firstName: true, roles: true, agreedToTerms: true },
        });
        if (dbUser?.firstName) {
          session.user.name = dbUser.firstName;
        }
        session.user.roles = dbUser?.roles ?? [];
        session.user.agreedToTerms = dbUser?.agreedToTerms ?? false;
      }
      return session;
    },
  },
});
