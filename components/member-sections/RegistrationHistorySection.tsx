"use client";

import { useState } from "react";
import Link from "next/link";
import type { SerializedMember } from "@/lib/memberSectionRegistry";

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  WAITLISTED: "Waitlisted",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

interface Props {
  registrations: SerializedMember["registrations"];
}

export default function RegistrationHistorySection({ registrations }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? registrations : registrations.slice(0, 5);

  const regDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="adm2-section">
      <h2 className="adm2-section__title">Registration History</h2>
      {registrations.length === 0 ? (
        <p className="adm2-empty">No registrations yet.</p>
      ) : (
        <>
          <div className="adm2-reg-list">
            {visible.map((r) => (
              <div key={r.id} className="adm2-reg">
                <Link href={`/account/hub/registrar/programs/${r.programSlug}`} className="adm2-reg__title">
                  {r.programTitle}
                </Link>
                <span className="adm2-reg__date">{regDate(r.createdAt)}</span>
                <span className={`adm2-reg__status adm2-reg__status--${r.status.toLowerCase()}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
          {registrations.length > 5 && (
            <button className="adm2-show-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : `Show all ${registrations.length} registrations`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
