"use client";

/**
 * How each section of Programs & Events is ordered (2026-10-28, Phase 3): the
 * sections as visitors see them. A program can be shown first; those shown
 * first can move up and down among themselves; everything else takes its
 * place by when it meets (lib/programOrder.ts). Saved as one list.
 *
 * CSS prefix: psu- (ps- is the Scheduler's staffing page)
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Section {
  code: string;
  title: string;
  programs: { slug: string; name: string; when: string; first: number | null }[];
}

export default function OrderClient({ sections }: { sections: Section[] }) {
  const router = useRouter();
  // Every program shown first, in order, across the sections.
  const [first, setFirst] = useState<string[]>(() =>
    sections.flatMap((s) => s.programs).filter((p) => p.first != null).sort((a, b) => a.first! - b.first!).map((p) => p.slug),
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function save(next: string[]) {
    // One change at a time, so an older order can't land after a newer one.
    if (state === "saving") return;
    setFirst(next);
    setState("saving");
    try {
      const shown = sections.flatMap((x) => x.programs.map((p) => p.slug));
      const res = await fetch("/api/programs-pg/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first: next, shown }) });
      setState(res.ok ? "saved" : "failed");
      if (res.ok) router.refresh();
    } catch {
      setState("failed");
    }
  }
  const move = (slug: string, by: number, inSection: string[]) => {
    const i = inSection.indexOf(slug);
    const other = inSection[i + by];
    if (!other) return;
    const next = [...first];
    const a = next.indexOf(slug), b = next.indexOf(other);
    [next[a], next[b]] = [next[b], next[a]];
    void save(next);
  };

  return (
    <div className="psu-page">
      <div className="psu-head">
        <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
        <h1>How each section is ordered</h1>
        <p className="psu-state">
          Each section of Programs &amp; Events lists what goes on by its day of the week (Monday first) and time, then what has an end by its first session.
          A program shown first leads its section. The Kalyana Mitta groups page lists Community Groups the same way.
        </p>
        <p className="psu-state" role="status" aria-live="polite">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved. Programs & Events shows this order now." : state === "failed" ? "It wasn't saved. Check your connection and try again." : ""}
        </p>
      </div>
      <div className="psu-review">
        {sections.map((s) => {
          const pinned = first.filter((slug) => s.programs.some((p) => p.slug === slug));
          const rest = s.programs.filter((p) => !first.includes(p.slug));
          const ordered = [...pinned.map((slug) => s.programs.find((p) => p.slug === slug)!), ...rest];
          return (
            <section key={s.code} className="psu-card" aria-labelledby={`ord-${s.code}`}>
              <div className="psu-card__head"><h2 id={`ord-${s.code}`}>{s.title}</h2></div>
              <ol className="psu-order">
                {ordered.map((p) => {
                  const isFirst = first.includes(p.slug);
                  const i = pinned.indexOf(p.slug);
                  return (
                    <li key={p.slug} className="psu-order__row">
                      <span className="psu-order__name">
                        {p.name}
                        <span className="psu-hint">{[p.when, isFirst ? "shown first" : ""].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="psu-order__acts" aria-busy={state === "saving"}>
                        {isFirst && i > 0 && <button type="button" className="app-act" onClick={() => move(p.slug, -1, pinned)} aria-label={`Move ${p.name} up`}>Move up</button>}
                        {isFirst && i < pinned.length - 1 && <button type="button" className="app-act" onClick={() => move(p.slug, 1, pinned)} aria-label={`Move ${p.name} down`}>Move down</button>}
                        {isFirst
                          ? <button type="button" className="app-act" onClick={() => save(first.filter((x) => x !== p.slug))} aria-label={`Stop showing ${p.name} first`}>Stop showing first</button>
                          : <button type="button" className="app-act" onClick={() => save([...first, p.slug])} aria-label={`Show ${p.name} first`}>Show first</button>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
