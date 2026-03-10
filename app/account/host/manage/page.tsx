import { redirect } from "next/navigation";

// The Manage tab has been removed. Session management now happens
// directly from the Schedule calendar. Redirect anyone who lands here.
export default function ManagePage() {
  redirect("/account/host/schedule");
}
