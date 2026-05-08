"use client";

/**
 * PrintControls — date range pickers + print button for /tools/schedule/print.
 * Rendered client-side so date inputs are interactive and window.print() is available.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  fromStr: string; // YYYY-MM-DD
  toStr: string;   // YYYY-MM-DD
}

export default function PrintControls({ fromStr, toStr }: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(fromStr);
  const [to, setTo]     = useState(toStr);

  function update() {
    router.push(`/tools/schedule/print?from=${from}&to=${to}`);
  }

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
        <button className="hs-print-controls__btn" onClick={update}>
          Update
        </button>
      </div>

      <button
        className="hs-print-controls__btn hs-print-controls__btn--print"
        onClick={() => window.print()}
      >
        ⎙ Print / Save as PDF
      </button>
    </div>
  );
}
