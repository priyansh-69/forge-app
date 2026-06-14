"use client";

import { Card } from "@/components/ui/Card";

// ============================================================
// Journal Page — Timeline of past check-in entries
// ============================================================

export default function JournalPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Your Journal
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          A timeline of every check-in and AI coaching response.
        </p>
      </div>

      {/* Empty state */}
      <Card className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">📖</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          No entries yet
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[220px]">
          Your journal entries will appear here after your first check-in.
        </p>
      </Card>
    </div>
  );
}
