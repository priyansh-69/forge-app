// ============================================================
// FORGE — App-Wide Constants
// ============================================================

/** Points awarded for each action */
export const POINTS = {
  DAILY_CHECKIN: 10,
  FOCUS_SESSION: 15,
  GOAL_COMPLETED: 20,
  WORKOUT_LOGGED: 10,
  STREAK_BONUS_7: 50,
} as const;

/** Points cost for redemptions */
export const REDEMPTIONS = {
  STREAK_FREEZE: 50,
  SKIP_BRUTAL_DAY: 100,
  MIRROR_WEEK: 75,
  DEEP_DIVE: 150,
  PLANT_TREE: 200,
} as const;

/** Coach mode thresholds */
export const COACH = {
  /** Minimum streak days for Elevate mode */
  ELEVATE_MIN_STREAK: 3,
  /** Low days before switching to Truth mode */
  TRUTH_LOW_DAY_THRESHOLD: 4,
  /** Tone score below this = "low day" */
  LOW_TONE_THRESHOLD: 4,
} as const;

/** Timer defaults (in seconds) */
export const TIMER = {
  FOCUS_DURATION: 25 * 60, // 25 minutes
  SHORT_BREAK: 5 * 60,     // 5 minutes
  LONG_BREAK: 15 * 60,     // 15 minutes
  SESSIONS_BEFORE_LONG: 4,
} as const;

/** Recording limits */
export const RECORDING = {
  MAX_DURATION_MS: 2 * 60 * 1000, // 2 minutes
  MIME_TYPE: "audio/webm",
} as const;

/** App metadata */
export const APP = {
  NAME: "FORGE",
  TAGLINE: "Your AI Life Operating System",
  DESCRIPTION:
    "Talk to it for 2 minutes a day. It reads your words, your tone, your patterns — then responds differently based on where you actually are.",
} as const;
