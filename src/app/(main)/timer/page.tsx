"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { TIMER } from "@/lib/constants";
import { formatTimer } from "@/lib/utils";

// ============================================================
// Timer Page — Pomodoro & Focus session timer
// ============================================================

type TimerMode = "focus" | "short" | "long" | "custom";

const MODE_CONFIG: Record<TimerMode, { label: string; duration: number; color: string; badgeColor: "points" | "elevate" | "default" }> = {
  focus: {
    label: "Focus",
    duration: TIMER.FOCUS_DURATION,
    color: "var(--brand-primary)",
    badgeColor: "points",
  },
  short: {
    label: "Short Break",
    duration: TIMER.SHORT_BREAK,
    color: "var(--mode-elevate)",
    badgeColor: "elevate",
  },
  long: {
    label: "Long Break",
    duration: TIMER.LONG_BREAK,
    color: "var(--brand-primary)",
    badgeColor: "default",
  },
  custom: {
    label: "Custom",
    duration: 1500, // 25 mins default
    color: "var(--brand-secondary, #6366f1)",
    badgeColor: "default",
  },
};

export default function TimerPage() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [customMinutes, setCustomMinutes] = useState("25");
  const [timeLeft, setTimeLeft] = useState(MODE_CONFIG.focus.duration);
  const [isActive, setIsActive] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeConfig = mode === "custom" ? { ...MODE_CONFIG.custom, duration: parseInt(customMinutes, 10) * 60 || 0 } : MODE_CONFIG[mode];
  const totalDuration = activeConfig.duration;
  const progress = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;

  // Calculate SVG stroke offset for circular timer
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Handle mode change
  const handleModeChange = useCallback((newMode: TimerMode) => {
    setIsActive(false);
    setMode(newMode);
    if (newMode === "custom") {
      setTimeLeft(parseInt(customMinutes, 10) * 60 || 0);
    } else {
      setTimeLeft(MODE_CONFIG[newMode].duration);
    }
  }, [customMinutes]);

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomMinutes(val);
    if (!isActive) {
      setTimeLeft(parseInt(val, 10) * 60 || 0);
    }
  };

  // Handle completion
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (mode === "focus" || mode === "custom") {
      setSessionsCompleted((prev) => prev + 1);
      // Play a subtle success audio feedback if available
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
        audio.volume = 0.3;
        audio.play();
      } catch {
        // Audio playback failed (e.g. user interaction constraint)
      }
      alert("Great job! You completed a focus session. +15 Forge Points!");
    } else {
      alert("Break finished! Ready to focus?");
      handleModeChange("focus");
    }
  }, [mode, handleModeChange]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, handleTimerComplete]);

  // Toggle start/pause
  const toggleTimer = () => {
    setIsActive((prev) => !prev);
  };

  // Reset timer
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(activeConfig.duration);
  };

  return (
    <div className="space-y-6 animate-fade-in flex flex-col items-center">
      {/* Title block */}
      <div className="text-center space-y-1 w-full">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Focus Timer
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Stay focused, forge your output, earn points.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex bg-[var(--bg-secondary)] border border-[var(--border-default)] p-1 rounded-[var(--radius-lg)] w-full">
        {(Object.keys(MODE_CONFIG) as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-[var(--radius-md)] transition-all duration-200 ${
              mode === m
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <div className="w-full flex items-center justify-center gap-3">
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Minutes:</label>
          <input
            type="number"
            min="1"
            max="120"
            value={customMinutes}
            onChange={handleCustomTimeChange}
            disabled={isActive}
            className="w-20 px-2 py-1 text-center text-sm font-mono bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--brand-primary)] text-[var(--text-primary)] disabled:opacity-50"
          />
        </div>
      )}

      {/* Circular Timer Visualizer */}
      <div className="relative flex items-center justify-center h-64 w-64 my-4">
        {/* Glow behind the timer */}
        <div 
          className="absolute inset-4 rounded-full transition-shadow duration-500 opacity-20"
          style={{
            boxShadow: isActive ? `0 0 40px ${activeConfig.color}` : "none",
            backgroundColor: activeConfig.color,
          }}
        />

        <svg className="w-full h-full transform -rotate-90 select-none">
          {/* Background Track Circle */}
          <circle
            cx="128"
            cy="128"
            r={radius}
            className="stroke-[var(--bg-secondary)] fill-none"
            strokeWidth="8"
          />
          {/* Animated Countdown Circle */}
          <circle
            cx="128"
            cy="128"
            r={radius}
            className="fill-none transition-all duration-150 ease-linear"
            stroke={activeConfig.color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Text Countdown in Center */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-mono text-[var(--text-primary)] tracking-wider">
            {formatTimer(timeLeft)}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)] mt-1 uppercase tracking-widest">
            {isActive ? "Flowing" : "Paused"}
          </span>
        </div>
      </div>

      {/* Play/Pause/Reset Controls */}
      <div className="flex items-center gap-6">
        <Button
          variant="ghost"
          size="md"
          onClick={resetTimer}
          className="w-20"
        >
          Reset
        </Button>

        <IconButton
          variant={mode === "focus" ? "brand" : "default"}
          size="xl"
          onClick={toggleTimer}
          aria-label={isActive ? "Pause timer" : "Start timer"}
          className="h-16 w-16 shadow-lg glow-brand"
        >
          {isActive ? (
            /* Pause Icon */
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="5" x2="18" y2="19" />
              <line x1="6" y1="5" x2="6" y2="19" />
            </svg>
          ) : (
            /* Play Icon */
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </IconButton>

        <div className="w-20" /> {/* Spacer to balance layout */}
      </div>

      {/* Info Stats Card */}
      <Card variant="glass" className="w-full flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Focus Stats
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Complete sessions to build your score
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default">
            {sessionsCompleted} {sessionsCompleted === 1 ? "session" : "sessions"} today
          </Badge>
          <Badge variant="points">+15 Pts</Badge>
        </div>
      </Card>
    </div>
  );
}
