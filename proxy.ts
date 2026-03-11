import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe proxy (Next.js 16 uses proxy.ts with a default export).
// Uses lightweight auth config with no PrismaAdapter so it runs in Edge runtime.
// Full auth (with DB adapter + session callback) lives in auth.ts and is
// used by pages/API routes which run in Node.js runtime.
// Unauthenticated requests are redirected to /login via the authorized() callback.
// agreedToTerms + archivedAt checks are handled per-page.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: ["/account/:path*", "/account/hub/:path*", "/volunteer/:path*", "/admin/:path*", "/course/:path*", "/hosts/:path*", "/hosts"],
};
