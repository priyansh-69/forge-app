"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTimerStore, MODE_CONFIG } from "@/stores/useTimerStore";
import { useUserStore } from "@/stores/useUserStore";
import { createClient } from "@/lib/supabase/client";
import { POINTS } from "@/lib/constants";
import { formatTimer } from "@/lib/utils";
import { playNormalTick, playWarningTick, playAlarm, unlockAudioContext } from "@/lib/audio";
import { toast } from "sonner";

// ============================================================
// Global Timer Overlay Component
// ============================================================

export default function GlobalTimerOverlay() {
  const router = useRouter();
  const pathname = usePathname();

  // Supabase client is stable per browser tab — create once via ref
  const supabaseRef = useRef(createClient());

  const { user, profile, setProfile } = useUserStore();
  const {
    mode,
    timeLeft,
    isActive,
    sessionStarted,
    hasHydrated,
    soundEnabled,
    tick,
    toggleTimer,
    resetTimer,
    addStatsEntry,
    setMode,
    hydrate,
  } = useTimerStore();

  const lastPlayedTickRef = useRef<number | null>(null);

  // Bug #21: Track pending point awards when profile isn't loaded yet
  const pendingPointAwardRef = useRef<boolean>(false);

  // 1. Mount & Hydrate
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Bug #21: Execute queued point award once profile becomes available
  useEffect(() => {
    if (pendingPointAwardRef.current && user && profile) {
      pendingPointAwardRef.current = false;
      const awardPoints = async () => {
        const newPoints = profile.totalPoints + POINTS.FOCUS_SESSION;
        setProfile({ ...profile, totalPoints: newPoints });

        const supabase = supabaseRef.current;
        const [logResult, updateResult] = await Promise.all([
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

        // Bug #23: Check Supabase error fields explicitly
        if (logResult.error || updateResult.error) {
          const errMsg = logResult.error?.message || updateResult.error?.message || "Unknown error";
          console.error("Failed to update points in database:", errMsg);
          // Revert optimistic update
          setProfile({ ...profile, totalPoints: profile.totalPoints });
          toast.error("Points could not be saved. Please try again.");
        } else {
          toast.success("Great job! You completed a focus session. +15 Forge Points!");
        }
      };
      awardPoints();
    }
  }, [user, profile, setProfile]);

  // 2. Focus Session Completion Handler
  const handleComplete = useCallback(async () => {
    if (soundEnabled) {
      playAlarm();
    }

    const isFocusOrCustom = mode === "focus" || mode === "custom";
    addStatsEntry(true);

    if (isFocusOrCustom) {
      if (user && profile) {
        // Profile is available — award points immediately
        const previousPoints = profile.totalPoints;
        const newPoints = previousPoints + POINTS.FOCUS_SESSION;
        setProfile({ ...profile, totalPoints: newPoints });

        const supabase = supabaseRef.current;
        const [logResult, updateResult] = await Promise.all([
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

        // Bug #23: Check error fields — Supabase resolves with { error } instead of throwing
        if (logResult.error || updateResult.error) {
          const errMsg = logResult.error?.message || updateResult.error?.message || "Unknown error";
          console.error("Failed to update points in database:", errMsg);
          // Revert optimistic update
          setProfile({ ...profile, totalPoints: previousPoints });
          toast.error("Session completed but points could not be saved: " + errMsg);
        } else {
          toast.success("Great job! You completed a focus session. +15 Forge Points!");
        }
      } else if (user && !profile) {
        // Bug #21: Profile not loaded yet — queue the award for when it arrives
        pendingPointAwardRef.current = true;
        toast.success("Great job! You completed a focus session. Points will be awarded shortly.");
      } else {
        toast.success("Great job! You completed a focus session.");
      }
    } else {
      toast.info("Break finished! Ready to focus?");
      setMode("focus");
    }
  }, [mode, user, profile, setProfile, addStatsEntry, setMode, soundEnabled]);

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

  // 4. Play tick sounds every second if active and sound is enabled
  useEffect(() => {
    if (!isActive) {
      lastPlayedTickRef.current = null;
      return;
    }

    if (!soundEnabled || timeLeft <= 0) {
      return;
    }

    if (lastPlayedTickRef.current === null) {
      lastPlayedTickRef.current = timeLeft;
      return;
    }

    if (lastPlayedTickRef.current !== timeLeft) {
      if (timeLeft <= 10) {
        playWarningTick();
      } else {
        playNormalTick();
      }
      lastPlayedTickRef.current = timeLeft;
    }
  }, [isActive, timeLeft, soundEnabled]);

  // Resume AudioContext on user interaction (browser autoplay policy)
  const handleInteraction = useCallback(() => {
    unlockAudioContext();
  }, []);

  if (!hasHydrated) return null;

  // Show overlay for any session in progress, including paused mid-session
  const shouldShowOverlay = (isActive || sessionStarted) && pathname !== "/timer";
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
