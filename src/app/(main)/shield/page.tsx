"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTimerStore } from "@/stores/useTimerStore";
import { useUserStore } from "@/stores/useUserStore";
import { getLocalEntries } from "@/lib/indexedDb";
import { computeBurnoutIndex } from "@/lib/burnout";
import { BreathingExercise } from "@/components/features/BreathingExercise";
import { GratitudePrompt } from "@/components/features/GratitudePrompt";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface Driver {
  key: string;
  name: string;
  raw: number;
  weighted: number;
  explanation: string;
}

interface Intervention {
  driverKey: string;
  title: string;
  description: string;
  actionType: "navigate" | "component" | "toast";
  target: string;
  icon: string;
}

interface BurnoutResponse {
  success: boolean;
  burnoutIndex: number | null;
  riskLevel: "low" | "medium" | "high" | "critical" | "insufficient_data";
  drivers: Driver[];
  interventions: Intervention[];
  trendData: Array<{ date: string; index: number }>;
}

export default function ShieldPage() {
  const router = useRouter();
  const [data, setData] = useState<BurnoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Intervention modal states
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [gratitudeOpen, setGratitudeOpen] = useState(false);

  const stats = useTimerStore((state) => state.stats);
  const hasHydrated = useTimerStore((state) => state.hasHydrated);
  const profile = useUserStore((state) => state.profile);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchBurnoutData = async () => {
    try {
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
          setIsOfflineMode(true);
        } catch (err) {
          console.error("Local burnout calculation failed:", err);
        }
      };

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
          setIsOfflineMode(false);
        } else {
          await runLocalCalculation();
        }
      } catch (err) {
        console.warn("Failed to fetch burnout index from API, falling back to local calculation:", err);
        await runLocalCalculation();
      }
    } catch (err) {
      console.error("Failed to fetch burnout full data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHydrated) {
      fetchBurnoutData();
    }
  }, [hasHydrated, stats, profile]);

  const handleIntervention = (item: Intervention) => {
    if (item.actionType === "navigate") {
      router.push(item.target);
    } else if (item.actionType === "component") {
      if (item.target === "BreathingExercise") {
        setBreathingOpen(true);
      } else if (item.target === "GratitudePrompt") {
        setGratitudeOpen(true);
      }
    } else if (item.actionType === "toast") {
      toast.success(item.description, { duration: 5000 });
    }
  };

  const handleSimulateBurnout = () => {
    // Fire the custom event to trigger the global overlay alert
    window.dispatchEvent(
      new CustomEvent("forge-simulate-burnout", { detail: { simulate: true } })
    );

    // Mock high score data in the UI immediately
    setData({
      success: true,
      burnoutIndex: 92,
      riskLevel: "critical",
      drivers: [
        {
          key: "toneDecline",
          name: "Declining Mood (Mocked)",
          raw: 85,
          weighted: 21.25,
          explanation: "Your 7-day mood average has dropped by 34% compared to baseline."
        },
        {
          key: "energyDecline",
          name: "Energy Drain (Mocked)",
          raw: 75,
          weighted: 15,
          explanation: "Daily checked energy levels show extreme exhaustion markers."
        }
      ],
      interventions: [
        {
          driverKey: "toneDecline",
          title: "2-Minute CBT Reframe",
          description: "Reflect on and reframe one negative thought from today to relieve mood drop.",
          actionType: "navigate",
          target: "/record",
          icon: "🧠",
        },
        {
          driverKey: "energyDecline",
          title: "Box Breathing Reset",
          description: "Perform guided box breathing to recover autonomic nervous system energy.",
          actionType: "component",
          target: "BreathingExercise",
          icon: "🌬️",
        }
      ],
      trendData: [
        { date: "Day 1", index: 32 },
        { date: "Day 2", index: 45 },
        { date: "Day 3", index: 58 },
        { date: "Day 4", index: 61 },
        { date: "Day 5", index: 76 },
        { date: "Day 6", index: 82 },
        { date: "Day 7", index: 92 },
      ]
    });
    toast.warning("Demonstration Mode: Critical Burnout State simulated (92%).");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent" />
        <span className="text-xs text-[var(--text-secondary)] font-semibold">Running diagnostics check...</span>
      </div>
    );
  }

  if (!data || data.riskLevel === "insufficient_data") {
    return (
      <div className="space-y-6 max-w-md mx-auto py-6">
        <Card variant="glass" className="text-center p-8 space-y-4 bg-[rgba(30,41,59,0.15)] border-[rgba(255,255,255,0.05)]">
          <span className="text-4xl block">🛡️</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Shield Status: Inactive {isOfflineMode && <span className="text-xs font-normal text-[var(--text-muted)]">(Offline)</span>}
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
            Your early-warning Burnout Shield requires at least 3 daily check-in logs to establish a baseline of emotional tone, dominant mood, and energy factors. Keep forging!
          </p>
          <Button size="sm" onClick={() => router.push("/record")} className="w-full">
            Log Check-in
          </Button>
        </Card>
      </div>
    );
  }

  const { burnoutIndex = 0, riskLevel, drivers, interventions, trendData } = data;
  const indexVal = burnoutIndex || 0;

  const riskStyles = {
    low: { bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", ring: "#10b981", badge: "points" as const, text: "Low Stress" },
    medium: { bg: "bg-amber-500/10 border-amber-500/20 text-amber-400", ring: "#f59e0b", badge: "nudge" as const, text: "Elevated" },
    high: { bg: "bg-orange-500/10 border-orange-500/20 text-orange-400", ring: "#f97316", badge: "truth" as const, text: "High Risk" },
    critical: { bg: "bg-red-500/10 border-red-500/20 text-red-400", ring: "#ef4444", badge: "default" as const, text: "CRITICAL RISK" },
    insufficient_data: { bg: "bg-slate-500/10 border-slate-500/20 text-slate-400", ring: "#6b7280", badge: "default" as const, text: "Insufficient Data" },
  };

  const currentRisk = riskStyles[riskLevel];

  // Circle parameters
  const radius = 56;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (indexVal / 100) * circumference;

  return (
    <div className="space-y-6 max-w-md mx-auto pb-10 select-none">
      {/* Header section with offline indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Burnout Shield</h2>
        {isOfflineMode && (
          <Badge variant="nudge" className="animate-pulse">Offline Mode</Badge>
        )}
      </div>

      {/* Dial Visualizer */}
      <Card variant="glass" className="flex flex-col items-center p-6 bg-[rgba(30,41,59,0.15)] border-[rgba(255,255,255,0.05)]">
        <div className="relative h-36 w-36 flex items-center justify-center">
          <svg className="transform -rotate-90 w-36 h-36">
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke={currentRisk.ring}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute text-center space-y-0.5">
            <span className="text-3xl font-extrabold text-[var(--text-primary)]">
              {indexVal}%
            </span>
            <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] block tracking-wider">
              Stress index
            </span>
          </div>
        </div>

        <div className={`mt-4 px-3 py-1 rounded-full border text-xs font-semibold ${currentRisk.bg}`}>
          {currentRisk.text}
        </div>
      </Card>

      {/* Recharts Trend Line Graph */}
      {mounted && trendData.length > 0 && (
        <Card className="space-y-3 bg-[rgba(30,41,59,0.15)] border-[rgba(255,255,255,0.05)]">
          <h3 className="text-xs uppercase font-bold tracking-wider text-[var(--text-secondary)]">
            7-Day Stress Trend
          </h3>
          <div className="h-40 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="index"
                  stroke={currentRisk.ring}
                  strokeWidth={3}
                  dot={{ r: 4, stroke: currentRisk.ring, strokeWidth: 2, fill: "#0c0c16" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Driver cards */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[var(--text-secondary)]">
          Top Stress Drivers
        </h3>
        {drivers.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            No active stress drivers detected. All metrics are healthy!
          </p>
        ) : (
          drivers.map((driver) => (
            <Card key={driver.key} className="p-4 bg-[rgba(30,41,59,0.15)] border-[rgba(255,255,255,0.05)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {driver.name}
                </span>
                <span className="text-xs font-semibold text-[#ef4444]">
                  +{Math.round(driver.weighted)}% impact
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {driver.explanation}
              </p>
            </Card>
          ))
        )}
      </div>

      {/* Active Interventions */}
      {interventions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs uppercase font-bold tracking-wider text-[var(--text-secondary)]">
            Suggested Interventions
          </h3>
          <div className="space-y-2">
            {interventions.map((item) => (
              <div
                key={item.driverKey}
                onClick={() => handleIntervention(item)}
                className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] hover:border-[var(--brand-primary)]/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5 max-w-[280px]">
                      {item.description}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-[var(--text-muted)] select-none">➔</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hackathon Simulation Mode */}
      <div className="pt-6 border-t border-[rgba(255,255,255,0.05)] text-center space-y-2">
        <p className="text-[10px] text-[var(--text-muted)]">
          Demo Option: Simulate how the application alerts users in high-risk critical states.
        </p>
        <button
          onClick={handleSimulateBurnout}
          className="text-xs font-semibold text-[#ef4444]/80 hover:text-[#ef4444] border border-[#ef4444]/20 hover:border-[#ef4444]/40 bg-transparent rounded-[var(--radius-md)] px-4 py-2 cursor-pointer transition-all"
        >
          🚨 Simulate Critical Burnout (92%)
        </button>
      </div>

      {/* Modal Components */}
      <BreathingExercise isOpen={breathingOpen} onClose={() => setBreathingOpen(false)} />
      <GratitudePrompt isOpen={gratitudeOpen} onClose={() => setGratitudeOpen(false)} />
    </div>
  );
}
