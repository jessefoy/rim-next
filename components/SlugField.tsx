"use client";

/**
 * SlugField — locked-by-default slug input with Unlock/Lock toggle.
 * Standard pattern for all URL slug fields in the app.
 * CSS: th-slug-row, th-input:disabled, th-field__hint--warn
 */

import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;          // true = starts locked; false = new record, always editable
  warnText?: string;           // amber warning shown when unlocked (editing mode)
  hintText?: string;           // muted hint shown when locked (optional)
}

export default function SlugField({
  value,
  onChange,
  isEditing,
  warnText = "Changing the slug will break existing links.",
  hintText,
}: Props) {
  const [locked, setLocked] = useState(isEditing);

  return (
    <div className="th-field">
      <span className="th-field__label">Slug</span>
      <div className="th-slug-row">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="th-input"
          disabled={locked}
          required
        />
        {isEditing && (
          <button
            type="button"
            className="th-btn th-btn--small"
            onClick={() => setLocked((l) => !l)}
          >
            {locked ? "Unlock" : "Lock"}
          </button>
        )}
      </div>
      {isEditing && !locked && (
        <span className="th-field__hint th-field__hint--warn">{warnText}</span>
      )}
      {isEditing && locked && hintText && (
        <span className="th-field__hint">{hintText}</span>
      )}
    </div>
  );
}
