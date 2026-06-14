import { redirect } from "next/navigation";

// ============================================================
// Root Page — Redirects to dashboard
// ============================================================

export default function RootPage() {
  redirect("/dashboard");
}
