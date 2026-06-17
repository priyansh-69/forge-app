"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/stores/useUserStore";
import { useTimerStore } from "@/stores/useTimerStore";
import { unlockAudioContext } from "@/lib/audio";

const supabase = createClient();

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, fetchProfile, clear, rehydratePreferences } = useUserStore();
  const { rehydrateForUser, clearPersistedState } = useTimerStore();
  // Bug #20/#22: Track the last known user ID to detect identity changes
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    // Helper to handle a new authenticated identity
    const handleIdentity = async (userId: string) => {
      // Bug #20: Compare against last known user ID
      if (lastUserIdRef.current !== userId) {
        lastUserIdRef.current = userId;
        // Bug #22: Rehydrate user-scoped preferences and timer data
        rehydratePreferences(userId);
        rehydrateForUser(userId);
      }
      await fetchProfile(userId);
    };

    // Check active session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!active) return;

        if (session?.user) {
          setUser(session.user);
          await handleIdentity(session.user.id);
        } else {
          lastUserIdRef.current = null;
          clear();
          clearPersistedState();
        }
      } catch (err) {
        console.error("Error checking session:", err);
        if (active) {
          lastUserIdRef.current = null;
          clear();
        }
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return;
        
        if (session?.user) {
          setUser(session.user);
          await handleIdentity(session.user.id);
        } else {
          // Bug #22: Clear all persisted state on sign-out
          lastUserIdRef.current = null;
          clear();
          clearPersistedState();
        }
      }
    );

    // Unlocking AudioContext on first user interaction
    const handleGesture = () => {
      unlockAudioContext();
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };

    window.addEventListener("click", handleGesture);
    window.addEventListener("keydown", handleGesture);
    window.addEventListener("touchstart", handleGesture);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };
  }, [setUser, fetchProfile, clear, rehydratePreferences, rehydrateForUser, clearPersistedState]);

  return <>{children}</>;
}

