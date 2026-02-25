import Link from "next/link";

export const metadata = { title: "My Library — Rooted In Mindfulness" };

const LIBRARY_ITEMS = [
  {
    name: "Glossary of Dharma Terms",
    href: null,
    label: "Coming Soon",
  },
  {
    name: "Four Foundations of Mindfulness (Satipatthana) Sutta",
    href: "/course/satipatthana-sutta",
    label: "Go →",
  },
  {
    name: "Loving-Kindness (Metta) Sutta",
    href: "/lessons/metta-sutta",
    label: "Go →",
  },
  {
    name: "Handful of Leaves Learning and Practice Resources",
    href: "/course/essential-dharma-study-resources",
    label: "Go →",
  },
];

export default function MyLibraryPage() {
  return (
    <div className="page-wrapper">
      <div className="dashboard-section">
        <div className="dashboard-content">
          <h1 className="heading-11">Learning and Practice Support</h1>
          <p className="paragraph-17-copy">
            The following are links to the learning and practice resources associated with your
            activities at RIM. <br />
            <strong>Please Note:</strong> This page is still a work in progress and subject to
            change ;)
          </p>
          {LIBRARY_ITEMS.map((item) => (
            <div key={item.name} className="w-layout-grid programlistblock">
              <div className="dashboard-list-name-and-date-container">
                <div className="name-day-and-time-block">
                  <div className="dashboard-title-container">
                    <h1 className="event-name">{item.name}</h1>
                  </div>
                </div>
              </div>
              <div className="program-links">
                {item.href ? (
                  <Link href={item.href} className="program-list-button w-button">
                    {item.label}
                  </Link>
                ) : (
                  <span className="program-list-button w-button" style={{ opacity: 0.5, cursor: "default" }}>
                    {item.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
