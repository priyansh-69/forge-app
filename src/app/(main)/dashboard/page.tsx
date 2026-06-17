"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useUserStore } from "@/stores/useUserStore";
import { useTimerStore } from "@/stores/useTimerStore";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// Dashboard Page — Life metrics overview (Bug #5: Wired to real data)
// ============================================================

const supabase = createClient();

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil 🌙";
  if (hour < 12) return "Good morning 👋";
  if (hour < 17) return "Good afternoon ☀️";
  if (hour < 21) return "Good evening 🌆";
  return "Night owl mode 🦉";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useUserStore();
  const { stats, hasHydrated } = useTimerStore();
  const [todayCheckinCount, setTodayCheckinCount] = useState(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // Calculate focus hours from timer stats
  const focusHours = hasHydrated
    ? stats
        .filter((s) => s.completed && (s.mode === "focus" || s.mode === "custom"))
        .reduce((acc, s) => acc + s.duration, 0) / 3600
    : 0;

  // Fetch today's check-in count from Supabase
  const fetchTodayCheckins = useCallback(async () => {
    if (!user) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("entries")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString())
        .is("deleted_at", null);

      if (error) throw error;
      const count = data?.length || 0;
      setTodayCheckinCount(count);
      setHasCheckedInToday(count > 0);
    } catch (err) {
      console.error("Error fetching today's check-ins:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTodayCheckins();
    }
  }, [user, fetchTodayCheckins]);

  const currentStreak = profile?.currentStreak || 0;
  const longestStreak = profile?.longestStreak || 0;

  // Dynamic coach message based on streak and check-in status
  const getCoachMessage = () => {
    if (!hasCheckedInToday && currentStreak > 0) {
      return `You're on a ${currentStreak}-day streak! Don't forget to check in today to keep it going.`;
    }
    if (hasCheckedInToday && currentStreak >= 3) {
      return `${currentStreak}-day streak and counting! You're building serious momentum. Keep forging.`;
    }
    if (hasCheckedInToday) {
      return "Great work checking in today. Consistency is how you forge a better life.";
    }
    return "Start your first check-in to activate your AI life coach. It adapts to your patterns over time.";
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Greeting */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          {getGreeting()}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {profile?.displayName ? `Welcome back, ${profile.displayName}.` : "What are you forging today?"}
        </p>
      </div>

      {/* Streak card */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Current Streak
          </p>
          <p className="text-3xl font-bold text-[var(--brand-primary)] mt-1">
            {currentStreak} <span className="text-lg font-normal text-[var(--text-muted)]">days</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Longest
          </p>
          <p className="text-lg font-semibold text-[var(--text-secondary)] mt-1">
            {longestStreak} days
          </p>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Check-ins
          </p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{todayCheckinCount}</p>
          <p className="text-[10px] text-[var(--text-muted)]">today</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Focus Hours
          </p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {focusHours < 1 ? `${Math.round(focusHours * 60)}m` : `${focusHours.toFixed(1)}h`}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">all time</p>
        </Card>
      </div>

      {/* Today's status */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Today&apos;s Check-in
          </h3>
          <Badge variant={hasCheckedInToday ? "points" : "default"}>
            {hasCheckedInToday ? "✓ Recorded" : "Not recorded"}
          </Badge>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {hasCheckedInToday
            ? "You've checked in today. Great job staying consistent!"
            : "Tap the mic button below to record your 2-minute check-in."}
        </p>
      </Card>

      {/* AI Coach */}
      <Card variant="glass" className="border-[var(--brand-primary)]/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-primary)]">
              FORGE Coach
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {getCoachMessage()}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

