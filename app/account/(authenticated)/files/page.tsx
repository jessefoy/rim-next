/**
 * /account/files — retired (session 165, strict per-Space filing).
 *
 * The system-wide Finder window was removed: Google Files now live only in a
 * Space's own context (each hub's Files tab + the Community Space), Jesse's
 * anti-"files everywhere" decision. This route stays as a redirect so any old
 * bookmark lands somewhere sensible. The in-app Google Doc reader at
 * /account/files/doc/[id] is unaffected — per-hub Files tabs still route to it.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  redirect("/account/dashboard");
}
