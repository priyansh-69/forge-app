"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useTimerStore } from "@/stores/useTimerStore";
import { useUserStore } from "@/stores/useUserStore";
import { getLocalEntries } from "@/lib/indexedDb";
import { computeBurnoutIndex } from "@/lib/burnout";

interface Driver {
  key: string;
  name: string;
  raw: number;
  weighted: number;
  explanation: string;
}

interface BurnoutResponse {
  success: boolean;
  burnoutIndex: number | null;
  riskLevel: "low" | "medium" | "high" | "critical" | "insufficient_data";
  drivers: Driver[];
}

export function BurnoutShieldCard() {
  const router = useRouter();
  const [data, setData] = useState<BurnoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const stats = useTimerStore((state) => state.stats);
  const hasHydrated = useTimerStore((state) => state.hasHydrated);
  const profile = useUserStore((state) => state.profile);

  useEffect(() => {
    if (!hasHydrated) return;

    const fetchBurnout = async () => {
      // Pre-compute focus stats for the last 7 days from Zustand
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentStats = stats.filter((s) => new Date(s.date) >= sevenDaysAgo);
      const completedSessions = recentStats.filter((s) => s.completed && s.mode === "focus").length;
      const attemptedSessions = recentStats.filter((s) => s.mode === "focus").length;

      const runLocalCalculation = async () => {
        try {
          const localEntries = await getLocalEntries();
          const activeEntries = localEntries.filter((e: any) => !e.deleted_at);
          const currentStreak = profile?.currentStreak || 0;

          const localResult = computeBurnoutIndex({
            entries: activeEntries,
            currentStreak,
            focusStats: {
              completedSessions,
              attemptedSessions,
            },
            tzOffset: new Date().getTimezoneOffset(),
          });

          setData(localResult);
          setIsOffline(true);
        } catch (err) {
          console.error("Local burnout calculation failed:", err);
        }
      };

      // If offline, compute locally immediately
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await runLocalCalculation();
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/burnout-index", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tzOffset: new Date().getTimezoneOffset(),
            focusStats: {
              completedSessions,
              attemptedSessions,
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          setData(json);
          setIsOffline(false);
        } else {
          // Fallback if API returns non-200
          await runLocalCalculation();
        }
      } catch (err) {
        console.warn("Failed to fetch burnout index from API, falling back to local calculation:", err);
        await runLocalCalculation();
      } finally {
        setLoading(false);
      }
    };

    fetchBurnout();
  }, [hasHydrated, stats.length, profile]);

  if (loading) {
    return (
      <Card className="flex items-center justify-center p-6 h-[110px]">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent" />
          <span className="text-xs text-[var(--text-secondary)]">Analyzing burnout shield...</span>
        </div>
      </Card>
    );
  }

  if (!data || data.riskLevel === "insufficient_data") {
    return (
      <Card variant="glass" className="p-4 flex items-center justify-between border-[rgba(255,255,255,0.05)] bg-[rgba(30,41,59,0.15)]">
        <div className="space-y-1 pr-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            🛡️ Shield Status
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Log at least 3 check-ins to activate your early-warning Burnout Shield.
          </p>
        </div>
        <Badge variant="default" className="shrink-0">Warming up</Badge>
      </Card>
    );
  }

  const { burnoutIndex = 0, riskLevel, drivers } = data;
  const indexVal = burnoutIndex || 0;

  // Visual Colors matching riskLevel
  const riskColorMap = {
    low: { stroke: "#10b981", badge: "points" as const, text: "Healthy" },
    medium: { stroke: "#f59e0b", badge: "nudge" as const, text: "Elevated" },
    high: { stroke: "#f97316", badge: "truth" as const, text: "High Risk" },
    critical: { stroke: "#ef4444", badge: "default" as const, text: "CRITICAL" },
    insufficient_data: { stroke: "#6b7280", badge: "default" as const, text: "Warming up" },
  };

  const currentRisk = riskColorMap[riskLevel];

  // SVG Circle Parameters
  const radius = 28;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (indexVal / 100) * circumference;

  const topDriver = drivers.length > 0 ? drivers[0].name : "All metrics within parameters";

  return (
    <Card
      onClick={() => router.push("/shield")}
      className="flex items-center justify-between p-4 cursor-pointer hover:border-[var(--brand-primary)]/40 transition-all duration-200 bg-[rgba(30,41,59,0.15)] border-[rgba(255,255,255,0.05)] select-none group"
    >
      <div className="space-y-1.5 flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            🛡️ Burnout Shield {isOffline && <span className="text-[10px] text-[var(--text-muted)] font-normal">(Offline)</span>}
          </span>
          <Badge variant={currentRisk.badge}>
            {currentRisk.text}
          </Badge>
        </div>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {riskLevel === "low"
            ? "Your behavioral metrics indicate low stress levels."
            : `Primary driver: ${topDriver}`}
        </p>
      </div>

      {/* Circle dial */}
      <div className="relative h-16 w-16 flex items-center justify-center shrink-0">
        <svg className="transform -rotate-90 w-16 h-16">
          {/* Background circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={currentRisk.stroke}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute text-xs font-bold text-[var(--text-primary)]">
          {indexVal}%
        </span>
      </div>
    </Card>
  );
}
