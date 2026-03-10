import { redirect } from "next/navigation";

// Redirect: Sub Board is now part of the Schedule space
export default function SubsPage() {
  redirect("/account/host/schedule");
}
