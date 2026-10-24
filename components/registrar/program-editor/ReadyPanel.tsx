"use client";

/**
 * Ready to be seen (2026-10-24, Phase 2): one short list at the top of the
 * program editor. A check for each part that's set, a mark only for what
 * keeps the program from being seen or joined, each naming the section that
 * fixes it. Built from the same rules as the sections' own readouts
 * (listingReasonOf; the registration menu's four states), so it never
 * disagrees with them. Open when something needs a look; folded when not.
 */

import { memo, useState } from "react";
import { categorySectionTitle } from "@/lib/programOffering";
import { fmtCentralString, goToSection, nowCentral, type ListingReason, type SectionId } from "./shared";

interface Props {
  hasDescription: boolean;
  startDatetime: string;
  dateText: string;
  timeText: string;
  programFormat: string;
  /** "Jesse Foy, Maria Lopez", or "". */
  teacherNames: string;
  hostingRequired: boolean;
  registrationEnabled: boolean;
  registrationClosed: boolean;
  registrationOpensAt: string;
  notYetPicked: boolean;
  /** A Central "YYYY-MM-DDTHH:mm", or "". */
  registrationDeadline: string;
  registrationCapacity: string;
  questionCount: number;
  openEntry: boolean;
  offeringCategory: string;
  listingReason: ListingReason | null;
}

type Item = { section: SectionId; label: string; text: string; tone: "ok" | "todo" | "note" };

function ReadyPanel(p: Props) {
  const items: Item[] = [];

  items.push(
    p.hasDescription
      ? { section: "about", label: "About", text: "the name and description are in.", tone: "ok" }
      : { section: "about", label: "About", text: "there's no description yet, so the program page has nothing to read.", tone: "todo" },
  );

  const how = p.programFormat === "virtual" ? "online" : p.programFormat === "hybrid" ? "in person and online" : "in person";
  items.push(
    p.startDatetime
      ? { section: "when", label: "When and where", text: `${[p.dateText, p.timeText].filter(Boolean).join(", ")}, ${how}.`, tone: "ok" }
      : { section: "when", label: "When and where", text: "there's no start date, so it isn't on This Week or My Home.", tone: "todo" },
  );

  items.push({
    section: "helping",
    label: "Who’s helping",
    text: `${p.teacherNames ? `taught by ${p.teacherNames}` : "no teacher linked"}${p.hostingRequired ? "" : "; no host needed"}.`,
    tone: "note",
  });

  // The registration menu's four states, as the section reads them.
  const now = nowCentral();
  const opensAhead = !!p.registrationOpensAt && p.registrationOpensAt > now;
  const deadlinePassed = !!p.registrationDeadline && p.registrationDeadline < now;
  const places = p.registrationCapacity ? `${p.registrationCapacity} places` : "no limit on places";
  const questions = p.questionCount ? `, ${p.questionCount} ${p.questionCount === 1 ? "question" : "questions"}` : "";
  items.push(
    !p.registrationEnabled
      ? p.openEntry
        ? { section: "join", label: "How people join", text: "open entry: anyone signed in may join, without registering.", tone: "ok" }
        : { section: "join", label: "How people join", text: "no way to join yet: registration is off and Open entry is off.", tone: "todo" }
      : p.registrationClosed || deadlinePassed
        ? { section: "join", label: "How people join", text: p.registrationClosed ? "registration is closed." : "registration closed when its closing date passed.", tone: "note" }
        : p.notYetPicked && !opensAhead
          ? { section: "join", label: "How people join", text: "choose when registration opens.", tone: "todo" }
          : opensAhead
            ? { section: "join", label: "How people join", text: `registration opens on ${fmtCentralString(p.registrationOpensAt)}; ${places}${questions}.`, tone: "ok" }
            : { section: "join", label: "How people join", text: `registration is open; ${places}${questions}.`, tone: "ok" },
  );

  const r = p.listingReason;
  items.push(
    r === null
      ? { section: "where", label: "Where it appears", text: `listed on Programs & Events under ${categorySectionTitle(p.offeringCategory)}.`, tone: "ok" }
      : r === "noCategory"
        ? { section: "where", label: "Where it appears", text: "it needs a Category to be listed on Programs & Events.", tone: "todo" }
        : r === "hiddenCategory"
          ? { section: "where", label: "Where it appears", text: "its old category is hidden from the public page, so it isn't listed.", tone: "todo" }
          : r === "past"
            ? { section: "where", label: "Where it appears", text: "its date has passed, so it's no longer listed.", tone: "todo" }
            : r === "hidden"
              ? { section: "where", label: "Where it appears", text: "hidden from Programs & Events, as chosen.", tone: "note" }
              : r === "private"
                ? { section: "where", label: "Where it appears", text: "Private, so it's never listed.", tone: "note" }
                : { section: "where", label: "Where it appears", text: "archived, so it isn't listed anywhere.", tone: "note" },
  );

  const todo = items.filter((i) => i.tone === "todo").length;
  const [open, setOpen] = useState(todo > 0);

  return (
    <details className="pe-ready" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} data-pe-separate>
      <summary>
        {todo === 0
          ? "Ready to be seen"
          : `Before it’s ready: ${todo === 1 ? "one thing" : `${todo} things`} to look at`}
      </summary>
      <ul className="pe-ready__list">
        {items.map((i) => (
          <li key={i.section} className={`pe-ready__item pe-ready__item--${i.tone}`}>
            <span className="pe-ready__mark" aria-hidden="true">{i.tone === "todo" ? "!" : i.tone === "ok" ? "✓" : "–"}</span>
            <span>
              {i.tone === "todo" && <span className="rim-sr-only">Needs a look: </span>}
              {/* An inline link, not a <button>: app shells give buttons a 44px box. */}
              <a
                href={`#pe-sec-${i.section}`}
                className="pe-readout__link"
                onClick={(e) => { e.preventDefault(); goToSection(i.section); }}
              >
                {i.label}
              </a>
              : {i.text}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default memo(ReadyPanel);
