import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";

export const metadata = { title: "My Library — Rooted In Mindfulness" };

interface LibraryItem {
  name: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

const LIBRARY_ITEMS: LibraryItem[] = [
  {
    name: "Glossary of Dharma Terms",
    disabled: true,
  },
  {
    name: "Four Foundations of Mindfulness (Satipatthana) Sutta",
    href: "https://www.rootedinmindfulness.org/course/satipatthana-sutta",
    external: true,
  },
  {
    name: "Loving-Kindness (Metta) Sutta",
    href: "/lessons/metta-sutta",
  },
  {
    name: "Handful of Leaves Learning and Practice Resources",
    href: "/course/essential-dharma-study-resources",
  },
];

export default function MyLibraryPage() {
  return (
    <AccountLayout>
    <div className="page-wrapper">
      <div className="lp-content ml-page">
        <h1 className="ml-heading">My Library</h1>
        <p className="ml-intro">
          Learning and practice resources for your journey at RIM.
        </p>

        <div className="ml-list">
          {LIBRARY_ITEMS.map((item) =>
            item.disabled || !item.href ? (
              <div key={item.name} className="ml-item ml-item--disabled">
                <span className="ml-item__title">{item.name}</span>
                <span className="ml-item__arrow">Coming soon</span>
              </div>
            ) : item.external ? (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-item"
              >
                <span className="ml-item__title">{item.name}</span>
                <span className="ml-item__arrow">Go →</span>
              </a>
            ) : (
              <Link key={item.name} href={item.href} className="ml-item">
                <span className="ml-item__title">{item.name}</span>
                <span className="ml-item__arrow">Go →</span>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
    </AccountLayout>
  );
}
