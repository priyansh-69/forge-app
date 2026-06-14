"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/stores/useUserStore";

const supabase = createClient();

export function useAuth() {
  const { user, profile, loading, setUser, fetchProfile, clear } = useUserStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check active session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          clear();
        }
      } catch (err: any) {
        console.error("Error checking session:", err);
        clear();
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          clear();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, fetchProfile, clear]);

  // Sign up new user
  const signUp = async (email: string, password: string, displayName: string) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName,
          },
        },
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      setAuthError(err.message || "An error occurred during sign up.");
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // Sign in existing user
  const signIn = async (email: string, password: string) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      setAuthError(err.message || "An error occurred during sign in.");
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // Sign out user
  const signOut = async () => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clear();
    } catch (err: any) {
      setAuthError(err.message || "An error occurred during sign out.");
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    user,
    profile,
    loading,
    authError,
    submitting,
    signUp,
    signIn,
    signOut,
  };
}
