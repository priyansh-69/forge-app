"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

function SignupForm() {
  const { signUp, signInWithGoogle, submitting, authError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bug #19: Read redirect destination from query params
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name || !email || !password || !confirmPassword) {
      setLocalError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    try {
      await signUp(email, password, name);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      console.error("Signup failure:", err);
    }
  };

  const handleGoogleSignUp = async () => {
    setLocalError(null);
    try {
      // Bug #19: Thread redirect destination through Google OAuth
      await signInWithGoogle(redirectTo);
    } catch (err) {
      console.error("Google signup failure:", err);
    }
  };

  const displayError = localError || authError;

  return (
      <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
        {/* Logo and Header */}
        <div className="text-center">
          <Image src="/forge-logo.png" alt="FORGE Logo" width={96} height={96} className="mx-auto mb-4 object-contain" />
          <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-600">
            FORGE
          </h1>
          <p className="mt-3 text-sm text-[#8b92a5]">
            Reflect. Rebuild. Conquer your day.
          </p>
        </div>

        {/* Signup form container */}
        <div className="p-8 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[#141820]/80 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60" />
          
          <h2 className="text-2xl font-bold text-center text-[#f0f2f5] mb-6">
            Forge an account
          </h2>

          {success ? (
            <div className="space-y-4 text-center py-4 animate-fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                ✓
              </div>
              <h3 className="text-lg font-semibold text-[#f0f2f5]">Registration Complete!</h3>
              <p className="text-sm text-[#8b92a5]">
                Please check your inbox to confirm your email. Redirecting you to login...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayError && (
                <div className="p-3 text-xs font-medium border border-red-500/20 rounded-[var(--radius-sm)] bg-red-500/10 text-red-400">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-[#8b92a5]">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[#0b0d10] text-[#f0f2f5] placeholder-[#555d72] focus:border-[var(--brand-primary)] focus:outline-none transition-all duration-200 text-sm"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-[#8b92a5]">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[#0b0d10] text-[#f0f2f5] placeholder-[#555d72] focus:border-[var(--brand-primary)] focus:outline-none transition-all duration-200 text-sm"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[#8b92a5]">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[#0b0d10] text-[#f0f2f5] placeholder-[#555d72] focus:border-[var(--brand-primary)] focus:outline-none transition-all duration-200 text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-[#8b92a5]">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[#0b0d10] text-[#f0f2f5] placeholder-[#555d72] focus:border-[var(--brand-primary)] focus:outline-none transition-all duration-200 text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  isLoading={submitting}
                >
                  Sign Up
                </Button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[var(--border-default)] opacity-40"></div>
                <span className="flex-shrink mx-4 text-xs text-[#555d72] uppercase tracking-wider font-semibold">Or continue with</span>
                <div className="flex-grow border-t border-[var(--border-default)] opacity-40"></div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="w-full flex items-center justify-center gap-3 border border-[var(--border-default)] bg-transparent hover:bg-[#1a202c] hover:text-[#f8fafc] text-[#d1d5db] transition-all duration-200"
                onClick={handleGoogleSignUp}
                disabled={submitting}
              >
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </Button>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <p className="text-center text-sm text-[#8b92a5]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] transition-colors duration-200"
          >
            Sign in
          </Link>
        </p>
      </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex flex-col justify-center min-h-screen px-6 py-12 bg-[#0b0d10] text-[#f8fafc]">
      <Suspense fallback={
        <div className="text-center text-[#8b92a5] text-sm">
          Loading signup form...
        </div>
      }>
        <SignupForm />
      </Suspense>
    </div>
  );
}
