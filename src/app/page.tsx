import { redirect } from "next/navigation";

// ============================================================
// Root Page — Redirects to dashboard
// ============================================================

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RootPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const code = resolvedParams?.code;
  const next = resolvedParams?.next;

  if (code && typeof code === 'string') {
    let callbackUrl = `/auth/callback?code=${code}`;
    if (next && typeof next === 'string') {
      callbackUrl += `&next=${encodeURIComponent(next)}`;
    }
    redirect(callbackUrl);
  }

  redirect("/dashboard");
}
