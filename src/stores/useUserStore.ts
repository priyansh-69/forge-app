import { create } from "zustand";
import { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

interface UserState {
  user: User | null; // Supabase user
  profile: UserProfile | null;
  loading: boolean;
  // Bug #20: Dedicated profile loading flag separate from "profile exists"
  profileLoading: boolean;
  // Bug #20: Track which user the current profile belongs to
  currentUserId: string | null;
  coachIntensity: "silent" | "standard" | "harsh";
  notifications: boolean;
  voiceToneAnalysis: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  setCoachIntensity: (intensity: "silent" | "standard" | "harsh") => void;
  setNotifications: (enabled: boolean) => void;
  setVoiceToneAnalysis: (enabled: boolean) => void;
  clear: () => void;
  // Bug #22: Rehydrate user-scoped preferences
  rehydratePreferences: (userId: string) => void;
}

const supabase = createClient();

// Safe localStorage access
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  const item = localStorage.getItem(key);
  if (!item) return defaultValue;
  try {
    return JSON.parse(item) as T;
  } catch {
    return item as unknown as T;
  }
};

const setStorageItem = (key: string, value: unknown) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Bug #22: User-scoped storage helpers
const getUserStorageItem = <T>(userId: string, key: string, defaultValue: T): T => {
  return getStorageItem(`${key}_${userId}`, defaultValue);
};

const setUserStorageItem = (userId: string, key: string, value: unknown) => {
  setStorageItem(`${key}_${userId}`, value);
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  currentUserId: null,
  // Default values — will be rehydrated per-user after auth
  coachIntensity: "standard",
  notifications: true,
  voiceToneAnalysis: true,

  // Bug #20: Compare user IDs and clear profile if identity changed
  setUser: (user) => {
    const { currentUserId } = get();
    if (user && user.id !== currentUserId) {
      // Identity changed — clear stale profile immediately
      set({ user, profile: null, currentUserId: user.id, profileLoading: true });
    } else if (!user) {
      set({ user: null, profile: null, currentUserId: null, profileLoading: false });
    } else {
      set({ user });
    }
  },

  setProfile: (profile) => set({ profile }),

  // Bug #22: Rehydrate user-scoped preferences from localStorage
  rehydratePreferences: (userId: string) => {
    const coachIntensity = getUserStorageItem(userId, "forge_coach_intensity", "standard");
    const notifications = getUserStorageItem(userId, "forge_notifications", true);
    const voiceToneAnalysis = getUserStorageItem(userId, "forge_voice_tone_analysis", true);
    set({ coachIntensity, notifications, voiceToneAnalysis });
  },

  setCoachIntensity: (coachIntensity) => {
    const { currentUserId } = get();
    set({ coachIntensity });
    // Bug #22: Write to user-scoped key
    if (currentUserId) {
      setUserStorageItem(currentUserId, "forge_coach_intensity", coachIntensity);
    }
    // Also write to global key for backward compat
    setStorageItem("forge_coach_intensity", coachIntensity);
  },
  setNotifications: (notifications) => {
    const { currentUserId } = get();
    set({ notifications });
    if (currentUserId) {
      setUserStorageItem(currentUserId, "forge_notifications", notifications);
    }
    setStorageItem("forge_notifications", notifications);
  },
  setVoiceToneAnalysis: (voiceToneAnalysis) => {
    const { currentUserId } = get();
    set({ voiceToneAnalysis });
    if (currentUserId) {
      setUserStorageItem(currentUserId, "forge_voice_tone_analysis", voiceToneAnalysis);
    }
    setStorageItem("forge_voice_tone_analysis", voiceToneAnalysis);
  },
  fetchProfile: async (userId) => {
    set({ profileLoading: true });
    // Bug #20: Only set loading to true if we don't have a profile yet (prevents infinite render loops)
    set((state) => ({ loading: !state.profile }));
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      // Bug #20: Verify the fetched profile still matches the current user
      const { currentUserId } = get();
      if (currentUserId !== userId) {
        // User changed while fetch was in-flight — discard stale data
        return;
      }

      if (data) {
        set({
          profile: {
            id: data.id,
            displayName: data.display_name || "",
            avatarUrl: data.avatar_url || null,
            currentStreak: data.current_streak || 0,
            longestStreak: data.longest_streak || 0,
            totalPoints: data.total_points || 0,
            createdAt: data.created_at,
          },
        });
      } else {
        // Bug #20: Explicitly clear profile when no row found
        set({ profile: null });
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      // Bug #20: Clear profile on error to avoid stale data
      set({ profile: null });
    } finally {
      set({ loading: false, profileLoading: false });
    }
  },
  clear: () => set({
    user: null,
    profile: null,
    loading: false,
    profileLoading: false,
    currentUserId: null,
    // Reset preferences to defaults on clear
    coachIntensity: "standard",
    notifications: true,
    voiceToneAnalysis: true,
  }),
}));

