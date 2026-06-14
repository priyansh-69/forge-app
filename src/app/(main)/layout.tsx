"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { useUserStore } from "@/stores/useUserStore";

// ============================================================
// Main Layout — Protected app shell with Header + BottomNav
// All authenticated pages render inside this layout.
// ============================================================

/** Map route paths to page titles */
const pageTitles: Record<string, string> = {
  "/dashboard": "FORGE",
  "/record": "Check In",
  "/journal": "Journal",
  "/timer": "Focus",
  "/settings": "Settings",
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "FORGE";
  const { profile } = useUserStore();
  const points = profile?.totalPoints || 0;

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen">
        <Header title={title} points={points} />

        {/* Main content area — padded to account for fixed header & nav */}
        <main
          className="flex-1 w-full max-w-lg mx-auto px-4"
          style={{
            paddingTop: "calc(var(--header-height) + var(--safe-top) + 16px)",
            paddingBottom: "calc(var(--nav-height) + var(--safe-bottom) + 16px)",
          }}
        >
          {children}
        </main>

        <BottomNav />
      </div>
    </AuthGuard>
  );
}
