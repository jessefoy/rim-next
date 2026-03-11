import type { NextAuthConfig } from "next-auth";

/**
 * Lightweight auth config for Edge runtime (middleware).
 * No PrismaAdapter, no DB queries — just JWT-based session check.
 *
 * Full auth config (with adapter + session callback) lives in auth.ts.
 * Pages use auth() from auth.ts; middleware uses this file.
 */
export const authConfig = {
  pages: {
    signIn:        "/login",
    verifyRequest: "/login/check-email",
    error:         "/login/error",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      // Only checks if the user has a valid session.
      // agreedToTerms + archivedAt redirects are handled per-page
      // (they require DB access that Edge runtime cannot provide).
      return !!auth;
    },
  },
} satisfies NextAuthConfig;
