import { create } from "zustand";
import { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface UserState {
  user: any | null; // Supabase user
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: any | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  clear: () => void;
}

const supabase = createClient();

export const useUserStore = create<UserState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
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
