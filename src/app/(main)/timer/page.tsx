"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { formatTimer } from "@/lib/utils";
import {
  useTimerStore,
  TimerMode,
  MODE_CONFIG,
  clampDuration,
} from "@/stores/useTimerStore";

// ============================================================
// Timer Page — Connected to global Zustand useTimerStore.
// Imports shared MODE_CONFIG & clampDuration from the store
// to guarantee a Single Source of Truth for all timer logic.
// ============================================================

export default function TimerPage() {
  const [mounted, setMounted] = useState(false);
  const [presetName, setPresetName] = useState("");

  const {
    mode,
    customMinutes,
    timeLeft,
    sessionDuration,
    sessionStarted,
    isActive,
    sessionsCompleted,
    savedPresets,
    stats,
    setMode,
    setCustomMinutes,
    setTimeLeft,
    toggleTimer,
    resetTimer,
    addPreset,
    deletePreset,
    loadPreset,
    clearStats,
    hydrate,
  } = useTimerStore();

  // Client-side mount & store hydration
  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  // ---- Derived values ----
  const activeColor = MODE_CONFIG[mode].color;
  const totalDuration = sessionStarted ? sessionDuration : (() => {
    if (mode === "custom") {
      const parsed = parseFloat(customMinutes);
      return !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 60) : 25 * 60;
    }
    return sessionDuration;
  })();

  const progress = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // ---- Custom Input Handlers ----

  const handleCustomTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomMinutes(e.target.value);
  }, [setCustomMinutes]);

  /**
   * On blur, validate and clamp the custom input.
   * Only resets timeLeft if this is NOT a paused mid-session (sessionStarted === false).
   */
  const handleCustomTimeBlur = useCallback(() => {
    const parsed = parseFloat(customMinutes);
    let clampedSeconds: number;

    if (isNaN(parsed) || parsed <= 0) {
      setCustomMinutes("25");
      clampedSeconds = 25 * 60;
    } else {
      clampedSeconds = clampDuration(Math.round(parsed * 60));
      setCustomMinutes((clampedSeconds / 60).toString());
    }

    // Only update timeLeft if this is a fresh (not mid-session) state
    if (!isActive && !sessionStarted) {
      setTimeLeft(clampedSeconds);
    }
  }, [customMinutes, isActive, sessionStarted, setCustomMinutes, setTimeLeft]);

  // ---- Preset Handlers ----

  const handleSavePreset = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customMinutes);
    if (isNaN(parsed) || parsed <= 0) return;

    const duration = clampDuration(Math.round(parsed * 60));
    addPreset(presetName, duration);
    setPresetName("");
  }, [customMinutes, presetName, addPreset]);

  // ---- Formatting Helpers ----

  const formatStatsDate = (dateString: string): string => {
    const date = new Date(dateString);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${dateStr} at ${timeStr}`;
  };

  const formatStatsDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    let res = "";
    if (h > 0) res += `${h}h `;
    if (m > 0) res += `${m}m `;
    if (s > 0 || res === "") res += `${s}s`;
    return res.trim();
  };

  // ---- Render ----

  return (
    <div className="space-y-6 animate-fade-in flex flex-col items-center pb-8">
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
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
              mode === m
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Custom Mode Panel */}
      {mode === "custom" && (
        <Card variant="glass" className="w-full space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Duration (minutes):
            </label>
            <input
              type="number"
              min="0.5"
              max="6000"
              step="any"
              value={customMinutes}
              onChange={handleCustomTimeChange}
              onBlur={handleCustomTimeBlur}
              disabled={isActive}
              className="w-24 px-2 py-1 text-center font-mono text-sm bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--brand-primary)] text-[var(--text-primary)] disabled:opacity-50"
            />
          </div>

          {/* Preset Creation Form */}
          <form onSubmit={handleSavePreset} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Preset Name (e.g. Sprint)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              disabled={isActive}
              className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--brand-primary)] text-[var(--text-primary)] disabled:opacity-50"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isActive || !presetName.trim()}
              className="whitespace-nowrap cursor-pointer text-xs py-1.5 h-auto"
            >
              Save Preset
            </Button>
          </form>

          {/* Saved Presets (only rendered after hydration) */}
          {mounted && savedPresets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Saved Presets
              </span>
              <div className="flex flex-wrap gap-2">
                {savedPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-[var(--radius-md)] hover:border-[var(--brand-primary)] transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => loadPreset(preset)}
                      disabled={isActive}
                      className="text-left font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {preset.name} ({formatStatsDuration(preset.duration)})
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(preset.id)}
                      disabled={isActive}
                      className="text-[var(--text-muted)] hover:text-[var(--color-danger, #ef4444)] cursor-pointer transition-colors disabled:opacity-50"
                      title="Delete Preset"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Circular Timer Visualizer */}
      <div className="relative flex items-center justify-center h-64 w-64 my-2">
        {/* Glow behind the timer */}
        <div
          className="absolute inset-4 rounded-full transition-shadow duration-500 opacity-20"
          style={{
            boxShadow: isActive ? `0 0 40px ${activeColor}` : "none",
            backgroundColor: activeColor,
          }}
        />

        <svg className="w-full h-full transform -rotate-90 select-none">
          {/* Background Track Circle */}
          <circle
            cx="128" cy="128" r={radius}
            className="stroke-[var(--bg-secondary)] fill-none"
            strokeWidth="8"
          />
          {/* Animated Countdown Circle */}
          <circle
            cx="128" cy="128" r={radius}
            className="fill-none transition-all duration-150 ease-linear"
            stroke={activeColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Text Countdown in Center */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-mono text-[var(--text-primary)] tracking-wider">
            {mounted ? formatTimer(timeLeft) : formatTimer(totalDuration)}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)] mt-1 uppercase tracking-widest">
            {mounted && isActive ? "Flowing" : "Paused"}
          </span>
        </div>
      </div>

      {/* Play/Pause/Reset Controls */}
      <div className="flex items-center gap-6">
        <Button
          variant="ghost"
          size="md"
          onClick={resetTimer}
          className="w-20 cursor-pointer"
        >
          Reset
        </Button>

        <IconButton
          variant={mode === "focus" ? "brand" : "default"}
          size="xl"
          onClick={toggleTimer}
          aria-label={isActive ? "Pause timer" : "Start timer"}
          className="h-16 w-16 shadow-lg glow-brand cursor-pointer"
        >
          {isActive ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="5" x2="18" y2="19" />
              <line x1="6" y1="5" x2="6" y2="19" />
            </svg>
          ) : (
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
            {mounted ? sessionsCompleted : 0} {mounted && sessionsCompleted === 1 ? "session" : "sessions"} today
          </Badge>
          <Badge variant="points">+15 Pts</Badge>
        </div>
      </Card>

      {/* Detailed Focus Stats Log */}
      <Card variant="glass" className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Focus Session History
          </h3>
          {mounted && stats.length > 0 && (
            <button
              onClick={clearStats}
              className="text-xs font-medium text-[var(--color-danger, #ef4444)] hover:underline cursor-pointer"
            >
              Clear Log
            </button>
          )}
        </div>

        {!mounted ? (
          <div className="text-center py-6 text-xs text-[var(--text-muted)]">
            Loading session history...
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--text-muted)]">
            No focus sessions logged yet. Complete a session to start tracking stats!
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-medium">
                  <th className="p-3">Date/Time</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3 text-center">Pauses</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[var(--text-primary)] font-mono">
                {stats.slice(0, 10).map((entry) => (
                  <tr key={entry.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="p-3 whitespace-nowrap text-[11px] text-[var(--text-secondary)] font-sans">
                      {formatStatsDate(entry.date)}
                    </td>
                    <td className="p-3 capitalize text-[var(--text-secondary)] font-sans">
                      {entry.mode}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {formatStatsDuration(entry.duration)}
                    </td>
                    <td className="p-3 text-center">
                      {entry.pauses}
                    </td>
                    <td className="p-3 text-right">
                      {entry.completed ? (
                        <span className="inline-flex items-center gap-1 text-[var(--brand-primary)] font-semibold font-sans">
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--color-danger, #ef4444)] font-semibold font-sans opacity-70">
                          Abandoned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.length > 10 && (
              <div className="text-center p-2 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-default)] bg-[var(--bg-elevated)] font-sans">
                Showing last 10 entries (total {stats.length} sessions logged)
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
