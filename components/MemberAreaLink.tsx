"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { HANDFUL_PATHS } from "@/lib/handfulPaths";

/**
 * "member area" inside a public sentence on /handful-of-leaves (the integration
 * follow-up brief, F5). A signed-in member goes to the introduction; everyone
 * else, and anyone whose session has not loaded yet, goes to sign-in. The page
 * is prerendered, so the choice is made in the browser once the session is known.
 */
export default function MemberAreaLink({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const href = status === "authenticated" ? HANDFUL_PATHS.introduction : "/login";
  return <Link href={href}>{children}</Link>;
}
