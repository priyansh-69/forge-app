"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const { signUp, submitting, authError } = useAuth();
  const router = useRouter();

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
    } catch (err: any) {
      console.error("Signup failure:", err);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="flex flex-col justify-center min-h-screen px-6 py-12 bg-[#0b0d10] text-[#f8fafc]">
      <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
        {/* Logo and Header */}
        <div className="text-center">
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
            <form onSubmit={handleSubmit} className="space-y-6">
              {displayError && (
                <div className="p-3 text-xs font-medium border border-red-500/20 rounded-[var(--radius-sm)] bg-red-500/10 text-red-400">
                  {displayError}
                </div>
              )}

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
    </div>
  );
}
