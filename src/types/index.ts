// ============================================================
// FORGE — Core TypeScript Types
// ============================================================

/** The three adaptive coaching modes */
export type CoachMode = "elevate" | "nudge" | "truth";

/** Dominant emotion detected from voice analysis */
export type Emotion =
  | "determined"
  | "calm"
  | "anxious"
  | "frustrated"
  | "joyful"
  | "low"
  | "neutral";

/** A single daily check-in entry */
export interface Entry {
  id: string;
  userId: string;
  audioUrl: string;
  transcript: string;
  toneScore: number; // 1-10 scale
  energyLevel: number; // 1-10 scale
  dominantEmotion: Emotion;
  aiResponse: string;
  aiMode: CoachMode;
  createdAt: string;
}

/** User profile */
export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  createdAt: string;
}

/** Actions that earn or spend points */
export type PointsAction =
  | "daily_checkin"
  | "focus_session"
  | "goal_completed"
  | "workout_logged"
  | "streak_bonus"
  | "streak_freeze"
  | "skip_brutal_day"
  | "mirror_week"
  | "deep_dive"
  | "plant_tree";

/** A single points transaction */
export interface PointsLog {
  id: string;
  userId: string;
  action: PointsAction;
  points: number; // positive = earn, negative = spend
  createdAt: string;
}

/** A tracked habit */
export interface Habit {
  id: string;
  userId: string;
  name: string;
  icon: string;
  createdAt: string;
}

/** A habit completion log entry */
export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  completedAt: string;
}

/** AI analysis response from Gemini */
export interface AnalysisResult {
  transcript: string;
  toneScore: number;
  energyLevel: number;
  dominantEmotion: Emotion;
  aiResponse: string;
  aiMode: CoachMode;
}

/** Bottom navigation tab definition */
export interface NavTab {
  id: string;
  label: string;
  href: string;
  icon: string;
}
