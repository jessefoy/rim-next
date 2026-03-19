"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DangerAction = "delete" | null;

interface Props {
  memberId: string;
}

export default function DangerZoneSection({ memberId }: Props) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<DangerAction>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState("");

  const handleDangerAction = async (action: DangerAction) => {
    if (action !== "delete") return;
    setDangerBusy(true);
    setDangerError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      router.push("/admin/members");
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDangerBusy(false);
      setConfirmAction(null);
    }
  };

  return (
    <section className="adm2-danger-zone">
      <p className="adm2-danger-zone__title">Danger Zone</p>
      <p className="adm2-section__hint" style={{ marginBottom: 14 }}>
        To block login access, set status to Inactive above.
        Permanent delete is only available for members with no registrations.
      </p>
      {dangerError && <p className="adm2-save__error" style={{ marginBottom: 12 }}>{dangerError}</p>}
      {confirmAction === "delete" ? (
        <div className="adm2-danger-confirm">
          <p className="adm2-danger-confirm__msg">
            Permanently delete this member? This cannot be undone.
          </p>
          <div className="adm2-danger-confirm__actions">
            <button className="adm2-btn--danger" onClick={() => handleDangerAction("delete")} disabled={dangerBusy}>
              {dangerBusy ? "Deleting…" : "Confirm Delete"}
            </button>
            <button className="adm2-btn--neutral" onClick={() => { setConfirmAction(null); setDangerError(""); }} disabled={dangerBusy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="adm2-btn--danger" onClick={() => setConfirmAction("delete")}>
          Delete Member
        </button>
      )}
    </section>
  );
}
