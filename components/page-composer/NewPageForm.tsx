"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewPageForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Couldn't create the page.");
        setBusy(false);
        return;
      }
      router.push(`/admin/pages/${data.id}/edit`);
    } catch {
      setError("Couldn't create the page. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="bld-newpage">
      <input
        className="bld-newpage__input"
        placeholder="New page title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") create();
        }}
      />
      <button
        type="button"
        className="bld-btn bld-btn--primary"
        onClick={create}
        disabled={busy || !title.trim()}
      >
        {busy ? "Creating…" : "Create page"}
      </button>
      {error ? <p className="bld-newpage__error">{error}</p> : null}
    </div>
  );
}
