"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { PageContent, PageSection, BlockStyle, ControlDef } from "@/lib/pageBuilder/types";
import { BLOCKS, STYLE_CONTROL_META, getBlock } from "@/lib/pageBuilder/registry";
import { blockStyleClasses } from "@/lib/pageBuilder/style";
import { BLOCK_COMPONENTS } from "@/components/page-blocks";

const RimTiptapEditor = dynamic(() => import("@/components/rim-tiptap/RimTiptapEditor"), {
  ssr: false,
});

interface Props {
  pageId: string;
  slug: string;
  initialTitle: string;
  initialStatus: "DRAFT" | "PUBLISHED";
  initialContent: PageContent;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "s-" + Math.random().toString(36).slice(2, 10);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function PageComposer({ pageId, slug, initialTitle, initialStatus, initialContent }: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<PageSection[]>(initialContent.sections ?? []);
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) ?? null,
    [sections, selectedId]
  );
  const selectedDef = selected ? getBlock(selected.type) : null;

  function patchSection(id: string, patch: Partial<PageSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function setProp(id: string, key: string, value: unknown) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, props: { ...s.props, [key]: value } } : s))
    );
  }
  function setStyleKey(id: string, key: keyof BlockStyle, value: string) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const style = { ...(s.style ?? {}) } as Record<string, string>;
        if (!value) delete style[key];
        else style[key] = value;
        return { ...s, style: style as BlockStyle };
      })
    );
  }
  function addBlock(type: string) {
    const def = getBlock(type);
    if (!def) return;
    const section: PageSection = {
      id: newId(),
      type,
      variant: def.variants?.[0]?.key,
      props: clone(def.defaultProps),
      style: {},
    };
    setSections((prev) => [...prev, section]);
    setSelectedId(section.id);
  }
  function move(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function setItem(sectionId: string, key: string, index: number, field: string, value: string) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const list = Array.isArray(s.props[key])
          ? [...(s.props[key] as Record<string, unknown>[])]
          : [];
        list[index] = { ...list[index], [field]: value };
        return { ...s, props: { ...s.props, [key]: list } };
      })
    );
  }
  function addItem(sectionId: string, control: ControlDef) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const list = Array.isArray(s.props[control.key]) ? [...(s.props[control.key] as unknown[])] : [];
        const blank: Record<string, string> = {};
        (control.itemControls ?? []).forEach((ic) => {
          blank[ic.key] = "";
        });
        list.push(blank);
        return { ...s, props: { ...s.props, [control.key]: list } };
      })
    );
  }
  function removeItem(sectionId: string, key: string, index: number) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const list = Array.isArray(s.props[key]) ? [...(s.props[key] as unknown[])] : [];
        list.splice(index, 1);
        return { ...s, props: { ...s.props, [key]: list } };
      })
    );
  }

  async function save(nextStatus?: "DRAFT" | "PUBLISHED") {
    if (saving) return;
    setSaving(true);
    setError(null);
    const statusToSave = nextStatus ?? status;
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: statusToSave, content: { version: 1, sections } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Couldn't save.");
        setSaving(false);
        return;
      }
      setStatus(statusToSave);
      setSavedAt(new Date().toLocaleTimeString());
      setSaving(false);
      router.refresh();
    } catch {
      setError("Couldn't save. Please try again.");
      setSaving(false);
    }
  }

  function renderControl(section: PageSection, control: ControlDef): ReactNode {
    const value = section.props[control.key];
    if (control.type === "text" || control.type === "url") {
      return (
        <input
          className="bld-field__input"
          value={typeof value === "string" ? value : ""}
          placeholder={control.placeholder}
          onChange={(e) => setProp(section.id, control.key, e.target.value)}
        />
      );
    }
    if (control.type === "textarea") {
      return (
        <textarea
          className="bld-field__textarea"
          value={typeof value === "string" ? value : ""}
          placeholder={control.placeholder}
          onChange={(e) => setProp(section.id, control.key, e.target.value)}
        />
      );
    }
    if (control.type === "richText") {
      return (
        <div className="bld-field__editor">
          <RimTiptapEditor
            value={typeof value === "string" ? value : ""}
            onChange={(html: string) => setProp(section.id, control.key, html)}
            variant="document"
          />
        </div>
      );
    }
    if (control.type === "items") {
      const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      return (
        <div className="bld-items">
          {list.map((item, i) => (
            <div className="bld-items__row" key={i}>
              <div className="bld-items__head">
                <span>Item {i + 1}</span>
                <button
                  type="button"
                  className="bld-btn bld-btn--ghost"
                  onClick={() => removeItem(section.id, control.key, i)}
                >
                  Remove
                </button>
              </div>
              {(control.itemControls ?? []).map((ic) => (
                <label className="bld-field" key={ic.key}>
                  <span className="bld-field__label">{ic.label}</span>
                  {ic.type === "textarea" ? (
                    <textarea
                      className="bld-field__textarea"
                      value={typeof item[ic.key] === "string" ? (item[ic.key] as string) : ""}
                      onChange={(e) => setItem(section.id, control.key, i, ic.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="bld-field__input"
                      value={typeof item[ic.key] === "string" ? (item[ic.key] as string) : ""}
                      onChange={(e) => setItem(section.id, control.key, i, ic.key, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          ))}
          <button
            type="button"
            className="bld-btn bld-btn--ghost"
            onClick={() => addItem(section.id, control)}
          >
            + Add item
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bld">
      <div className="bld-topbar">
        <div className="bld-topbar__left">
          <a href="/admin/pages" className="bld-topbar__back">
            ← Pages
          </a>
          <input
            className="bld-topbar__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Page title"
          />
          <span className="bld-topbar__slug">/{slug}</span>
        </div>
        <div className="bld-topbar__right">
          {error ? <span className="bld-topbar__error">{error}</span> : null}
          {savedAt && !error ? <span className="bld-topbar__saved">Saved {savedAt}</span> : null}
          <span className={`bld-status bld-status--${status.toLowerCase()}`}>
            {status === "PUBLISHED" ? "Published" : "Draft"}
          </span>
          <button type="button" className="bld-btn" onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {status === "PUBLISHED" ? (
            <button type="button" className="bld-btn" onClick={() => save("DRAFT")} disabled={saving}>
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="bld-btn bld-btn--primary"
              onClick={() => save("PUBLISHED")}
              disabled={saving}
            >
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="bld-body">
        <aside className="bld-palette">
          <p className="bld-palette__group">Blocks</p>
          {BLOCKS.map((b) => (
            <button
              key={b.type}
              type="button"
              className="bld-palette__item"
              onClick={() => addBlock(b.type)}
            >
              + {b.label}
            </button>
          ))}
        </aside>

        <main className="bld-canvas">
          {sections.length === 0 ? (
            <div className="bld-canvas__empty">Add a block from the left to begin.</div>
          ) : (
            sections.map((section, i) => {
              const Block = BLOCK_COMPONENTS[section.type];
              const { section: sCls, inner: iCls } = blockStyleClasses(section.style);
              const isSel = section.id === selectedId;
              return (
                <div
                  key={section.id}
                  className={`bld-cblock ${isSel ? "bld-cblock--sel" : ""}`.trim()}
                  onClick={() => setSelectedId(section.id)}
                >
                  <div className="bld-cblock__tools">
                    <span className="bld-cblock__type">
                      {getBlock(section.type)?.label ?? section.type}
                    </span>
                    <button
                      type="button"
                      className="bld-iconbtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(section.id, -1);
                      }}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="bld-iconbtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(section.id, 1);
                      }}
                      disabled={i === sections.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="bld-iconbtn bld-iconbtn--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(section.id);
                      }}
                      aria-label="Delete block"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="bld-cblock__content">
                    <section className={`blk ${sCls}`.trim()}>
                      <div className={`blk__inner ${iCls}`.trim()}>
                        {Block ? (
                          <Block section={section} />
                        ) : (
                          <div className="bld-cblock__unknown">Unknown block: {section.type}</div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              );
            })
          )}
        </main>

        <aside className="bld-inspector">
          {!selected || !selectedDef ? (
            <p className="bld-inspector__empty">Select a block to edit it.</p>
          ) : (
            <>
              <p className="bld-inspector__title">{selectedDef.label}</p>

              {selectedDef.variants && selectedDef.variants.length > 0 ? (
                <label className="bld-field">
                  <span className="bld-field__label">Layout</span>
                  <select
                    className="bld-field__select"
                    value={selected.variant ?? selectedDef.variants[0].key}
                    onChange={(e) => patchSection(selected.id, { variant: e.target.value })}
                  >
                    {selectedDef.variants.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedDef.controls.map((control) => (
                <label className="bld-field" key={control.key}>
                  <span className="bld-field__label">{control.label}</span>
                  {renderControl(selected, control)}
                </label>
              ))}

              <p className="bld-inspector__group">Design</p>
              {(selectedDef.styleControls ?? []).map((key) => {
                const meta = STYLE_CONTROL_META[key];
                const val = (selected.style?.[key] as string) ?? "";
                if (meta.type === "swatch") {
                  return (
                    <div className="bld-field" key={key}>
                      <span className="bld-field__label">{meta.label}</span>
                      <div className="bld-swatches">
                        {meta.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`bld-swatch bld-swatch--${opt.value} ${
                              val === opt.value ? "bld-swatch--on" : ""
                            }`.trim()}
                            title={opt.label}
                            aria-label={opt.label}
                            onClick={() => setStyleKey(selected.id, key, opt.value)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <label className="bld-field" key={key}>
                    <span className="bld-field__label">{meta.label}</span>
                    <select
                      className="bld-field__select"
                      value={val}
                      onChange={(e) => setStyleKey(selected.id, key, e.target.value)}
                    >
                      <option value="">Default</option>
                      {meta.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
