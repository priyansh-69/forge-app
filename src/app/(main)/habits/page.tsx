"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ============================================================
// Habits Page — Manage user habits (Bug #7)
// ============================================================

interface Habit {
  id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

const supabase = createClient();

const PRESET_HABITS = [
  { name: "Drink Water", icon: "💧" },
  { name: "Exercise", icon: "🏋️" },
  { name: "Read Book", icon: "📖" },
  { name: "Meditate", icon: "🧘" },
  { name: "Sleep 8h", icon: "💤" },
  { name: "Eat Healthy", icon: "🥦" },
];

const EMOJI_POOL = ["💧", "🏋️", "📖", "🧘", "💤", "🥦", "🏃", "💻", "🚶", "🍎", "🎨", "✍️", "🦷", "🧘‍♀️", "🔋"];

export default function HabitsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("💧");
  const [submitting, setSubmitting] = useState(false);

  const fetchHabits = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setHabits(data || []);
    } catch (err) {
      console.error("Error fetching habits:", err);
      toast.error("Failed to load habits.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchHabits();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, fetchHabits]);

  const handleAddPreset = async (name: string, icon: string) => {
    if (!user) return;
    // Prevent duplicates
    if (habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Habit "${name}" already exists!`);
      return;
    }

    try {
      const { error } = await supabase.from("habits").insert({
        user_id: user.id,
        name,
        icon,
      });

      if (error) throw error;
      fetchHabits();
      toast.success(`Habit "${name}" added!`);
    } catch (err) {
      console.error("Error adding preset habit:", err);
      toast.error("Failed to add habit.");
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !user) return;

    const name = customName.trim();
    if (habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Habit "${name}" already exists!`);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("habits").insert({
        user_id: user.id,
        name,
        icon: selectedEmoji,
      });

      if (error) throw error;
      setCustomName("");
      fetchHabits();
      toast.success(`Habit "${name}" added!`);
    } catch (err) {
      console.error("Error adding custom habit:", err);
      toast.error("Failed to add habit.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHabit = async (habitId: string, habitName: string) => {
    if (!confirm(`Delete "${habitName}"? This will permanently delete all its completion history.`)) return;

    try {
      const { error } = await supabase.from("habits").delete().eq("id", habitId);
      if (error) throw error;
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      toast.success(`Habit "${habitName}" deleted.`);
    } catch (err) {
      console.error("Error deleting habit:", err);
      toast.error("Failed to delete habit.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header with Back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center justify-center h-8 w-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          aria-label="Back to dashboard"
        >
          ←
        </button>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Manage Habits
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Add or remove habits to track on your dashboard.
          </p>
        </div>
      </div>

      {/* Preset Habits Chips */}
      <Card variant="glass" className="space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Quick Add Presets
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESET_HABITS.map((preset) => {
            const exists = habits.some((h) => h.name.toLowerCase() === preset.name.toLowerCase());
            return (
              <button
                key={preset.name}
                onClick={() => handleAddPreset(preset.name, preset.icon)}
                disabled={exists}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 cursor-pointer ${
                  exists
                    ? "bg-[var(--bg-secondary)] border-[var(--border-default)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                    : "bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--brand-primary)] hover:scale-105"
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Custom Habit Form */}
      <Card variant="glass" className="space-y-4">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Create Custom Habit
        </h3>
        <form onSubmit={handleAddCustom} className="space-y-3">
          <div className="flex gap-2">
            {/* Emoji icon picker */}
            <div className="relative group">
              <select
                value={selectedEmoji}
                onChange={(e) => setSelectedEmoji(e.target.value)}
                className="h-10 w-12 text-lg text-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--brand-primary)] text-[var(--text-primary)] cursor-pointer appearance-none flex items-center justify-center"
              >
                {EMOJI_POOL.map((emoji) => (
                  <option key={emoji} value={emoji}>
                    {emoji}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-1.5 flex items-center pointer-events-none text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">
                ▼
              </div>
            </div>

            <input
              type="text"
              required
              placeholder="Habit name (e.g. Code, Walk)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={submitting}
              maxLength={40}
              className="flex-1 h-10 px-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--brand-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] disabled:opacity-50"
            />

            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !customName.trim()}
              className="h-10 px-4 whitespace-nowrap text-sm cursor-pointer"
            >
              Add Habit
            </Button>
          </div>
        </form>
      </Card>

      {/* Active Habits list */}
      <Card variant="glass" className="space-y-4">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Your Habits ({habits.length})
        </h3>

        {loading ? (
          <div className="text-center text-xs text-[var(--text-muted)] py-6">
            Loading your habits...
          </div>
        ) : habits.length === 0 ? (
          <div className="text-center text-xs text-[var(--text-muted)] py-6">
            No habits created yet. Use the presets or form above to start tracking.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)] border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] overflow-hidden">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center justify-between p-3.5 hover:bg-[rgba(255,255,255,0.01)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl h-8 w-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
                    {habit.icon || "🌟"}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {habit.name}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteHabit(habit.id, habit.name)}
                  className="text-xs font-medium text-red-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
