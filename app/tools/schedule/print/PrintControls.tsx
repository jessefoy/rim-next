"use client";

/**
 * PrintControls — date range pickers + "Download PDF" button.
 * Opens /api/host/schedule/pdf?from=&to= in a new tab; the browser
 * shows the PDF inline (with a Save button) or downloads it directly.
 */

import { useState } from "react";

interface Props {
  fromStr: string; // YYYY-MM-DD
  toStr: string;   // YYYY-MM-DD
}

export default function PrintControls({ fromStr, toStr }: Props) {
  const [from, setFrom] = useState(fromStr);
  const [to, setTo]     = useState(toStr);

  const pdfUrl = `/api/host/schedule/pdf?from=${from}&to=${to}`;

  return (
    <div className="hs-print-controls">
      <a href="/tools/schedule" className="hs-print-controls__back">
        ← Back to schedule
      </a>

      <div className="hs-print-controls__fields">
        <div className="hs-print-controls__group">
          <label className="hs-print-controls__label" htmlFor="pc-from">From</label>
          <input
            id="pc-from"
            type="date"
            className="hs-print-controls__input"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </div>
        <div className="hs-print-controls__group">
          <label className="hs-print-controls__label" htmlFor="pc-to">To</label>
          <input
            id="pc-to"
            type="date"
            className="hs-print-controls__input"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>
      </div>

      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hs-print-controls__btn"
      >
        Download PDF
      </a>
    </div>
  );
}
