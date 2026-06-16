import { create } from "zustand";
import { TIMER } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

export type TimerMode = "focus" | "short" | "long" | "custom";

export interface SavedPreset {
  id: string;
  name: string;
  duration: number; // in seconds
}

export interface FocusStatsEntry {
  id: string;
  date: string; // ISO date string
  mode: TimerMode;
  duration: number; // total session duration in seconds
  completed: boolean;
  pauses: number;
}

// ============================================================
// Shared Constants
// ============================================================

/** Duration in seconds for each non-custom timer mode. */
export const MODE_DURATIONS: Record<Exclude<TimerMode, "custom">, number> = {
  focus: TIMER.FOCUS_DURATION,
  short: TIMER.SHORT_BREAK,
  long: TIMER.LONG_BREAK,
};

/** UI config for each timer mode (labels, colors). */
export const MODE_CONFIG: Record<TimerMode, { label: string; color: string; badgeColor: "points" | "elevate" | "default" }> = {
  focus:  { label: "Focus",       color: "var(--brand-primary)",            badgeColor: "points"  },
  short:  { label: "Short Break", color: "var(--mode-elevate)",             badgeColor: "elevate" },
  long:   { label: "Long Break",  color: "var(--brand-primary)",            badgeColor: "default" },
  custom: { label: "Custom",      color: "var(--brand-secondary, #6366f1)", badgeColor: "default" },
};

/** Absolute bounds for any timer duration. */
export const MIN_LIMIT_SECONDS = 30;           // 30 seconds
export const MAX_LIMIT_SECONDS = 100 * 60 * 60; // 100 hours

/** Clamp a duration in seconds to [MIN_LIMIT, MAX_LIMIT]. */
export const clampDuration = (seconds: number): number => {
  return Math.min(Math.max(seconds, MIN_LIMIT_SECONDS), MAX_LIMIT_SECONDS);
};

// ============================================================
// State Interface
// ============================================================

interface TimerState {
  mode: TimerMode;
  customMinutes: string;
  timeLeft: number;
  /** The full duration of the current session (set once on start, never changes mid-session). */
  sessionDuration: number;
  /** Whether a session has been started (used to distinguish "fresh reset" from "paused mid-session"). */
  sessionStarted: boolean;
  isActive: boolean;
  sessionsCompleted: number;
  pauseCount: number;
  savedPresets: SavedPreset[];
  stats: FocusStatsEntry[];
  hasHydrated: boolean;

  // Core actions
  hydrate: () => void;
  setMode: (mode: TimerMode) => void;
  setCustomMinutes: (minStr: string) => void;
  setTimeLeft: (seconds: number) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  tick: (onComplete: () => void) => void;

  // Preset management
  addPreset: (name: string, duration: number) => void;
  deletePreset: (id: string) => void;
  loadPreset: (preset: SavedPreset) => void;

  // Stats management
  addStatsEntry: (completed: boolean) => void;
  clearStats: () => void;
}

// ============================================================
// Persistence Helpers
// ============================================================

const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  const item = localStorage.getItem(key);
  if (!item) return defaultValue;
  try {
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
};

const setStorageItem = (key: string, value: unknown) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// ============================================================
// Store
// ============================================================

const DEFAULT_DURATION = TIMER.FOCUS_DURATION; // 25 minutes

