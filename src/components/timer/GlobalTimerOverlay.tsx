"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTimerStore, MODE_CONFIG } from "@/stores/useTimerStore";
import { useUserStore } from "@/stores/useUserStore";
import { createClient } from "@/lib/supabase/client";
import { POINTS } from "@/lib/constants";
import { formatTimer } from "@/lib/utils";

// ============================================================
// Web Audio API Synthesis Utilities
// ============================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Play a short, high-pitched tick sound (for the last 10 seconds). */
export function playTick(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch {
    // Silently swallow — audio is non-critical
  }
}

/** Play a pleasant ascending chime (C5→E5→G5→C6) on session completion. */
export function playAlarm(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.12);
      gain.gain.setValueAtTime(0.12, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);

      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.4);
    });
  } catch {
    // Silently swallow — audio is non-critical
  }
}

// ============================================================
// Global Timer Overlay Component
// ============================================================

export default function GlobalTimerOverlay() {
  const router = useRouter();
  const pathname = usePathname();

  // Supabase client is stable per browser tab — create once via ref
  const supabaseRef = useRef(createClient());

  const [mounted, setMounted] = useState(false);

  const { user, profile, setProfile } = useUserStore();
  const {
    mode,
    timeLeft,
    sessionDuration,
    isActive,
    tick,
    toggleTimer,
    resetTimer,
    addStatsEntry,
    setMode,
    hydrate,
  } = useTimerStore();

  const lastPlayedTickRef = useRef<number | null>(null);

  // 1. Mount & Hydrate
  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  // 2. Focus Session Completion Handler
  const handleComplete = useCallback(async () => {
    playAlarm();

    const isFocusOrCustom = mode === "focus" || mode === "custom";
    addStatsEntry(true);

    if (isFocusOrCustom) {
      if (user && profile) {
        const newPoints = profile.totalPoints + POINTS.FOCUS_SESSION;
        setProfile({ ...profile, totalPoints: newPoints });

        try {
          const supabase = supabaseRef.current;
          await Promise.all([
            supabase.from("points_log").insert({
              user_id: user.id,
              action: "Completed Focus Session",
              points: POINTS.FOCUS_SESSION,
            }),
            supabase
              .from("profiles")
              .update({ total_points: newPoints })
              .eq("id", user.id),
          ]);
        } catch (dbErr) {
          console.error("Failed to update points in database:", dbErr);
        }
      }
      alert("Great job! You completed a focus session. +15 Forge Points!");
    } else {
      alert("Break finished! Ready to focus?");
      setMode("focus");
    }
  }, [mode, user, profile, setProfile, addStatsEntry, setMode]);

  // Mutable ref to always hold the latest handleComplete for the interval callback
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  // 3. Core Background Interval Loop
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      tick(() => handleCompleteRef.current());
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, tick]);

  // 4. Play tick sounds during the last 10 seconds
  useEffect(() => {
    if (isActive && timeLeft <= 10 && timeLeft > 0) {
      if (lastPlayedTickRef.current !== timeLeft) {
        playTick();
        lastPlayedTickRef.current = timeLeft;
      }
    }
  }, [isActive, timeLeft]);

  // Resume AudioContext on user interaction (browser autoplay policy)
  const handleInteraction = useCallback(() => {
    getAudioContext();
  }, []);

  // Guard render until client-mounted to avoid SSR hydration mismatch
  if (!mounted) return null;

  // Show overlay when timer is active/paused-mid-session AND user is NOT on /timer
  const isPausedMidway = timeLeft > 0 && timeLeft < sessionDuration;
  const shouldShowOverlay = (isActive || isPausedMidway) && pathname !== "/timer";
  if (!shouldShowOverlay) return null;

  const currentConfig = MODE_CONFIG[mode];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto flex items-center justify-between p-3.5 rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[rgba(23,23,37,0.75)] backdrop-blur-xl shadow-2xl"
        onClick={handleInteraction}
      >
        {/* Clickable area → navigate to timer page */}
        <div
          onClick={() => router.push("/timer")}
          className="flex-1 flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="relative flex items-center justify-center h-8 w-8 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isActive ? "animate-ping" : ""}`}
              style={{ backgroundColor: currentConfig.color }}
            />
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">
              {currentConfig.label}
            </span>
            <span className="text-lg font-bold font-mono text-[var(--text-primary)] leading-tight tracking-wide">
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {/* Controls — stop propagation so clicks don't navigate */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { handleInteraction(); toggleTimer(); }}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.1)] transition-all cursor-pointer"
            aria-label={isActive ? "Pause" : "Play"}
          >
            {isActive ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="5" x2="18" y2="19" />
                <line x1="6" y1="5" x2="6" y2="19" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button
            onClick={() => { handleInteraction(); resetTimer(); }}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            aria-label="Reset"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
