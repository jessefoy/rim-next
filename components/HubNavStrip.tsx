"use client";

/**
 * HubNavStrip — generic tab strip for /account/hub/[slug]/* routes.
 * Accepts dynamic tabs as props. Distinct from HubTabNav (host hub only).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
}

interface Props {
  tabs: Tab[];
}

export default function HubNavStrip({ tabs }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    // Exact match for the first tab (announcements = hub root)
    const isRoot = tabs[0]?.href === href;
    if (isRoot) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="hub-tabs" aria-label="Hub navigation">
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
