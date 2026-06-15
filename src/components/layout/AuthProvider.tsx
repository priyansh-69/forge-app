"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/stores/useUserStore";

const supabase = createClient();

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, fetchProfile, clear } = useUserStore();

  useEffect(() => {
    let active = true;

    // Check active session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!active) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          clear();
        }
      } catch (err) {
        console.error("Error checking session:", err);
        if (active) clear();
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return;
        
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          clear();
        }
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setUser, fetchProfile, clear]);

  return <>{children}</>;
}
