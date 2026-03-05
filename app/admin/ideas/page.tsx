import { auth } from "@/auth";
import { redirect } from "next/navigation";
import backlogData from "@/data/backlog.json";

export const metadata = { title: "Feature Ideas — Rooted In Mindfulness" };

type Priority = "high" | "medium" | "low";
type Status = "open" | "in-progress" | "done";

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  addedAt: string;
  notes?: string;
}

// Canonical category order
const CATEGORY_ORDER = [
  "Infrastructure",
  "Member Accounts",
  "Registration",
  "Programs & Sanity",
  "Courses & Library",
  "Email & Notifications",
  "Dashboard",
  "Admin Tools",
  "Nav & Layout",
  "CSS & Design",
];

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_WEIGHT: Record<Status, number> = { open: 0, "in-progress": 1, done: 2 };

function priorityLabel(p: Priority) {
  return p === "high" ? "High" : p === "medium" ? "Medium" : "Low";
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

export default async function IdeasPage() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/login");

  const items = backlogData.items as BacklogItem[];

  // Group by category
  const grouped: Record<string, BacklogItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  // Sort within each category: status first, then priority
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => {
      const sd = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
      if (sd !== 0) return sd;
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    });
  }

  // Ordered category list (known order first, then any unknown categories)
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const totalOpen = items.filter((i) => i.status === "open" || i.status === "in-progress").length;
  const totalHigh = items.filter((i) => i.priority === "high" && i.status !== "done").length;

  return (
    <div className="bl-page">
      <div className="bl-container">

        {/* ── Header ── */}
        <div className="bl-header">
          <div className="bl-header__text">
            <h1 className="bl-header__title">Feature Ideas &amp; Backlog</h1>
            <p className="bl-header__subtitle">
              Notes captured mid-session — updated by Claude. Say &ldquo;Remember that we need&hellip;&rdquo; and it&rsquo;ll be added here.
            </p>
          </div>
          <div className="bl-header__stats">
            <div className="bl-stat">
              <span className="bl-stat__num">{totalOpen}</span>
              <span className="bl-stat__label">Open</span>
            </div>
            <div className="bl-stat">
              <span className="bl-stat__num bl-stat__num--high">{totalHigh}</span>
              <span className="bl-stat__label">High priority</span>
            </div>
          </div>
        </div>

        {/* ── Categories ── */}
        {orderedCategories.map((category) => {
          const catItems = grouped[category];
          const openCount = catItems.filter((i) => i.status !== "done").length;
          return (
            <section key={category} className="bl-category">
              <div className="bl-category__header">
                <h2 className="bl-category__title">{category}</h2>
                {openCount > 0 && (
                  <span className="bl-category__count">{openCount}</span>
                )}
              </div>

              <div className="bl-cards">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className={`bl-card${item.status === "done" ? " bl-card--done" : ""}`}
                  >
                    <div className="bl-card__top">
                      <span className={`bl-badge bl-badge--${item.priority}`}>
                        {priorityLabel(item.priority)}
                      </span>
                      {item.status === "in-progress" && (
                        <span className="bl-badge bl-badge--inprogress">In progress</span>
                      )}
                      {item.status === "done" && (
                        <span className="bl-badge bl-badge--done">Done</span>
                      )}
                    </div>
                    <h3 className="bl-card__title">{item.title}</h3>
                    <p className="bl-card__desc">{item.description}</p>
                    {item.notes && (
                      <p className="bl-card__notes">{item.notes}</p>
                    )}
                    <div className="bl-card__meta">
                      <span className="bl-card__date">Added {formatDate(item.addedAt)}</span>
                      <span className="bl-card__id">#{item.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {items.length === 0 && (
          <p className="bl-empty">No items yet. Say &ldquo;Remember that we need&hellip;&rdquo; mid-session to add one.</p>
        )}

      </div>
    </div>
  );
}
