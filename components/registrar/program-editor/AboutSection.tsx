"use client";

/** About: what the program is (name, address, tagline, image, description,
 *  quote, notes). One of the program editor's seven sections. */

import { memo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { EditorSection, RimTiptapEditor, type Setter } from "./shared";

interface Props {
  isEditing: boolean;
  name: string;
  setName: Setter<string>;
  slug: string;
  setSlug: Setter<string>;
  setSlugTouched: Setter<boolean>;
  tagline: string;
  setTagline: Setter<string>;
  programImage: string;
  setProgramImage: Setter<string>;
  setError: Setter<string>;
  description: string;
  setDescription: Setter<string>;
  pullQuote: string;
  setPullQuote: Setter<string>;
  pullQuoteSource: string;
  setPullQuoteSource: Setter<string>;
  programNotes: string;
  setProgramNotes: Setter<string>;
  markDirty: () => void;
}

function AboutSection({
  isEditing,
  name, setName,
  slug, setSlug, setSlugTouched,
  tagline, setTagline,
  programImage, setProgramImage, setError,
  description, setDescription,
  pullQuote, setPullQuote,
  pullQuoteSource, setPullQuoteSource,
  programNotes, setProgramNotes,
  markDirty,
}: Props) {
  const [slugLocked, setSlugLocked] = useState(isEditing);
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setProgramImage(blob.url);
      markDirty();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <EditorSection id="about">
      <div className="pe-card__section">
        <div className="pe-form">
          <label className="pe-field">
            <span className="pe-field__label">Name *</span>
            <span className="pe-field__help">The program title. This appears on the public site, on the member home, and in all emails.</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="pe-input" required />
          </label>

          <label className="pe-field">
            <span className="pe-field__label">Slug *</span>
            <span className="pe-field__help">The URL path for this program (e.g. /programs/morning-sit). Changing this after the program is live will break existing links and host assignments.</span>
            <div className="pe-slug-row">
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                className="pe-input"
                disabled={slugLocked}
                required
              />
              {isEditing && (
                <button
                  type="button"
                  className="pe-btn pe-btn--small"
                  onClick={() => setSlugLocked(!slugLocked)}
                >
                  {slugLocked ? "Unlock" : "Lock"}
                </button>
              )}
            </div>
            {isEditing && !slugLocked && (
              <span className="pe-field__help pe-field__help--warn">
                Changing the slug breaks existing links. Once anyone has registered or the schedule uses it, it can&rsquo;t change.
              </span>
            )}
          </label>

          <label className="pe-field">
            <span className="pe-field__label">Tagline</span>
            <span className="pe-field__help">A one-line description shown below the program name on the Programs page and in search results.</span>
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="pe-input" />
          </label>

          <div className="pe-field">
            <span className="pe-field__label">Program Image</span>
            <span className="pe-field__help">Shown on the public program page and in the Programs listing. Landscape format works best.</span>
            {programImage && (
              <div className="pe-image-preview">
                <img src={programImage} alt="Program" className="pe-image-preview__img" />
                <button type="button" className="pe-btn pe-btn--small pe-btn--danger" onClick={() => { setProgramImage(""); markDirty(); }}>
                  Remove
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="pe-file-input"
              disabled={uploading}
            />
            {uploading && <span className="pe-muted">Uploading…</span>}
          </div>
        </div>
      </div>

      <div className="pe-card__section">
        <div className="pe-form">
          <div className="pe-field">
            <span className="pe-field__label">Description</span>
            <span className="pe-field__help">The full program description shown on the public program page. Write for someone who has never been to RIM.</span>
            <RimTiptapEditor
              value={description}
              onChange={(v) => { setDescription(v); markDirty(); }}
              placeholder="Program description…"
              variant="document"
            />
          </div>
        </div>
      </div>

      <div className="pe-card__section">
        <div className="pe-form">
          <label className="pe-field">
            <span className="pe-field__label">Pull Quote</span>
            <span className="pe-field__help">Optional. A short highlighted quote can anchor the public program page. Leave it empty and the page opens straight onto the description.</span>
            <input type="text" value={pullQuote} onChange={(e) => setPullQuote(e.target.value)} className="pe-input" />
          </label>

          <label className="pe-field">
            <span className="pe-field__label">Pull Quote Source</span>
            <span className="pe-field__help">Attribute the quote whenever possible. The source appears below it in smaller text. Needs a quote above.</span>
            <input type="text" value={pullQuoteSource} onChange={(e) => setPullQuoteSource(e.target.value)} className="pe-input" />
          </label>
        </div>
      </div>

      <div className="pe-card__section">
        <div className="pe-form">
          <div className="pe-field">
            <span className="pe-field__label">Program Notes</span>
            <span className="pe-field__help">Additional notes shown on the program&rsquo;s page: scheduling context, accessibility, background. The quiet line shown with a session on the day belongs in Session note, under When and where.</span>
            <RimTiptapEditor
              value={programNotes}
              onChange={(v) => { setProgramNotes(v); markDirty(); }}
              placeholder="Program notes…"
              variant="message"
            />
          </div>
        </div>
      </div>
    </EditorSection>
  );
}

export default memo(AboutSection);
