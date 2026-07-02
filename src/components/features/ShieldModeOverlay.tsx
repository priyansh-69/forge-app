"use client";

import { useState, useEffect, useRef } from "react";
import { useTimerStore } from "@/stores/useTimerStore";
import { useUserStore } from "@/stores/useUserStore";
import { getLocalEntries } from "@/lib/indexedDb";
import { computeBurnoutIndex } from "@/lib/burnout";
import { BreathingExercise } from "./BreathingExercise";

interface Driver {
  key: string;
  name: string;
  raw: number;
  weighted: number;
  explanation: string;
}

export function ShieldModeOverlay() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [topDriver, setTopDriver] = useState<Driver | null>(null);
  const [breathingOpen, setBreathingOpen] = useState(false);

  const stats = useTimerStore((state) => state.stats);
  const hasHydrated = useTimerStore((state) => state.hasHydrated);
  const profile = useUserStore((state) => state.profile);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || hasCheckedRef.current) return;

    // Check if dismissed within past 6 hours
    if (typeof window !== "undefined") {
      const lastDismissed = localStorage.getItem("shield_dismissed_at");
      if (lastDismissed) {
        const elapsed = Date.now() - Number(lastDismissed);
        if (elapsed < 6 * 60 * 60 * 1000) {
          return; // Still in cooldown
        }
      }
    }

    hasCheckedRef.current = true;

    const checkBurnoutLevel = async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentStats = stats.filter((s) => new Date(s.date) >= sevenDaysAgo);
      const completedSessions = recentStats.filter((s) => s.completed && s.mode === "focus").length;
      const attemptedSessions = recentStats.filter((s) => s.mode === "focus").length;

      const runLocalCheck = async () => {
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

          if (localResult.burnoutIndex && localResult.burnoutIndex >= 85) {
            setShowOverlay(true);
            if (localResult.drivers && localResult.drivers.length > 0) {
              setTopDriver(localResult.drivers[0]);
            }
          }
        } catch (err) {
          console.error("Local critical burnout check failed:", err);
        }
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await runLocalCheck();
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
          const data = await res.json();
          if (data.burnoutIndex && data.burnoutIndex >= 85) {
            setShowOverlay(true);
            if (data.drivers && data.drivers.length > 0) {
              setTopDriver(data.drivers[0]);
            }
          }
        } else {
          await runLocalCheck();
        }
      } catch (err) {
        console.warn("Failed to check burnout level via API, running local check:", err);
        await runLocalCheck();
      }
    };

    checkBurnoutLevel();
  }, [hasHydrated, stats, profile]);

  // Handle local simulation trigger from dev switch
  useEffect(() => {
    const handleSimulate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.simulate) {
        setTopDriver({
          key: "toneDecline",
          name: "Declining Mood (Mocked)",
          raw: 85,
          weighted: 21,
          explanation: "Simulated high stress state trigger for testing overlay."
        });
        setShowOverlay(true);
      }
    };

    window.addEventListener("forge-simulate-burnout", handleSimulate);
    return () => window.removeEventListener("forge-simulate-burnout", handleSimulate);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("shield_dismissed_at", String(Date.now()));
    setShowOverlay(false);
  };

  if (!showOverlay) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#0c0c16]/95 backdrop-blur-md animate-fade-in select-none">
        <div className="bg-[var(--bg-secondary)] border border-[#ef4444]/30 rounded-[var(--radius-lg)] p-6 max-w-sm w-full space-y-6 shadow-2xl text-center">
          <div className="space-y-3">
            {/* Pulsing warning shield */}
            <div className="flex justify-center">
              <div className="relative flex items-center justify-center h-20 w-20">
                <div className="absolute inset-0 rounded-full bg-[#ef4444]/10 animate-ping" />
                <div className="relative h-16 w-16 rounded-full bg-[#ef4444]/20 border border-[#ef4444]/40 flex items-center justify-center text-3xl">
                  🛡️
                </div>
              </div>
            </div>

            <h2 className="text-lg font-bold text-[#ef4444]">Burnout Shield Activated</h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Your overall burnout index is critical. Behavioral patterns show you are at immediate risk of fatigue.
            </p>
          </div>

          {topDriver && (
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.06)] border border-[#ef4444]/10 text-left">
              <p className="text-xs font-bold text-[#ef4444]">{topDriver.name}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                {topDriver.explanation}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => setBreathingOpen(true)}
              className="w-full py-2.5 text-xs font-semibold rounded-[var(--radius-md)] bg-[#ef4444] text-[var(--bg-primary)] hover:opacity-90 transition-all cursor-pointer"
            >
              Start Breathing Reset
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-transparent hover:bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border border-[var(--border-default)] cursor-pointer"
            >
              Dismiss (Cooldown 6 Hours)
            </button>
          </div>
        </div>
      </div>

      <BreathingExercise
        isOpen={breathingOpen}
        onClose={() => {
          setBreathingOpen(false);
          setShowOverlay(false);
        }}
      />
    </>
  );
}
