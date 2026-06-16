"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { formatTimer } from "@/lib/utils";
import { toast } from "sonner";
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
  const [presetName, setPresetName] = useState("");

  const {
    mode,
    customMinutes,
    timeLeft,
    sessionDuration,
    sessionStarted,
    hasHydrated,
    isActive,
    sessionsCompleted,
    savedPresets,
    stats,
    soundEnabled,
    setMode,
    setCustomMinutes,
    setTimeLeft,
    toggleTimer,
    resetTimer,
    addPreset,
    deletePreset,
    loadPreset,
    clearStats,
    setSoundEnabled,
    deleteStatsEntry,
    hydrate,
  } = useTimerStore();

  const filteredStats = stats.filter((entry) => entry.mode === mode);

  // Client-side mount & store hydration
  useEffect(() => {
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
    if (sessionStarted) return;

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
    toast.success(`Preset "${presetName}" saved successfully.`);
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
            disabled={sessionStarted}
            className={`flex-1 py-2 text-xs font-semibold rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
              mode === m
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
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
              disabled={sessionStarted}
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
              disabled={sessionStarted}
              className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--brand-primary)] text-[var(--text-primary)] disabled:opacity-50"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={sessionStarted || !presetName.trim()}
              className="whitespace-nowrap cursor-pointer text-xs py-1.5 h-auto"
            >
              Save Preset
            </Button>
          </form>

          {/* Saved Presets (only rendered after hydration) */}
          {hasHydrated && savedPresets.length > 0 && (
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
                      disabled={sessionStarted}
                      className="text-left font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {preset.name} ({formatStatsDuration(preset.duration)})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deletePreset(preset.id);
                        toast.success(`Preset "${preset.name}" deleted.`);
                      }}
                      disabled={sessionStarted}
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
            {hasHydrated ? formatTimer(timeLeft) : formatTimer(totalDuration)}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)] mt-1 uppercase tracking-widest">
            {hasHydrated && isActive ? "Flowing" : "Paused"}
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

      {/* Sound Toggle */}
      <Card variant="glass" className="w-full flex items-center justify-between p-3.5 border border-[var(--border-default)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-[var(--text-secondary)]">
            {hasHydrated && soundEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Ticking Audio
            </h4>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              Play clock ticks and end warning alerts
            </p>
          </div>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            hasHydrated && soundEnabled ? "bg-[var(--brand-primary)]" : "bg-[var(--bg-elevated)]"
          }`}
          aria-label="Toggle Ticking Sound"
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              hasHydrated && soundEnabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </Card>

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
            {hasHydrated ? sessionsCompleted : 0} {hasHydrated && sessionsCompleted === 1 ? "session" : "sessions"} today
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
          {hasHydrated && stats.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
                  clearStats();
                  toast.success("All focus session history logs cleared.");
                }
              }}
              className="text-xs font-medium text-[var(--color-danger, #ef4444)] hover:underline cursor-pointer"
            >
              Clear Log
            </button>
          )}
        </div>

        {!hasHydrated ? (
          <div className="text-center py-6 text-xs text-[var(--text-muted)]">
            Loading session history...
          </div>
        ) : filteredStats.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--text-muted)]">
            No session logs under {MODE_CONFIG[mode].label} yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-medium">
                  <th className="p-3">Date/Time</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3 text-center">Pauses</th>
                  <th className="p-3 text-right">Status</th>
                  <th className="p-3 text-center w-12">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[var(--text-primary)] font-mono">
                {filteredStats.slice(0, 10).map((entry) => (
                  <tr key={entry.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="p-3 whitespace-nowrap text-[11px] text-[var(--text-secondary)] font-sans">
                      {formatStatsDate(entry.date)}
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
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this log entry?")) {
                            deleteStatsEntry(entry.id);
                            toast.success("Log entry deleted successfully.");
                          }
                        }}
                        className="text-[var(--text-muted)] hover:text-[var(--color-danger, #ef4444)] transition-colors cursor-pointer text-sm font-sans"
                        title="Delete entry"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStats.length > 10 && (
              <div className="text-center p-2 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-default)] bg-[var(--bg-elevated)] font-sans">
                Showing last 10 entries (total {filteredStats.length} sessions logged)
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
