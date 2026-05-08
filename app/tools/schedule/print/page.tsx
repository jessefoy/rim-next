/**
 * /tools/schedule/print — Date-range picker for PDF export.
 *
 * Hands off to /api/host/schedule/pdf which streams a real PDF document
 * (rendered with @react-pdf/renderer). Default range: today through end
 * of next month.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PrintControls from "./PrintControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print My Schedule — Tools" };

const TZ = "America/Chicago";

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    timeZone: TZ, month: "long", day: "numeric", year: "numeric",
  });
}

export default async function PrintPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Defaults: today → end of next month (CT)
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const fromDate = new Date(now);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr   = toDate.toISOString().slice(0, 10);

  return (
    <div className="hs-print-page">
      <div className="hs-print-header">
        <p className="hs-print-header__title">Print My Schedule</p>
        <p className="hs-print-header__range">
          Generates a PDF of your assigned sessions and standing rotations.
          Default range: {fmtDateLong(fromDate)} – {fmtDateLong(toDate)}.
        </p>
      </div>

      <PrintControls fromStr={fromStr} toStr={toStr} />
    </div>
  );
}
