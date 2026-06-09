"use client";

import { useState } from "react";

interface Props {
  memberId: string;
  email: string;
  archived: boolean;
}

/**
 * Admin "send this member a way in" — the pastoral helper that stands in for a
 * password reset. One button sends the member a fresh 6-digit sign-in code to
 * their email on file. There's nothing to recover and no secret stored; the
 * code is their way in. ADMIN/REGISTRAR only (gated by the registry + the route).
 */
export default function AccountAccessSection({ memberId, email, archived }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const sendCode = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/send-signin`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, msg: data?.error ?? "Couldn't send the code. Please try again." });
      } else {
        setResult({ ok: true, msg: `Sign-in code sent to ${email}.` });
      }
    } catch {
      setResult({ ok: false, msg: "Couldn't send the code. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-section">
      <h2 className="adm-section__title">Account access</h2>
      <p className="adm2-section__hint" style={{ marginBottom: 14 }}>
        Send this member a fresh 6-digit sign-in code to <strong>{email}</strong> —
        for when someone&rsquo;s stuck getting in. There are no passwords to reset;
        the code is their way in, and it goes only to their email on file.
      </p>
      {result && (
        <p
          className={result.ok ? "adm2-save__success" : "adm2-save__error"}
          style={{ marginBottom: 12 }}
        >
          {result.msg}
        </p>
      )}
      {archived ? (
        <p className="adm2-section__hint">
          This member is archived. Restore them above before sending a sign-in code.
        </p>
      ) : (
        <button
          type="button"
          className="adm2-btn--neutral"
          onClick={sendCode}
          disabled={busy}
        >
          {busy ? "Sending…" : "Send sign-in code"}
        </button>
      )}
    </section>
  );
}
