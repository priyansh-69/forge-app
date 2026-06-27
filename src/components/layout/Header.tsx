"use client";

import { Badge } from "@/components/ui/Badge";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVaultStore } from "@/stores/useVaultStore";

// ============================================================
// Header — Top bar with page title, sync indicator, and points counter
// Fixed at top. Glassmorphism background.
// ============================================================

interface HeaderProps {
  title: string;
  points?: number;
}

export function Header({ title, points = 0 }: HeaderProps) {
  const pathname = usePathname();
  const { syncStatus, pendingSyncCount } = useVaultStore();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 glass"
      style={{ paddingTop: "var(--safe-top)", height: "calc(var(--header-height) + var(--safe-top))" }}
    >
      <div className="flex items-center justify-between h-[var(--header-height)] px-4 max-w-lg mx-auto">
        {/* Page title */}
        <div className="flex items-center gap-2">
          {title === "FORGE" && (
            <Image src="/forge-logo.png" alt="Forge Logo" width={24} height={24} className="object-contain" />
          )}
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            {title}
          </h1>
        </div>

        {/* Sync & Points */}
        <div className="flex items-center gap-2">
          {/* Mind Palace Shortcut */}
          <Link
            href={pathname === "/palace" ? "/dashboard" : "/palace"}
            className="flex items-center justify-center p-1.5 rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] mr-1"
            title={pathname === "/palace" ? "Back to Dashboard" : "Go to Mind Palace"}
          >
            {pathname === "/palace" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            )}
          </Link>

          {/* Sync indicator */}
          {syncStatus !== "synced" && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border select-none transition-all ${
              syncStatus === "syncing" 
                ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20 animate-pulse" 
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${syncStatus === "syncing" ? "bg-[var(--brand-primary)]" : "bg-amber-500"}`} />
              {syncStatus === "syncing" ? `Syncing (${pendingSyncCount})` : `Offline (${pendingSyncCount})`}
            </div>
          )}
          {syncStatus === "synced" && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border select-none transition-all bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Synced
            </div>
          )}

          {/* Points counter */}
          <Badge variant="points">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="shrink-0"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {points.toLocaleString()}
          </Badge>
        </div>
      </div>
    </header>
  );
}
