"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface DBEntry {
  id: string;
  created_at: string;
  ai_mode: string;
  transcript: string | null;
  ai_response: string | null;
}

export default function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Error fetching entries:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchEntries();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, fetchEntries]);

  const handleSaveEntry = async () => {
    if (!newEntry.trim() || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        transcript: newEntry.trim(),
        ai_mode: "diary",
      });

      if (error) throw error;
      setNewEntry("");
      fetchEntries();
    } catch (err) {
      console.error("Error saving entry:", err);
      alert("Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Your Journal
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Write down your thoughts or review past check-ins.
        </p>
      </div>

      <Card className="space-y-3">
        <textarea
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)] resize-none h-24"
          placeholder="How was your day? What's on your mind?"
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          disabled={saving}
        />
        <div className="flex justify-end">
          <Button 
            onClick={handleSaveEntry} 
            isLoading={saving} 
            disabled={!newEntry.trim() || saving}
            size="sm"
          >
            Save Entry
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-sm text-[var(--text-muted)] py-8">Loading entries...</div>
        ) : entries.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">📖</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              No entries yet
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[220px]">
              Your journal entries will appear here after your first check-in or diary entry.
            </p>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="space-y-2">
              <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
                <span>{new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {entry.ai_mode === 'diary' ? <span>📝 Diary</span> : <span>🎙️ Check-in</span>}
              </div>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {entry.transcript || "No text content."}
              </p>
              {entry.ai_response && (
                <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-[var(--radius-sm)] border-l-2 border-[var(--brand-primary)]">
                  <p className="text-xs font-semibold text-[var(--brand-primary)] mb-1">AI Coach</p>
                  <p className="text-sm text-[var(--text-secondary)] italic">&quot;{entry.ai_response}&quot;</p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
