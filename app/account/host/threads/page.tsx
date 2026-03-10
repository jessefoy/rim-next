import { redirect } from "next/navigation";

// Redirect: Threads are now Conversations
export default function ThreadsPage() {
  redirect("/account/host/conversations");
}
