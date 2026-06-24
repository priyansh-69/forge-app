import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ============================================================
// GET /api/correlations — Pearson correlation coefficients
// ============================================================

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tzOffset = parseInt(searchParams.get("tzOffset") || "0", 10); // in minutes

    // 1. Fetch user habits, habit logs, and entries for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    // Set to start of day
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [habitsRes, habitLogsRes, entriesRes] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("completed_at", thirtyDaysAgo.toISOString()),
      supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .is("deleted_at", null)
    ]);

    if (habitsRes.error) throw habitsRes.error;
    if (habitLogsRes.error) throw habitLogsRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const habits = habitsRes.data || [];
    const habitLogs = habitLogsRes.data || [];
    const entries = entriesRes.data || [];

    // Helper to get local YYYY-MM-DD date string based on tzOffset
    const getLocalDateString = (isoString: string) => {
      const d = new Date(isoString);
      const localTime = d.getTime() - tzOffset * 60 * 1000;
      return new Date(localTime).toISOString().split("T")[0];
    };

    // 2. Generate the 30-day timeline
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      // adjust for local timezone offset
      const localTime = d.getTime() - tzOffset * 60 * 1000 - i * 24 * 60 * 60 * 1000;
      days.push(new Date(localTime).toISOString().split("T")[0]);
    }

    // 3. Group entries and habit logs by local date
    const entriesByDay: Record<string, typeof entries> = {};
    const habitLogsByDay: Record<string, Set<string>> = {};

    entries.forEach(entry => {
      const date = getLocalDateString(entry.created_at);
      if (!entriesByDay[date]) entriesByDay[date] = [];
      entriesByDay[date].push(entry);
    });

    habitLogs.forEach(log => {
      const date = getLocalDateString(log.completed_at);
      if (!habitLogsByDay[date]) habitLogsByDay[date] = new Set();
      habitLogsByDay[date].add(log.habit_id);
    });

    // 4. Build day-by-day profile vectors
    interface DayProfile {
      day: string;
      hasCheckin: boolean;
      tone: number; // 1-10
      energy: number; // 1-10
      dominantEmotion: string | null;
      themes: Set<string>;
      completedHabits: Set<string>;
    }

    const dayProfiles: DayProfile[] = days.map(day => {
      const dayEntries = entriesByDay[day] || [];
      const hasCheckin = dayEntries.length > 0;
      
      let avgTone = 0;
      let avgEnergy = 0;
      let domEmotion: string | null = null;
      const themes = new Set<string>();

      if (hasCheckin) {
        let totalTone = 0;
        let totalEnergy = 0;
        dayEntries.forEach(e => {
          totalTone += e.tone_score || 5;
          totalEnergy += e.energy_level || 5;
          
          // Get themes inside cbt_data
          const cbtThemes = e.cbt_data?.themes;
          if (Array.isArray(cbtThemes)) {
            cbtThemes.forEach((t: string) => themes.add(t.toLowerCase()));
          }
        });
        avgTone = totalTone / dayEntries.length;
        avgEnergy = totalEnergy / dayEntries.length;
        // Dominant emotion of the last entry of that day
        domEmotion = dayEntries[dayEntries.length - 1].dominant_emotion || "neutral";
      }

      const completedHabits = habitLogsByDay[day] || new Set<string>();

      return {
        day,
        hasCheckin,
        tone: avgTone,
        energy: avgEnergy,
        dominantEmotion: domEmotion,
        themes,
        completedHabits,
      };
    });

    // 5. Identify active themes and emotions to create nodes
    const activeThemes = new Set<string>();
    const activeEmotions = new Set<string>();

    dayProfiles.forEach(profile => {
      profile.themes.forEach(t => activeThemes.add(t));
      if (profile.dominantEmotion) {
        activeEmotions.add(profile.dominantEmotion);
      }
    });

    // Node definitions
    interface Node {
      id: string;
      type: "habit" | "theme" | "emotion";
      label: string;
      icon?: string;
      val: number; // Size/weight of the node (based on occurrences)
      extra?: any;
    }

    const nodes: Node[] = [];

    // Add Habit nodes
    const habitIdToName: Record<string, string> = {};
    const habitOccurrences: Record<string, number> = {};
    habits.forEach(h => {
      habitIdToName[h.id] = h.name;
      const occurrences = dayProfiles.filter(p => p.completedHabits.has(h.id)).length;
      habitOccurrences[h.id] = occurrences;

      // Calculate completion rate
      const completionRate = occurrences / 30;

      nodes.push({
        id: `habit:${h.id}`,
        type: "habit",
        label: h.name,
        icon: h.icon || "⚙️",
        val: Math.max(5, occurrences * 2), // weight
        extra: {
          id: h.id,
          completionRate,
          occurrences,
        }
      });
    });

    // Add Theme nodes
    const themeOccurrences: Record<string, number> = {};
    activeThemes.forEach(t => {
      const occurrences = dayProfiles.filter(p => p.themes.has(t)).length;
      themeOccurrences[t] = occurrences;

      const themeEmojis: Record<string, string> = {
        work: "💼",
        caffeine: "☕",
        health: "🏋️",
        sleep: "😴",
        family: "👨‍👩‍👧‍👦",
        friends: "👥",
        money: "💵",
        meditation: "🧘",
        hobbies: "🎨",
      };

      nodes.push({
        id: `theme:${t}`,
        type: "theme",
        label: t.charAt(0).toUpperCase() + t.slice(1),
        icon: themeEmojis[t] || "🏷️",
        val: Math.max(5, occurrences * 2),
        extra: {
          themeName: t,
          occurrences,
        }
      });
    });

    // Add Emotion nodes
    const emotionOccurrences: Record<string, number> = {};
    const EMOTION_EMOJIS: Record<string, string> = {
      determined: "⚡",
      calm: "🌊",
      anxious: "😰",
      frustrated: "😤",
      joyful: "✨",
      low: "🔋",
      neutral: "😐",
    };
    activeEmotions.forEach(e => {
      const occurrences = dayProfiles.filter(p => p.dominantEmotion === e).length;
      emotionOccurrences[e] = occurrences;

      nodes.push({
        id: `emotion:${e}`,
        type: "emotion",
        label: e.charAt(0).toUpperCase() + e.slice(1),
        icon: EMOTION_EMOJIS[e] || "🎭",
        val: Math.max(5, occurrences * 2),
        extra: {
          emotionName: e,
          occurrences,
        }
      });
    });

    // Pearson correlation helper
    const getPearsonCorrelation = (x: number[], y: number[]) => {
      const n = x.length;
      if (n === 0) return 0;

      let sumX = 0, sumY = 0, sumXY = 0;
      let sumX2 = 0, sumY2 = 0;

      for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
      }

      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

      if (den === 0) return 0;
      return num / den;
    };

    // 6. Compute Links (weighted connections)
    interface Link {
      source: string;
      target: string;
      value: number; // Pearson r (-1.0 to 1.0)
      type: "habit_theme" | "habit_emotion" | "theme_emotion" | "habit_mood" | "theme_mood";
      label: string;
    }

    const links: Link[] = [];

    // Let's compute correlations:
    // A. Habit & Theme
    habits.forEach(h => {
      activeThemes.forEach(t => {
        const x = dayProfiles.map(p => p.completedHabits.has(h.id) ? 1 : 0);
        const y = dayProfiles.map(p => p.themes.has(t) ? 1 : 0);
        const r = getPearsonCorrelation(x, y);

        if (Math.abs(r) >= 0.1) {
          links.push({
            source: `habit:${h.id}`,
            target: `theme:${t}`,
            value: parseFloat(r.toFixed(3)),
            type: "habit_theme",
            label: `${r > 0 ? "+" : ""}${r.toFixed(2)} correlation`,
          });
        }
      });
    });

    // B. Habit & Emotion
    habits.forEach(h => {
      activeEmotions.forEach(e => {
        // Correlation only on check-in days
        const checkinDays = dayProfiles.filter(p => p.hasCheckin);
        const x = checkinDays.map(p => p.completedHabits.has(h.id) ? 1 : 0);
        const y = checkinDays.map(p => p.dominantEmotion === e ? 1 : 0);
        const r = getPearsonCorrelation(x, y);

        if (Math.abs(r) >= 0.1) {
          links.push({
            source: `habit:${h.id}`,
            target: `emotion:${e}`,
            value: parseFloat(r.toFixed(3)),
            type: "habit_emotion",
            label: `${r > 0 ? "+" : ""}${r.toFixed(2)} correlation`,
          });
        }
      });
    });

    // C. Theme & Emotion
    activeThemes.forEach(t => {
      activeEmotions.forEach(e => {
        const checkinDays = dayProfiles.filter(p => p.hasCheckin);
        const x = checkinDays.map(p => p.themes.has(t) ? 1 : 0);
        const y = checkinDays.map(p => p.dominantEmotion === e ? 1 : 0);
        const r = getPearsonCorrelation(x, y);

        if (Math.abs(r) >= 0.1) {
          links.push({
            source: `theme:${t}`,
            target: `emotion:${e}`,
            value: parseFloat(r.toFixed(3)),
            type: "theme_emotion",
            label: `${r > 0 ? "+" : ""}${r.toFixed(2)} correlation`,
          });
        }
      });
    });

    // D. Compute Tone & Energy correlations for side drawer displays
    // We attach these as extra metadata on Habit and Theme nodes.
  