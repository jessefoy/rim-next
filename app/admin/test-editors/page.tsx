"use client";

/**
 * TEMPORARY — Phase 1 verification page. Delete before Phase 3 deploy.
 * Navigate to /admin/test-editors to verify both editors render correctly.
 */

import dynamic from "next/dynamic";

// Load the actual test UI client-only (BlockNote needs window)
const TestEditorsClient = dynamic(() => import("./TestEditorsClient"), { ssr: false });

export default function TestEditorsPage() {
  return <TestEditorsClient />;
}
