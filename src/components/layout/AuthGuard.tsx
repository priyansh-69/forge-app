"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = encodeURIComponent(pathname);
      router.push(`/login?redirectTo=${redirectUrl}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0d10] text-[#f8fafc]">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-[#94a3b8] font-medium tracking-wide">
          Verifying session...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
