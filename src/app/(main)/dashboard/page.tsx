"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// ============================================================
// Dashboard Page — Life metrics overview
// ============================================================

export default function DashboardPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Greeting */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          Good morning 👋
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          What are you forging today?
        </p>
      </div>

      {/* Streak card */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Current Streak
          </p>
          <p className="text-3xl font-bold text-[var(--brand-primary)] mt-1">
            0 <span className="text-lg font-normal text-[var(--text-muted)]">days</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Longest
          </p>
          <p className="text-lg font-semibold text-[var(--text-secondary)] mt-1">
            0 days
          </p>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Check-ins
          </p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">0</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Focus Hours
          </p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">0h</p>
        </Card>
      </div>

      {/* Today's status */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Today&apos;s Check-in
          </h3>
          <Badge variant="default">Not recorded</Badge>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Tap the mic button below to record your 2-minute check-in.
        </p>
      </Card>

      {/* AI Coach placeholder */}
      <Card variant="glass" className="border-[var(--brand-primary)]/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-primary)]">
              FORGE Coach
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Start your first check-in to activate your AI life coach. It adapts
              to your patterns over time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
