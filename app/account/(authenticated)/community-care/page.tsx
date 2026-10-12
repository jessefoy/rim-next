import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import {
  CARE_REPAIR_ACTION,
  CARE_REPAIR_BODY,
  CARE_REPAIR_HREF,
  CARE_REPAIR_TITLE,
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
  COMMUNITY_SHARED_VISION_TITLE,
} from "@/lib/communityAgreements";

export const metadata = { title: "Community Care - Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

// The member's Community Care page follows the public agreements page
// (Jesse, 2026-10-12): the same frame, the same numbered agreements, the same
// "If harm happens" door, plus the day this member agreed to hold them
// (User.agreedAt, recorded on every sign-up path; omitted when absent).
export default async function CommunityCarePage() {
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { agreedAt: true } })
    : null;
  const agreedOn = user?.agreedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Chicago",
      }).format(user.agreedAt)
    : null;

  return (
    <AccountLayout>
      <article className="ac-member-page rim-care">
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">Community Care</h1>
            <p className="ac-page-sub">
              The shared vision and three agreements every member of RIM holds.
              {agreedOn && <> You agreed to hold them on {agreedOn}.</>}
            </p>
          </div>
        </header>

        <p className="rim-care__frame">
          <strong>{COMMUNITY_SHARED_VISION_TITLE}.</strong> {COMMUNITY_AGREEMENTS_LEAD_IN}
        </p>

        <ol className="cc-agreements">
          {COMMUNITY_AGREEMENTS.map((agreement, index) => (
            <li key={agreement.title} className="cc-agreement">
              <span className="cc-agreement__number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h2 className="cc-agreement__title">{agreement.title}</h2>
                <p className="cc-agreement__body">{agreement.summary}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="cc-repair" aria-labelledby="cc-repair-title">
          <h2 id="cc-repair-title" className="cc-repair__title">{CARE_REPAIR_TITLE}</h2>
          <p className="cc-repair__body">{CARE_REPAIR_BODY}</p>
          <div className="pp-actions">
            <Link href={CARE_REPAIR_HREF} className="pp-btn pp-btn--ghost">
              {CARE_REPAIR_ACTION} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </article>
    </AccountLayout>
  );
}
