import Link from "next/link";
import { auth } from "@/auth";

export const metadata = {
  title: "Thanks for Your Interest in Volunteering — Rooted In Mindfulness",
};

export default async function VolunteerThanksPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div className="pp-page">
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-intro pp-intro--center">
            <p className="pp-intro__eyebrow">Embodied generosity</p>
            <h1 className="pp-intro__title">
              Thanks{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="pp-intro__body">
              Your volunteerism helps co-create a truly supportive refuge community at Rooted In
              Mindfulness. On behalf of the lives you impact with your care and generosity,{" "}
              <strong>thank you.</strong>
            </p>
          </div>

          <div className="pp-panel">
            <p className="pp-panel__body">Someone from RIM will get in touch with you soon.</p>
          </div>

          <div className="pp-actions pp-actions--center">
            <Link href="/community-programs" className="pp-btn">
              See our programs
            </Link>
            <Link href="/" className="pp-link">
              Back to home <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
