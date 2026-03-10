"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  isManager: boolean; // HOST_MANAGER or ADMIN — can see Manage tab
}

const TABS = [
  { label: "Home",          href: "/account/host" },
  { label: "Schedule",      href: "/account/host/schedule" },
  { label: "Conversations", href: "/account/host/conversations" },
];

const MANAGE_TAB = { label: "Manage", href: "/account/host/manage" };

export default function HubTabNav({ isManager }: Props) {
  const pathname = usePathname();

  const tabs = isManager ? [...TABS, MANAGE_TAB] : TABS;

  function isActive(href: string) {
    if (href === "/account/host") {
      return pathname === "/account/host";
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="hub-tabs" aria-label="Host hub navigation">
      {tabs.map((tab) => (
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