export const useTimerStore = create<TimerState>((set, get) => {

  /** Count completed sessions from today's date. */
  const getTodaySessionsCount = (entries: FocusStatsEntry[]): number => {
    const todayStr = new Date().toDateString();
    return entries.filter(
      (e) => e.completed && new Date(e.date).toDateString() === todayStr
    ).length;
  };

  /** Parse the custom minutes string into validated seconds, or null if invalid. */
  const parseCustomSeconds = (minStr: string): number | null => {
    const parsed = parseFloat(minStr);
    if (isNaN(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 60);
  };

  /** Compute the correct starting duration for the current mode. */
  const getDurationForMode = (mode: TimerMode, customMinutes: string): number => {
    if (mode === "custom") {
      const seconds = parseCustomSeconds(customMinutes);
      return seconds !== null ? clampDuration(seconds) : DEFAULT_DURATION;
    }
    return MODE_DURATIONS[mode]; // built-in modes are already within bounds
  };

  return {
    mode: "focus",
    customMinutes: "25",
    timeLeft: DEFAULT_DURATION,
    sessionDuration: DEFAULT_DURATION,
    sessionStarted: false,
    isActive: false,
    sessionsCompleted: 0,
    pauseCount: 0,
    savedPresets: [],
    stats: [],
    hasHydrated: false,

    // ---- Hydration (load from localStorage on client mount) ----
    hydrate: () => {
      if (get().hasHydrated) return;
      const savedPresets = getStorageItem<SavedPreset[]>("forge_timer_presets", []);
      const stats = getStorageItem<FocusStatsEntry[]>("forge_timer_stats", []);
      set({
        savedPresets,
        stats,
        sessionsCompleted: getTodaySessionsCount(stats),
        hasHydrated: true,
      });
    },

    // ---- Mode Selection ----
    setMode: (mode) => {
      const duration = getDurationForMode(mode, get().customMinutes);
      set({
        mode,
        timeLeft: duration,
        sessionDuration: duration,
        sessionStarted: false,
        isActive: false,
        pauseCount: 0,
      });
    },

    // ---- Custom Input (while typing — no clamping, deferred to blur/start) ----
    setCustomMinutes: (minStr) => {
      const { mode, isActive, sessionStarted } = get();
      set({ customMinutes: minStr });

      // Only update timeLeft if custom mode, not running, and no session in progress
      if (mode === "custom" && !isActive && !sessionStarted) {
        const seconds = parseCustomSeconds(minStr);
        if (seconds !== null) {
          set({ timeLeft: seconds, sessionDuration: seconds });
        }
      }
    },

    // ---- Direct timeLeft setter (used by blur handler in page) ----
    setTimeLeft: (seconds) => {
      set({ timeLeft: seconds });
    },

    // ---- Start / Pause ----
    toggleTimer: () => {
      const { isActive, mode, customMinutes, timeLeft, pauseCount, sessionStarted } = get();

      if (!isActive) {
        // --- STARTING or RESUMING ---
        if (sessionStarted) {
          // Resuming from a pause: just flip isActive, keep everything else
          set({ isActive: true });
          return;
        }

        // First start of a new session: validate & clamp
        const duration = getDurationForMode(mode, customMinutes);

        // If custom mode, normalize the input string to the clamped value
        if (mode === "custom") {
          set({ customMinutes: (duration / 60).toString() });
        }

        set({
          isActive: true,
          timeLeft: duration,
          sessionDuration: duration,
          sessionStarted: true,
          pauseCount: 0,
        });
      } else {
        // --- PAUSING ---
        set({
          isActive: false,
          pauseCount: pauseCount + 1,
        });
      }
    },

    // ---- Reset ----
    resetTimer: () => {
      const { mode, customMinutes } = get();
      const duration = getDurationForMode(mode, customMinutes);

      // Normalize custom input to the clamped value
      if (mode === "custom") {
        set({ customMinutes: (duration / 60).toString() });
      }

      set({
        isActive: false,
        timeLeft: duration,
        sessionDuration: duration,
        sessionStarted: false,
        pauseCount: 0,
      });
    },

    // ---- Tick (called every 1 second from the global interval) ----
    tick: (onComplete) => {
      const { timeLeft, isActive } = get();
      if (!isActive) return;

      if (timeLeft <= 1) {
        // Session complete: stop the timer, then invoke the completion handler
        set({ timeLeft: 0, isActive: false, sessionStarted: false });
        onComplete();
      } else {
        set({ timeLeft: timeLeft - 1 });
      }
    },

    // ---- Preset Management ----
    addPreset: (name, duration) => {
      const { savedPresets } = get();
      const clamped = clampDuration(duration);
      const newPreset: SavedPreset = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name: name.trim() || `Preset ${formatTimerName(clamped)}`,
        duration: clamped,
      };
      const next = [...savedPresets, newPreset];
      set({ savedPresets: next });
      setStorageItem("forge_timer_presets", next);
    },

    deletePreset: (id) => {
      const next = get().savedPresets.filter((p) => p.id !== id);
      set({ savedPresets: next });
      setStorageItem("forge_timer_presets", next);
    },

    loadPreset: (preset) => {
      const duration = clampDuration(preset.duration);
      set({
        mode: "custom",
        customMinutes: (duration / 60).toString(),
        timeLeft: duration,
        sessionDuration: duration,
        sessionStarted: false,
        isActive: false,
        pauseCount: 0,
      });
    },

    // ---- Stats ----
    addStatsEntry: (completed) => {
      const { mode, sessionDuration, pauseCount, stats } = get();
      if (sessionDuration <= 0) return; // Don't log trivial/empty runs

      const entry: FocusStatsEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString(),
        mode,
        duration: sessionDuration,
        completed,
        pauses: pauseCount,
      };

      const next = [entry, ...stats];
      set({
        stats: next,
        sessionsCompleted: getTodaySessionsCount(next),
        pauseCount: 0,
      });
      setStorageItem("forge_timer_stats", next);
    },

    clearStats: () => {
      set({ stats: [], sessionsCompleted: 0 });
      setStorageItem("forge_timer_stats", []);
    },
  };
});

// ============================================================
// Helpers
// ============================================================

/** Format a duration in seconds as a human-readable string for preset labels. */
function formatTimerName(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (s > 0) return `${m}m ${s}s`;
  return `${m}m`;
}
