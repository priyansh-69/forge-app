import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { computeBurnoutIndex } from "@/lib/burnout";

// ============================================================
// POST /api/burnout-index — Burnout Risk Calculation
// ============================================================

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Fallback to empty object if body parsing fails
    }

    const { tzOffset = 0, focusStats = { completedSessions: 0, attemptedSessions: 0 } } = body;

    // 1. Fetch data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [habitsRes, habitLogsRes, entriesRes, profileRes] = await Promise.all([
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
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("current_streak")
        .eq("id", user.id)
        .maybeSingle()
    ]);

    if (habitsRes.error) throw habitsRes.error;
    if (habitLogsRes.error) throw habitLogsRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const habits = habitsRes.data || [];
    const habitLogs = habitLogsRes.data || [];
    const entries = entriesRes.data || [];
    const currentStreak = profileRes.data?.current_streak || 0;

    // Call the shared burnout calculation logic
    const result = computeBurnoutIndex({
      entries,
      currentStreak,
      focusStats,
      tzOffset,
      habits,
      habitLogs,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error in /api/burnout-index:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during burnout calculation." },
      { status: 500 }
    );
  }
}
