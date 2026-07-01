"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { createClient } from "@/lib/supabase/client";
import { POINTS } from "@/lib/constants";
import { toast } from "sonner";

interface BreathingExerciseProps {
  isOpen: boolean;
  onClose: () => void;
}

const supabase = createClient();

export function BreathingExercise({ isOpen, onClose }: BreathingExerciseProps) {
  const { user, profile, setProfile } = useUserStore();
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<"Inhale" | "Hold (Full)" | "Exhale" | "Hold (Empty)">("Inhale");
  const [cycleCount, setCycleCount] = useState(0);

  // Use a ref to prevent the completion handler from firing more than once
  const hasCompletedRef = useRef(false);

  const handleComplete = useCallback(async () => {
    // Guard against double-fire (e.g. rapid state updates)
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    onClose();
    toast.success("Breathing exercise completed!");

    if (!user || !profile) return;

    // Award points — optimistic update with rollback
    const originalProfile = { ...profile };
    const nextPoints = profile.totalPoints + POINTS.BREATHING_EXERCISE;

    setProfile({
      ...profile,
      totalPoints: nextPoints,
    });

    try {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const [logRes, profileRes] = await Promise.all([
          supabase.from("points_log").insert({
            user_id: user.id,
            action: "breathing_exercise",
            points: POINTS.BREATHING_EXERCISE,
          }),
          supabase
            .from("profiles")
            .update({ total_points: nextPoints })
            .eq("id", user.id),
        ]);

        if (logRes.error || profileRes.error) {
          throw new Error(logRes.error?.message || profileRes.error?.message);
        }

        toast.success(`+${POINTS.BREATHING_EXERCISE} Forge Points awarded!`);
      } else {
        toast.info("Offline: Points updated locally.");
      }
    } catch (err) {
      console.error("Failed to save points for breathing:", err);
      setProfile(originalProfile); // rollback
    }
  }, [user, profile, setProfile, onClose]);

  // Box breathing timings (16 seconds total cycle)
  useEffect(() => {
    if (!isOpen) return;

    // Reset state on open
    setSeconds(0);
    setCycleCount(0);
    setPhase("Inhale");
    hasCompletedRef.current = false;

    const timer = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        const elapsed = next % 16;

        if (elapsed === 0) {
          setPhase("Inhale");
          setCycleCount((c) => {
            const nextCycle = c + 1;
            // Complete after 3 full cycles (48 seconds)
            if (nextCycle >= 3) {
              // Clear the interval and trigger completion on next tick
              clearInterval(timer);
              // Use setTimeout(0) to break out of the setState callback
              setTimeout(() => handleComplete(), 0);
            }
            return nextCycle;
          });
        } else if (elapsed === 4) {
          setPhase("Hold (Full)");
        } else if (elapsed === 8) {
          setPhase("Exhale");
        } else if (elapsed === 12) {
          setPhase("Hold (Empty)");
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, handleComplete]);

  if (!isOpen) return null;

  const currentSeconds = seconds % 4;

  // Determine scaling using inline styles for smooth transitions
  // Standard Tailwind only has scale-100, scale-105, scale-110, scale-125, scale-150
  let scaleValue = 1;
  if (phase === "Inhale") {
    // Scale up from 1.0 → 1.5 over 4 steps
    scaleValue = 1.0 + (currentSeconds / 3) * 0.5;
  } else if (phase === "Hold (Full)") {
    scaleValue = 1.5;
  } else if (phase === "Exhale") {
    // Scale down from 1.5 → 1.0 over 4 steps
    scaleValue = 1.5 - (currentSeconds / 3) * 0.5;
  } else {
    // Hold (Empty)
    scaleValue = 1.0;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#0c0c16]/95 backdrop-blur-md animate-fade-in select-none">
      <div className="text-center space-y-6 max-w-sm w-full">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Box Breathing Reset</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Focus on the center. 4s Inhale → 4s Hold → 4s Exhale → 4s Hold.
          </p>
        </div>

        {/* Scaling Core Circle */}
        <div className="h-64 flex items-center justify-center relative">
          <div
            className="h-36 w-36 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 transition-transform duration-1000 ease-in-out flex items-center justify-center"
            style={{ transform: `scale(${scaleValue})` }}
          >
            <div className="h-6 w-6 rounded-full bg-[var(--brand-primary)] animate-ping" />
          </div>
        </div>

        {/* Indicators */}
        <div className="space-y-2">
          <p className="text-lg font-bold text-[var(--text-primary)] tracking-wide uppercase transition-all duration-300">
            {phase}
          </p>
          <p className="text-xs font-semibold text-[var(--brand-primary)]">
            Cycle {Math.min(3, cycleCount + 1)} of 3 • {4 - currentSeconds}s remaining
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-2 cursor-pointer"
        >
          Cancel Exercise
        </button>
      </div>
    </div>
  );
}
