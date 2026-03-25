"use client";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function FooterWrapper() {
  const pathname = usePathname();
  const suppress =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/lessons/") ||
    pathname.startsWith("/course/");
  if (suppress) return null;
  return <Footer />;
}
