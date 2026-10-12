import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";

export const metadata = { title: "Library - Rooted In Mindfulness" };

// The Library is in preparation (Jesse, 2026-10-12): no courses are offered
// yet, so the page says what the Library will hold and how members will hear
// when it opens. The enrollment list (components/MyCourseLibrary.tsx) is kept
// for the day it opens; this page's earlier query that fed it is in git history.
// The (authenticated) layout already gates the session and agreement.
export default function LibraryPage() {
  return (
    <AccountLayout>
      <div className="ac-member-page lib-page">
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">Library</h1>
            <p className="ac-page-sub">Teachings to study and return to, at your own pace.</p>
          </div>
        </header>

        <section className="lib-soon" aria-labelledby="lib-soon-title">
          <p className="lib-soon__eyebrow">In preparation</p>
          <h2 id="lib-soon-title" className="lib-soon__title">
            The Library is being prepared.
          </h2>
          <p>
            It will be a place to keep learning between gatherings, with courses you
            can take at your own pace, dharma teachings to return to, A Handful of
            Leaves, and a glossary of the words we use in practice.
          </p>
          <p>
            We are building it with care, and it will grow over time. When it opens,
            we will let you know here in your member area and by email.
          </p>
          <p className="lib-soon__meanwhile">Until then, the practice continues in our gatherings.</p>
          <div className="pp-actions">
            <Link href="/this-week" className="pp-btn">
              This week&rsquo;s schedule <span aria-hidden="true">→</span>
            </Link>
            <Link href="/account/dashboard" className="pp-btn pp-btn--ghost">
              Back to My Home
            </Link>
          </div>
        </section>
      </div>
    </AccountLayout>
  );
}
