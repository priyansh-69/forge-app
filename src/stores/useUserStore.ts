import { create } from "zustand";
import { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface UserState {
  user: any | null; // Supabase user
  profile: UserProfile | null;
  loading: boolean;
  coachIntensity: "silent" | "standard" | "harsh";
  notifications: boolean;
  voiceToneAnalysis: boolean;
  setUser: (user: any | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  setCoachIntensity: (intensity: "silent" | "standard" | "harsh") => void;
  setNotifications: (enabled: boolean) => void;
  setVoiceToneAnalysis: (enabled: boolean) => void;
  clear: () => void;
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

const setStorageItem = (key: string, value: any) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export const useUserStore = create<UserState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  coachIntensity: getStorageItem("forge_coach_intensity", "standard"),
  notifications: getStorageItem("forge_notifications", true),
  voiceToneAnalysis: getStorageItem("forge_voice_tone_analysis", true),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCoachIntensity: (coachIntensity) => {
    set({ coachIntensity });
    setStorageItem("forge_coach_intensity", coachIntensity);
  },
  setNotifications: (notifications) => {
    set({ notifications });
    setStorageItem("forge_notifications", notifications);
  },
  setVoiceToneAnalysis: (voiceToneAnalysis) => {
    set({ voiceToneAnalysis });
    setStorageItem("forge_voice_tone_analysis", voiceToneAnalysis);
  },
  fetchProfile: async (userId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

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
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    } finally {
      set({ loading: false });
    }
  },
  clear: () => set({ user: null, profile: null, loading: false }),
}));
