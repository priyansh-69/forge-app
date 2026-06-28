"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/stores/useUserStore";
import { useTimerStore } from "@/stores/useTimerStore";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { BurnoutShieldCard } from "@/components/features/BurnoutShieldCard";
import { getLocalEntries, addToSyncQueue } from "@/lib/indexedDb";
import { generateUUID } from "@/lib/uuid";

// ============================================================
// Dashboard Page — Life metrics overview (Bug #5: Wired to real data)
// ============================================================

interface Habit {
  id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
}

const supabase = createClient();

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil 🌙";
  if (hour < 12) return "Good morning 👋";
  if (hour < 17) return "Good afternoon ☀️";
  if (hour < 21) return "Good evening 🌆";
  return "Night owl mode 🦉";
}

function generateTempId(): string {
  return generateUUID();
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useUserStore();
  const { stats, hasHydrated } = useTimerStore();
  const [todayCheckinCount, setTodayCheckinCount] = useState(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // Habits State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);

  // Calculate focus hours from timer stats
  const focusHours = hasHydrated
    ? stats
        .filter((s) => s.completed && (s.mode === "focus" || s.mode === "custom"))
        .reduce((acc, s) => acc + s.duration, 0) / 3600
    : 0;

  // Fetch today's check-in count from Supabase (with offline fallback)
  const fetchTodayCheckins = useCallback(async () => {
    if (!user) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const local = await getLocalEntries();
        const activeLocal = local.filter((e) => !e.deleted_at);
        const count = activeLocal.filter(
          (e) => new Date(e.created_at || e.createdAt) >= todayStart
        ).length;
        setTodayCheckinCount(count);
        setHasCheckedInToday(count > 0);
        return;
      }

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

  // Fetch all user habits and today's completions (with offline fallback)
  const fetchHabitsData = useCallback(async () => {
    if (!user) return;
    try {
      setHabitsLoading(true);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Load from localStorage cache
        if (typeof window !== "undefined") {
          const cachedHabits = localStorage.getItem(`forge_habits_${user.id}`);
          const cachedLogs = localStorage.getItem(`forge_habit_logs_${user.id}`);
          if (cachedHabits) setHabits(JSON.parse(cachedHabits));
          if (cachedLogs) setHabitLogs(JSON.parse(cachedLogs));
        }
        return;
      }

      const [habitsRes, logsRes] = await Promise.all([
        supabase
          .from("habits")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("habit_logs")
          .select("*")
          .eq("user_id", user.id)
          .gte("completed_at", todayStart.toISOString()),
      ]);

      if (habitsRes.error) throw habitsRes.error;
      if (logsRes.error) throw logsRes.error;

      const habitsData = habitsRes.data || [];
      const logsData = logsRes.data || [];

      setHabits(habitsData);
      setHabitLogs(logsData);

      // Save to localStorage cache
      if (typeof window !== "undefined") {
        localStorage.setItem(`forge_habits_${user.id}`, JSON.stringify(habitsData));
        localStorage.setItem(`forge_habit_logs_${user.id}`, JSON.stringify(logsData));
      }
    } catch (err) {
      console.error("Error fetching habits data:", err);
      toast.error("Failed to load habits.");
    } finally {
      setHabitsLoading(false);
    }
  }, [user]);

  // Toggle habit log completion (optimistic update with offline support)
  const handleToggleHabit = async (habitId: string, habitName: string) => {
    if (!user) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingLog = habitLogs.find(
      (log) => log.habit_id === habitId && new Date(log.completed_at) >= todayStart
    );

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (existingLog) {
      // Optimistic delete
      const updatedLogs = habitLogs.filter((log) => log.id !== existingLog.id);
      setHabitLogs(updatedLogs);
      if (typeof window !== "undefined") {
        localStorage.setItem(`forge_habit_logs_${user.id}`, JSON.stringify(updatedLogs));
      }

      if (isOffline) {
        await addToSyncQueue("delete", "habit_logs", existingLog.id, null);
        toast.info(`Offline: Habit "${habitName}" unchecked locally.`);
        return;
      }

      try {
        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("id", existingLog.id);

        if (error) throw error;
        toast.info(`Habit "${habitName}" unchecked.`);
      } catch (err) {
        console.error("Error deleting habit log:", err);
        // Revert on error
        setHabitLogs((prev) => {
          const reverted = [...prev, existingLog];
          if (typeof window !== "undefined") {
            localStorage.setItem(`forge_habit_logs_${user.id}`, JSON.stringify(reverted));
          }
          return reverted;
        });
        toast.error("Failed to update habit log.");
      }
    } else {
      // Optimistic insert
      const tempId = generateTempId();
      const tempLog: HabitLog = {
        id: tempId,
        habit_id: habitId,
        user_id: user.id,
        completed_at: new Date().toISOString(),
      };
      const updatedLogs = [...habitLogs, tempLog];
      setHabitLogs(updatedLogs);
      if (typeof window !== "undefined") {
        localStorage.setItem(`forge_habit_logs_${user.id}`, JSON.stringify(updatedLogs));
      }

      if (isOffline) {
        await addToSyncQueue("insert", "habit_logs", tempId, {
          habit_id: habitId,
          user_id: user.id,
          completed_at: tempLog.completed_at,
        });
        toast.success(`Offline: Habit "${habitName}" checked off locally!`);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("habit_logs")
          .insert({
            habit_id: habitId,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        // Update with real db log object
        setHabitLogs((prev) => {
          const finalLogs = prev.map((log) => (log.id === tempId ? data : log));
          if (typeof window !== "undefined") {
            localStorage.setItem(`forge_habit_logs_${user.id}`, JSON.stringify(finalLogs));
          }
          return finalLogs;
        });
        toast.success(`Habit "${habitName}" checked off!`);
      } catch (err) {
        console.error("Error inserting habit log:", err);
        // Revert on error
        setHabitLogs((prev) => {
          const reverted = prev.filter((log) => log.id !== tempId);
          if (typeof window !== "undefined") {
            localStorage.setItem(`forge_habit_logs_${user.id}`, JSON.stringify(reverted));
          }
          return reverted;
        });
        toast.error("Failed to complete habit.");
      }
    }
  };

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchTodayCheckins();
        fetchHabitsData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, fetchTodayCheckins, fetchHabitsData]);

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

      {/* Burnout Shield */}
      <BurnoutShieldCard />

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

      {/* Daily Habits Checklist */}
      <Card variant="glass" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Daily Habits
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Complete your daily routines
            </p>
          </div>
          <button
            onClick={() => router.push("/habits")}
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer"
          >
            Manage
          </button>
        </div>

        {habitsLoading ? (
          <div className="text-center text-xs text-[var(--text-muted)] py-4">
            Loading habits...
          </div>
        ) : habits.length === 0 ? (
          <div className="text-center text-xs text-[var(--text-muted)] py-4 space-y-2">
            <p>No habits configured yet.</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push("/habits")}
              className="cursor-pointer"
            >
              Set up habits
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const isCompleted = habitLogs.some(
                (log) => log.habit_id === habit.id && new Date(log.completed_at) >= todayStart
              );

              return (
                <div
                  key={habit.id}
                  onClick={() => handleToggleHabit(habit.id, habit.name)}
                  className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.01)] border border-[var(--border-default)] hover:border-[var(--brand-primary)]/40 transition-all cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{habit.icon || "🌟"}</span>
                    <span className={`text-sm font-medium transition-all duration-200 ${
                      isCompleted ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"
                    }`}>
                      {habit.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all duration-200 shrink-0 ${
                      isCompleted
                        ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-[var(--bg-primary)]"
                        : "border-[var(--border-default)] hover:border-[var(--brand-primary)]"
                    }`}
                    aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {isCompleted && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
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

