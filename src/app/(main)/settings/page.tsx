"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { APP } from "@/lib/constants";

// ============================================================
// Settings Page — Account settings, coaching mode, and PWA options
// ============================================================

export default function SettingsPage() {
  const [coachIntensity, setCoachIntensity] = useState<"standard" | "harsh" | "silent">("standard");
  const [notifications, setNotifications] = useState(true);
  const [voiceToneAnalysis, setVoiceToneAnalysis] = useState(true);

  const handleExportData = () => {
    alert("Exporting your profile, journal entries, and points logs as JSON. Check your downloads!");
    const mockData = {
      profile: { displayName: "Forge User", currentStreak: 0, totalPoints: 0 },
      entries: [],
      pointsLog: []
    };
    const blob = new Blob([JSON.stringify(mockData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forge_backup_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = () => {
    const confirmDelete = confirm(
      "WARNING: This action is permanent and cannot be undone. You will lose all your progress, streak, and entries. Are you sure you want to delete your account?"
    );
    if (confirmDelete) {
      alert("Account deletion simulated.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Settings
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Configure your FORGE experience and manage your data.
        </p>
      </div>

      {/* User profile stub */}
      <Card className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-xl">
          👤
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Forge User
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Member since June 2026
          </p>
        </div>
      </Card>

      {/* AI Coach Settings */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
          AI Coach Personality
        </h3>
        <Card className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Coaching Rigor
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              Select how brutal the AI coach should be when you slip.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-[var(--bg-tertiary)] p-1 rounded-[var(--radius-md)]">
            {(["silent", "standard", "harsh"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setCoachIntensity(level)}
                className={`py-1.5 text-xs font-medium rounded-[var(--radius-sm)] capitalize transition-all duration-200 ${
                  coachIntensity === level
                    ? "bg-[var(--brand-primary)] text-[var(--bg-primary)] shadow-sm font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] italic">
            {coachIntensity === "silent" && "🔇 Coach will provide basic neutral summaries only."}
            {coachIntensity === "standard" && "⚖️ Standard adaptation. Supporting on good days, nudging on off days."}
            {coachIntensity === "harsh" && "🔥 Brutal Honesty Mode active. Extreme tough love when streaks slip or energy lags."}
          </p>
        </Card>
      </div>

      {/* Preferences Settings */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
          Preferences
        </h3>
        <Card className="divide-y divide-[var(--border-default)] space-y-3">
          {/* Notifications Toggle */}
          <div className="flex items-center justify-between pb-3 pt-1">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Daily Reminders
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Notify me to check in before the day ends
              </p>
            </div>
            <button
              onClick={() => setNotifications((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notifications ? "bg-[var(--brand-primary)]" : "bg-[var(--bg-elevated)]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  notifications ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Voice Tone Toggle */}
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Voice Tone Analysis
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Analyze emotional markers in vocal energy
              </p>
            </div>
            <button
              onClick={() => setVoiceToneAnalysis((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                voiceToneAnalysis ? "bg-[var(--brand-primary)]" : "bg-[var(--bg-elevated)]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  voiceToneAnalysis ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </Card>
      </div>

      {/* Account & Safety */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
          Account & Data
        </h3>
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Export Forge Data
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Download all recorded check-ins and metrics
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExportData}>
              Export
            </Button>
          </div>

          <div className="border-t border-[var(--border-default)] pt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Delete Account
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Permanently erase your FORGE profile
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={handleDeleteAccount}>
              Delete
            </Button>
          </div>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="text-center pt-4 space-y-1.5">
        <p className="text-xs text-[var(--text-muted)]">
          {APP.NAME} — {APP.TAGLINE}
        </p>
        <p className="text-[10px] text-[var(--text-muted)] font-mono">
          v0.1.0-alpha.1 • Build 2026.06.14
        </p>
      </div>
    </div>
  );
}
