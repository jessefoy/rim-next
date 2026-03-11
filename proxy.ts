import { NextResponse } from "next/server";

// Route protection is handled per-page via auth() from auth.ts (Node.js runtime).
// NextAuth v5 with a database adapter cannot verify sessions in Edge runtime,
// so we cannot do auth-gating here without causing login loops.
// All protected pages already call auth() and redirect to /login if unauthenticated.
export default function proxy() {
  return NextResponse.next();
}

// Empty matcher — proxy runs on no routes.
export const config = { matcher: [] };
