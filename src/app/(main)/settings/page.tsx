"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { APP } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/stores/useUserStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { encryptText } from "@/lib/crypto";
import { saveLocalEntry } from "@/lib/indexedDb";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ============================================================
// Settings Page — Account settings, coaching mode, and PWA options
// ============================================================

const supabase = createClient();

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    user,
    profile,
    coachIntensity,
    notifications,
    voiceToneAnalysis,
    setCoachIntensity,
    setNotifications,
    setVoiceToneAnalysis,
  } = useUserStore();

  const {
    isVaultSetup,
    isUnlocked,
    vaultKey,
    setupVault,
    unlockVault,
    unlockWithRecovery,
    lockVault,
  } = useVaultStore();

  const [vaultPassword, setVaultPassword] = useState("");
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState("");
  const [newVaultPassword, setNewVaultPassword] = useState("");
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [setupRecoveryPhrase, setSetupRecoveryPhrase] = useState("");
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      // Query database tables for this user's data
      const [
        profileResult,
        entriesResult,
        pointsResult,
        habitsResult,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("entries").select("*").eq("user_id", user.id),
        supabase.from("points_log").select("*").eq("user_id", user.id),
        supabase.from("habits").select("*").eq("user_id", user.id),
      ]);

      const exportResults = [
        { label: "profile", result: profileResult },
        { label: "entries", result: entriesResult },
        { label: "points", result: pointsResult },
        { label: "habits", result: habitsResult },
      ] as const;

      const failedQuery = exportResults.find(({ result }) => result.error);
      if (failedQuery) {
        throw new Error(
          `Failed to export ${failedQuery.label}: ${failedQuery.result.error?.message || "Unknown database error"}`
        );
      }

      const backup = {
        profile: profileResult.data || profile || {},
        entries: entriesResult.data || [],
        points: pointsResult.data || [],
        habits: habitsResult.data || [],
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `forge_backup_data_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Data exported successfully!");
    } catch (err) {
      toast.error("Failed to export data: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmDelete = confirm(
      "WARNING: This action is permanent and cannot be undone. You will lose all your progress, streaks, entries, and habit records. Are you sure you want to permanently erase your FORGE profile?"
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
      });

      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseData?.error || "Failed to delete account");
      }

      await signOut();
      router.push("/login");
      toast.success("Account deleted successfully.");
    } catch (err) {
      toast.error("Failed to delete account: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
      toast.success("Logged out successfully.");
    } catch (err) {
      toast.error("Failed to log out: " + (err instanceof Error ? err.message : "Unknown error"));
      setLoggingOut(false);
    }
  };


  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return "Member since June 2026";
    const date = new Date(dateStr);
    return `Member since ${date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })}`;
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

      {/* User profile card */}
      <Card className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-xl">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt="Avatar"
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            "👤"
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {profile?.displayName || user?.email || "Forge User"}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {formatJoinDate(profile?.createdAt || user?.created_at)}
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
              onClick={async () => {
                if (!notifications) {
                  // Bug #6: Request browser notification permission when toggling ON
                  if ("Notification" in window) {
                    const permission = await Notification.requestPermission();
                    if (permission === "granted") {
                      setNotifications(true);
                      toast.success("Daily reminders enabled!");
                    } else if (permission === "denied") {
                      toast.error("Notification permission denied. Please enable it in your browser settings.");
                    } else {
                      toast.info("Notification permission was dismissed. Toggle again to retry.");
                    }
                  } else {
                    toast.error("Notifications are not supported in this browser.");
                  }
                } else {
                  setNotifications(false);
                  toast.info("Daily reminders disabled.");
                }
              }}
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
              onClick={() => setVoiceToneAnalysis(!voiceToneAnalysis)}
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

      {/* Privacy & Security Vault */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
          🔒 Privacy & Security Vault
        </h3>
        
        {!isVaultSetup ? (
          <Card className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Setup Local Encryption
              </h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Secure your journal entries and AI coach answers. This derives a local 256-bit AES key in your browser. All reflections are encrypted before syncing to Supabase.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <input
                type="password"
                placeholder="Choose Master Password (min. 6 chars)"
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)]"
                value={vaultPassword}
                onChange={(e) => setVaultPassword(e.target.value)}
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full cursor-pointer"
                disabled={vaultPassword.length < 6}
                onClick={async () => {
                  try {
                    const phrase = await setupVault(vaultPassword);
                    setSetupRecoveryPhrase(phrase);
                    setVaultPassword("");
                    setShowRecoveryModal(true);
                    toast.success("Vault setup successfully!");
                  } catch (e) {
                    toast.error("Failed to setup vault.");
                  }
                }}
              >
                Create Encrypted Vault
              </Button>
            </div>
          </Card>
        ) : !isUnlocked ? (
          <Card className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                🔒 Vault is Locked
              </h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Unlock your vault with your master password to read, edit, or save encrypted entries.
              </p>
            </div>

            {!showForgotForm ? (
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Master Password"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && vaultPassword) {
                      const success = await unlockVault(vaultPassword);
                      if (success) {
                        setVaultPassword("");
                        toast.success("Vault unlocked!");
                      } else {
                        toast.error("Incorrect password.");
                      }
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 cursor-pointer text-xs"
                    disabled={!vaultPassword}
                    onClick={async () => {
                      const success = await unlockVault(vaultPassword);
                      if (success) {
                        setVaultPassword("");
                        toast.success("Vault unlocked!");
                      } else {
                        toast.error("Incorrect password.");
                      }
                    }}
                  >
                    Unlock Vault
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-xs"
                    onClick={() => setShowForgotForm(true)}
                  >
                    Forgot Password?
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-amber-500 font-medium leading-relaxed">
                  ⚠️ Enter your emergency recovery key to reset your master password and restore access.
                </p>
                <input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono uppercase focus:outline-none focus:border-[var(--brand-primary)]"
                  value={recoveryPhraseInput}
                  onChange={(e) => setRecoveryPhraseInput(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Choose New Master Password (min. 6 chars)"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
                  value={newVaultPassword}
                  onChange={(e) => setNewVaultPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 cursor-pointer text-xs"
                    disabled={recoveryPhraseInput.length < 24 || newVaultPassword.length < 6}
                    onClick={async () => {
                      const success = await unlockWithRecovery(recoveryPhraseInput, newVaultPassword);
                      if (success) {
                        setRecoveryPhraseInput("");
                        setNewVaultPassword("");
                        setShowForgotForm(false);
                        toast.success("Vault password reset and unlocked!");
                      } else {
                        toast.error("Incorrect recovery key.");
                      }
                    }}
                  >
                    Reset & Unlock
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-xs"
                    onClick={() => setShowForgotForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                  🔓 Vault is Unlocked
                </h4>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                  Zero-Knowledge Client-Side AES-GCM Sync Active.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer text-xs border border-[var(--border-default)]"
                onClick={() => {
                  lockVault();
                  toast.info("Vault locked securely.");
                }}
              >
                Lock Vault
              </Button>
            </div>

            <div className="border-t border-[var(--border-default)] pt-3.5 space-y-3">
              <div className="space-y-1">
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">
                  Migrate Legacy Entries
                </h5>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  Have unencrypted entries from before vault activation? Sync and encrypt them client-side in one click.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="w-full cursor-pointer text-xs"
                isLoading={migrating}
                onClick={async () => {
                  if (!user || !vaultKey) return;
                  setMigrating(true);
                  try {
                    const { data: entries, error } = await supabase
                      .from("entries")
                      .select("*")
                      .eq("user_id", user.id)
                      .is("deleted_at", null);
                    
                    if (error) throw error;
                    
                    const legacy = (entries || []).filter(
                      (e) => e.transcript && !e.transcript.startsWith("__ENCRYPTED__:")
                    );
                    
                    if (legacy.length === 0) {
                      toast.info("All journal entries are already encrypted!");
                      setMigrating(false);
                      return;
                    }

                    let successCount = 0;
                    for (const entry of legacy) {
                      const encryptedTitle = entry.title ? await encryptText(entry.title, vaultKey) : null;
                      const encryptedTranscript = entry.transcript ? await encryptText(entry.transcript, vaultKey) : null;
                      const encryptedAiResponse = entry.ai_response ? await encryptText(entry.ai_response, vaultKey) : null;
                      
                      const { error: updateErr } = await supabase
                        .from("entries")
                        .update({
                          title: encryptedTitle,
                          transcript: encryptedTranscript,
                          ai_response: encryptedAiResponse,
                        })
                        .eq("id", entry.id);
                      
                      if (!updateErr) {
                        successCount++;
                        await saveLocalEntry({
                          ...entry,
                          title: encryptedTitle,
                          transcript: encryptedTranscript,
                          ai_response: encryptedAiResponse,
                        });
                      }
                    }

                    toast.success(`Successfully encrypted and migrated ${successCount} entries!`);
                  } catch (err) {
                    console.error("Migration error:", err);
                    toast.error("Failed to migrate legacy entries.");
                  } finally {
                    setMigrating(false);
                  }
                }}
              >
                🔒 Encrypt Legacy Entries
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Setup Recovery Key Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="w-full max-w-sm border border-[var(--border-default)] shadow-2xl p-5 space-y-4 bg-[var(--bg-primary)]">
            <div className="text-center space-y-1">
              <span className="text-3xl">🔑</span>
              <h4 className="text-md font-bold text-[var(--text-primary)]">
                Save Emergency Recovery Key
              </h4>
              <p className="text-[10px] text-amber-500 font-medium max-w-[280px] mx-auto leading-relaxed">
                If you forget your master password, this recovery key is the ONLY way to unlock your journal. Write it down or save it somewhere safe.
              </p>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] p-3 rounded-[var(--radius-md)] text-center font-mono font-bold text-sm tracking-wider text-[var(--brand-primary)] select-all">
              {setupRecoveryPhrase}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 cursor-pointer text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(setupRecoveryPhrase);
                  toast.success("Recovery key copied to clipboard!");
                }}
              >
                Copy Key
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 cursor-pointer text-xs"
                onClick={() => {
                  setShowRecoveryModal(false);
                  setSetupRecoveryPhrase("");
                }}
              >
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Account & Safety */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
          Account & Data
        </h3>
        <Card className="space-y-3">
          {/* Export */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Export Forge Data
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Download all recorded check-ins and metrics
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportData}
              isLoading={exporting}
            >
              Export
            </Button>
          </div>

          {/* Logout */}
          <div className="border-t border-[var(--border-default)] pt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Log Out
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Sign out of this device securely
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20"
              onClick={handleLogout}
              isLoading={loggingOut}
            >
              Logout
            </Button>
          </div>

          {/* Delete Account */}
          <div className="border-t border-[var(--border-default)] pt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Delete Account
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Permanently erase your FORGE profile
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              isLoading={deleting}
            >
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
