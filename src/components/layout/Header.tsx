"use client";

import { Badge } from "@/components/ui/Badge";

// ============================================================
// Header — Top bar with page title and points counter
// Fixed at top. Glassmorphism background.
// ============================================================

interface HeaderProps {
  title: string;
  points?: number;
}

export function Header({ title, points = 0 }: HeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 glass"
      style={{ paddingTop: "var(--safe-top)", height: "calc(var(--header-height) + var(--safe-top))" }}
    >
      <div className="flex items-center justify-between h-[var(--header-height)] px-4 max-w-lg mx-auto">
        {/* Page title */}
        <div className="flex items-center gap-2">
          {title === "FORGE" && (
            <img src="/forge-logo.png" alt="Forge Logo" className="w-6 h-6 object-contain" />
          )}
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            {title}
          </h1>
        </div>

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
    </header>
  );
}
