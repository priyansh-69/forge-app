"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/stores/useUserStore";
import { useTimerStore } from "@/stores/useTimerStore";

const supabase = createClient();

export function useAuth() {
  const { user, profile, loading, clear } = useUserStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

      console.log("Supabase signUp response:", { data, error });

      if (error) throw error;

      // Check if user already exists (if user is null or identities array is empty, it is a duplicate signup)
      const isDuplicate = !data?.user || !data.user.identities || data.user.identities.length === 0;
      if (isDuplicate) {
        throw new Error("This email address is already in use. Please use another email or log in.");
      }

      return data;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An error occurred during sign up.";
      setAuthError(errMsg);
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
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An error occurred during sign in.";
      setAuthError(errMsg);
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
      // Bug #22: Clear user-scoped persisted state on sign-out
      useTimerStore.getState().clearPersistedState();
      clear();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An error occurred during sign out.";
      setAuthError(errMsg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // Sign in with Google (OAuth)
  // Bug #19: Accept optional redirectTo to preserve the intended destination through OAuth
  const signInWithGoogle = async (redirectTo?: string) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      // Build callback URL with the intended destination
      let callbackUrl = `${window.location.origin}/auth/callback`;
      if (redirectTo && redirectTo !== "/dashboard") {
        callbackUrl += `?next=${encodeURIComponent(redirectTo)}`;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) throw error;
      return data;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An error occurred during Google sign in.";
      setAuthError(errMsg);
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
    signInWithGoogle,
  };
}
