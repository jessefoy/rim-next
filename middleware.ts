import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe middleware: uses lightweight config with no PrismaAdapter.
// Full auth (with DB adapter + session callback) lives in auth.ts and is
// used by pages/API routes which run in Node.js runtime.
// The authorized() callback in authConfig redirects unauthenticated users
// to /login. agreedToTerms + archivedAt checks are handled per-page.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/account/:path*", "/account/hub/:path*", "/volunteer/:path*", "/admin/:path*", "/course/:path*", "/hosts/:path*", "/hosts"],
};
