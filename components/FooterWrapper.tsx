"use client";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function FooterWrapper() {
  const pathname = usePathname();
  const suppress = pathname.startsWith("/admin") || pathname.startsWith("/account/hub");
  if (suppress) return null;
  return <Footer />;
}
