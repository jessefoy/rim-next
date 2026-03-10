import { redirect } from "next/navigation";

// Redirect: Program detail is now accessed through the Schedule space
export default async function OldProgramDetailPage() {
  redirect("/account/host/schedule");
}
