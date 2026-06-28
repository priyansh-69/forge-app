"use client";

import { ShieldModeOverlay } from "@/components/features/ShieldModeOverlay";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import GlobalTimerOverlay from "@/components/timer/GlobalTimerOverlay";
import { getLocalEntries, initDB } from "@/lib/indexedDb";
import { useUserStore } from "@/stores/useUserStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// ============================================================
// Main Layout — Protected app shell with Header + BottomNav
// All authenticated pages render inside this layout.
// ============================================================

/** Map route paths to page titles */
const pageTitles: Record<string, string> = {
  "/dashboard": "FORGE",
  "/record": "Check In",
  "/journal": "Journal",
  "/palace": "Mind Palace",
  "/shield": "Shield",
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

  const { initialize, syncQueueWithSupabase } = useVaultStore();

  // Watch network status and initialize local db vault
  useEffect(() => {
    initialize();

    const handleNetworkChange = () => {
      // Re-trigger sync store to update offline state and sync if back online
      syncQueueWithSupabase();
    };

    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);

    // Temporary developer script to clear stuck queue and delete last 3 entries
    const clearStuckQueue = async () => {
      try {
        const db = await initDB();
        
        // 1. Clear the sync queue
        const tx1 = db.transaction("sync_queue", "readwrite");
        await new Promise<void>((resolve, reject) => {
          const req = tx1.objectStore("sync_queue").clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });

        // 2. Delete last 3 entries from local cache
        const local = await getLocalEntries();
        if (local.length > 0) {
          local.sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
          const last3 = local.slice(0, 3);
          
          const tx2 = db.transaction("entries", "readwrite");
          const store = tx2.objectStore("entries");
          last3.forEach(e => {
            store.delete(e.id);
          });
        }

        console.log("Stuck sync queue cleared and last 3 entries deleted locally.");
        
        // Re-initialize store to update the UI badges
        initialize();
      } catch (err) {
        console.error("Failed to clear stuck queue:", err);
      }
    };

    clearStuckQueue();

    return () => {
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
    };
  }, [initialize, syncQueueWithSupabase]);

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
        <GlobalTimerOverlay />
        <ShieldModeOverlay />
      </div>
    </AuthGuard>
  );
}

