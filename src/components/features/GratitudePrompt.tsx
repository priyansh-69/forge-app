"use client";

import { useState, useEffect } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { createClient } from "@/lib/supabase/client";
import { encryptText } from "@/lib/crypto";
import { saveLocalEntry, addToSyncQueue } from "@/lib/indexedDb";
import { generateUUID } from "@/lib/uuid";
import { toast } from "sonner";

interface GratitudePromptProps {
  isOpen: boolean;
  onClose: () => void;
}

const supabase = createClient();
const GRATITUDE_POINTS = 5;

export function GratitudePrompt({ isOpen, onClose }: GratitudePromptProps) {
  const { user, profile, setProfile } = useUserStore();
  const { isVaultSetup, isUnlocked, vaultKey } = useVaultStore();

  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [input3, setInput3] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setInput1("");
      setInput2("");
      setInput3("");
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input1.trim() && !input2.trim() && !input3.trim()) {
      toast.error("Please fill in at least one item.");
      return;
    }

    if (!user || !profile) {
      toast.error("You must be logged in.");
      return;
    }

    if (isVaultSetup && (!isUnlocked || !vaultKey)) {
      toast.error("Please unlock your Privacy Vault to save encrypted gratitude entries.");
      return;
    }

    setSaving(true);

    try {
      const items = [input1.trim(), input2.trim(), input3.trim()].filter(Boolean);
      let rawTitle = "Gratitude Micro-Journal";
      let rawTranscript = `Today I am grateful for:\n1. ${items[0] || ""}\n${items[1] ? `2. ${items[1]}\n` : ""}${items[2] ? `3. ${items[2]}\n` : ""}`;
      let rawAiResponse = "Thank you for sharing your gratitude today. Appreciating positive details builds lasting resilience against burnout.";

      let finalTitle: string | null = rawTitle;
      let finalTranscript = rawTranscript;
      let finalAiResponse: string | null = rawAiResponse;

      // Encrypt if Privacy Vault is enabled
      if (isVaultSetup && vaultKey) {
        finalTitle = await encryptText(rawTitle, vaultKey);
        finalTranscript = await encryptText(rawTranscript, vaultKey);
        finalAiResponse = await encryptText(rawAiResponse, vaultKey);
      }

      const entryId = generateUUID();

      const entryPayload = {
        id: entryId,
        user_id: user.id,
        audio_url: null,
        transcript: finalTranscript,
        tone_score: 7, // boosts mood
        energy_level: 6,
        dominant_emotion: "joyful",
        ai_response: finalAiResponse,
        ai_mode: "nudge", // default fallback coaching mode
        cbt_data: {
          themes: ["gratitude"],
          gratitude: items
        },
        title: finalTitle,
        day_rating: 4, // default good rating
        created_at: new Date().toISOString(),
        deleted_at: null,
      };

      // 1. Save locally to IndexedDB first
      await saveLocalEntry(entryPayload);

      // 2. Insert to Supabase online or queue sync
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { error: insertError } = await supabase.from("entries").insert(entryPayload);
        if (insertError) {
          console.warn("Supabase gratitude insert failed, queueing:", insertError.message);
          await addToSyncQueue("insert", "entries", entryId, entryPayload);
        }
      } else {
        await addToSyncQueue("insert", "entries", entryId, entryPayload);
      }

      // 3. Award points
      const originalProfile = { ...profile };
      const nextPoints = profile.totalPoints + GRATITUDE_POINTS;

      setProfile({
        ...profile,
        totalPoints: nextPoints,
      });

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const [logRes, profileRes] = await Promise.all([
          supabase.from("points_log").insert({
            user_id: user.id,
            action: "Gratitude Journal" as any,
            points: GRATITUDE_POINTS,
          }),
          supabase
            .from("profiles")
            .update({ total_points: nextPoints })
            .eq("id", user.id),
        ]);

        if (logRes.error || profileRes.error) {
          console.warn("Failed to commit points log in db:", logRes.error || profileRes.error);
        }
      }

      toast.success("Gratitude entry saved! +5 Forge Points earned.");
      onClose();
    } catch (err) {
      console.error("Gratitude save error:", err);
      toast.error("Failed to save gratitude entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0c0c16]/95 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[var(--bg-secondary)] border border-[rgba(255,255,255,0.08)] rounded-[var(--radius-lg)] p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="text-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5">
            ✨ Gratitude Micro-Journal
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Writing down positive details lowers cortisol and builds resilience. List up to 3 things you appreciate today.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="1. Something small that went well..."
              value={input1}
              onChange={(e) => setInput1(e.target.value)}
              className="w-full text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]/80"
              disabled={saving}
            />
            <input
              type="text"
              placeholder="2. Someone you are thankful for..."
              value={input2}
              onChange={(e) => setInput2(e.target.value)}
              className="w-full text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]/80"
              disabled={saving}
            />
            <input
              type="text"
              placeholder="3. A simple comfort or opportunity..."
              value={input3}
              onChange={(e) => setInput3(e.target.value)}
              className="w-full text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]/80"
              disabled={saving}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-transparent hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] border border-[var(--border-default)] cursor-pointer"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-[var(--bg-primary)] hover:opacity-90 cursor-pointer disabled:opacity-50"
              disabled={saving || (!input1.trim() && !input2.trim() && !input3.trim())}
            >
              {saving ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
