"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Home",          href: "/account/host" },
  { label: "Schedule",      href: "/account/host/schedule" },
  { label: "Conversations", href: "/account/host/conversations" },
];

export default function HubTabNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/account/host") {
      return pathname === "/account/host";
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="hub-tabs" aria-label="Host hub navigation">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`hub-tabs__link${isActive(tab.href) ? " hub-tabs__link--active" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
