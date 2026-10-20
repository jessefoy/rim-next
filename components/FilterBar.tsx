"use client";

/**
 * The one filter grammar for the member and team pages (2026-10-20, Jesse:
 * "We already have a general navigation for these kinds of things… I don't
 * think we should have too many different configurations. That's confusing
 * for people. Consistency is key.").
 *
 * Born in the Scheduler, and drawn with its classes (hs-): pills with counts
 * ("All 17 · Needs help 12"), a labelled pill with a dropdown ("View · My
 * schedule 2 ▾"), and underline tabs for the parts of a page ("Schedule ·
 * Rotations"). Use these on any page that filters a list; don't invent a
 * page's own. CSS: the Scheduler's .hs-filter / .hs-member-menu / .hs-viewtab
 * rules, shared with the team and member shells.
 */

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

/** A count chip never claims more than it knows: past 99 it reads "99+". */
function chip(n: number): string {
  return n > 99 ? "99+" : String(n);
}

export interface PillOption<K extends string> {
  key: K;
  label: string;
  /** Shown in the pill's count chip; leave out for no chip. */
  count?: number;
  /** Amber, for something that needs attention (the Scheduler's Needs help). */
  alert?: boolean;
}

/** Pills with counts: one is chosen. */
export function FilterPills<K extends string>({
  options,
  value,
  onChange,
  label,
  children,
}: {
  options: PillOption<K>[];
  value: K | null;
  onChange: (key: K) => void;
  /** What the pills choose, for screen readers ("Filter sessions"). */
  label: string;
  /** More pieces in the same row: a ViewPicker, an extra pill. */
  children?: ReactNode;
}) {
  return (
    <div className="hs-filters" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          className={`hs-filter${value === o.key ? " hs-filter--active" : ""}${o.alert && value !== o.key ? " hs-filter--alert" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
          {o.count !== undefined && <span className="hs-filter__count">{chip(o.count)}</span>}
        </button>
      ))}
      {children}
    </div>
  );
}

export interface ViewOption<K extends string> {
  key: K;
  label: string;
  count?: number;
  /** After the label in the menu (a coordinator's star, "(you)"). */
  suffix?: ReactNode;
  /** A line under this item. */
  dividerAfter?: boolean;
}

/**
 * A labelled pill whose caret opens a menu ("View · My schedule 2 ▾").
 * The pill shows the current choice; pressing it applies that choice
 * (`onPress`, as the Scheduler's "My schedule" does); the caret chooses
 * another. Escape and a click outside close the menu, and focus returns
 * to the caret.
 */
export function ViewPicker<K extends string>({
  label,
  options,
  value,
  onChoose,
  onPress,
  active = true,
  disabled = false,
  menuLabel,
}: {
  label: string;
  options: ViewOption<K>[];
  value: K;
  onChoose: (key: K) => void;
  /** Pressing the pill itself. Defaults to opening the menu. */
  onPress?: () => void;
  /** Whether the pill shows as chosen (blue). */
  active?: boolean;
  /** While the page is busy (the choice can't be saved yet). */
  disabled?: boolean;
  /** What the menu chooses, for screen readers ("Choose a team member"). */
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    // Focus the chosen item when the menu opens.
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]");
    const chosen = [...(items ?? [])].find((b) => b.getAttribute("aria-checked") === "true") ?? items?.[0];
    chosen?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        caretRef.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const list = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      if (at === -1) return;
      e.preventDefault();
      list[(at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(key: K) {
    onChoose(key);
    setOpen(false);
    caretRef.current?.focus();
  }

  return (
    <div className="hs-member-filter" ref={wrapRef}>
      <span className="hs-member-filter__label">{label}</span>
      <div className="hs-filter-group">
        <button
          type="button"
          aria-pressed={active}
          className={`hs-filter hs-filter--member${active ? " hs-filter--active" : ""}`}
          disabled={disabled}
          onClick={() => {
            if (onPress) {
              onPress();
              setOpen(false);
            } else setOpen((v) => !v);
          }}
        >
          <span className="hs-filter__label">{current?.label}</span>
          {current?.count !== undefined && <span className="hs-filter__count">{chip(current.count)}</span>}
        </button>
        <button
          ref={caretRef}
          type="button"
          className={`hs-filter__caret${active ? " hs-filter__caret--active" : ""}`}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label={menuLabel}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          ▾
        </button>
        {open && (
          <div className="hs-member-menu" role="menu" aria-label={menuLabel} ref={menuRef}>
            {options.map((o) => (
              <Fragment key={o.key}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={o.key === value}
                  className={`hs-member-menu__item${o.key === value ? " hs-member-menu__item--active" : ""}`}
                  onClick={() => choose(o.key)}
                >
                  {o.label}
                  {o.suffix}
                  {o.count !== undefined && o.count > 0 && <span className="hs-member-menu__count"> {chip(o.count)}</span>}
                </button>
                {o.dividerAfter && <div className="hs-member-menu__divider" />}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Underline tabs for the parts of a page ("Schedule · Rotations"). */
export function SectionTabs<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div className="hs-viewtabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`hs-viewtab${value === o.key ? " hs-viewtab--active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
