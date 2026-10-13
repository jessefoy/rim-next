"use client";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import { isPersonalAccountPath } from "@/lib/personalNav";

export default function FooterWrapper({ year }: { year?: number }) {
  const pathname = usePathname();
  // The member's personal pages are part of the site, so they keep its
  // footer (lib/personalNav.ts); team, admin and tool pages do not.
  const suppress =
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/account") && !isPersonalAccountPath(pathname)) ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/lessons/") ||
    pathname.startsWith("/course/");
  if (suppress) return null;
  // Members are not asked to sign up for the newsletter on their own pages.
  return <Footer year={year} memberArea={isPersonalAccountPath(pathname)} />;
}
