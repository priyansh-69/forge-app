"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient();

interface DBEntry {
  id: string;
  created_at: string;
  ai_mode: string;
  transcript: string | null;
  ai_response: string | null;
  title: string | null;
  day_rating: number | null;
  deleted_at: string | null;
  audio_url: string | null;
}

export default function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Bug #24: Explicit error state separate from loading/empty
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState("");
  const [newTitle, setNewTitle] = useState("");
  // Bug #11: Day rating (1-5)
  const [dayRating, setDayRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Bug #10: Track expanded entries
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  // Bug #3: Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  // Bug #3: Recycle bin toggle
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deletedEntries, setDeletedEntries] = useState<DBEntry[]>([]);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setFetchError(null); // Bug #24: Reset error on retry
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Error fetching entries:", err);
      // Bug #24: Set error state instead of silently swallowing
      setFetchError(err instanceof Error ? err.message : "Failed to load journal entries. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Bug #3: Fetch soft-deleted entries for recycle bin
  const fetchDeletedEntries = useCallback(async () => {
    if (!user) return;
    try {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .gte("deleted_at", tenDaysAgo.toISOString())
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setDeletedEntries(data || []);
    } catch (err) {
      console.error("Error fetching deleted entries:", err);
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

  useEffect(() => {
    if (showRecycleBin && user) {
      fetchDeletedEntries();
    }
  }, [showRecycleBin, user, fetchDeletedEntries]);

  const handleSaveEntry = async () => {
    if (!newEntry.trim() || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        transcript: newEntry.trim(),
        title: newTitle.trim() || null,
        day_rating: dayRating,
        ai_mode: "diary",
      });

      if (error) throw error;
      setNewEntry("");
      setNewTitle("");
      setDayRating(null);
      fetchEntries();
      toast.success("Journal entry saved successfully!");
    } catch (err) {
      console.error("Error saving entry:", err);
      toast.error("Failed to save entry: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // Bug #3: Inline editing
  const handleStartEdit = (entry: DBEntry) => {
    setEditingId(entry.id);
    setEditText(entry.transcript || "");
    setEditTitle(entry.title || "");
  };

  const handleSaveEdit = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("entries")
        .update({
          transcript: editText.trim(),
          title: editTitle.trim() || null,
        })
        .eq("id", entryId);

      if (error) throw error;
      setEditingId(null);
      fetchEntries();
      toast.success("Entry updated successfully!");
    } catch (err) {
      toast.error("Failed to update entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // Bug #3: Soft delete
  const handleSoftDelete = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", entryId);

      if (error) throw error;
      fetchEntries();
      toast.success("Entry moved to recycle bin. It will be permanently deleted after 10 days.");
    } catch (err) {
      toast.error("Failed to delete entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // Bug #3: Restore from recycle bin
  const handleRestore = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("entries")
        .update({ deleted_at: null })
        .eq("id", entryId);

      if (error) throw error;
      fetchDeletedEntries();
      fetchEntries();
      toast.success("Entry restored successfully!");
    } catch (err) {
      toast.error("Failed to restore entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // Bug #3: Permanent delete
  const handlePermanentDelete = async (entryId: string) => {
    if (!confirm("Permanently delete this entry? This cannot be undone.")) return;
    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
      fetchDeletedEntries();
      toast.success("Entry permanently deleted.");
    } catch (err) {
      toast.error("Failed to delete entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // Bug #10: Toggle expanded entry
  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bug #11: Rating emojis
  const ratingEmojis = ["😞", "😐", "🙂", "😊", "🔥"];

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
        {/* Bug #11: Title input */}
        <input
          type="text"
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)]"
          placeholder="Entry title (optional)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={saving}
        />
        <textarea
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)] resize-none h-24"
          placeholder="How was your day? What's on your mind?"
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          disabled={saving}
        />
        {/* Bug #11: Day rating */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Rate your day:</span>
          <div className="flex gap-1">
            {ratingEmojis.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => setDayRating(dayRating === idx + 1 ? null : idx + 1)}
                className={`text-xl p-1 rounded-[var(--radius-sm)] transition-all duration-200 cursor-pointer ${
                  dayRating === idx + 1
                    ? "bg-[var(--brand-primary)]/20 scale-125 ring-1 ring-[var(--brand-primary)]"
                    : "opacity-50 hover:opacity-100 hover:scale-110"
                }`}
                type="button"
                aria-label={`Rate ${idx + 1} out of 5`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
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

      {/* Bug #3: Recycle bin toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {showRecycleBin ? "Recycle Bin" : "Entries"}
        </span>
        <button
          onClick={() => setShowRecycleBin(!showRecycleBin)}
          className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {showRecycleBin ? "← Back to Journal" : "🗑️ Recycle Bin"}
        </button>
      </div>

      <div className="space-y-4">
        {showRecycleBin ? (
          // Bug #3: Recycle bin view
          deletedEntries.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">🗑️</span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Recycle bin is empty
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[220px]">
                Deleted entries are kept here for 10 days before permanent removal.
              </p>
            </Card>
          ) : (
            deletedEntries.map((entry) => (
              <Card key={entry.id} className="space-y-2 opacity-75">
                <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
                  <span>Deleted {entry.deleted_at ? new Date(entry.deleted_at).toLocaleDateString() : ""}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(entry.id)}
                      className="text-xs font-medium text-[var(--brand-primary)] hover:underline cursor-pointer"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(entry.id)}
                      className="text-xs font-medium text-red-400 hover:underline cursor-pointer"
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
                {entry.title && (
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{entry.title}</h4>
                )}
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed line-clamp-3">
                  {entry.transcript || "No text content."}
                </p>
              </Card>
            ))
          )
        ) : loading ? (
          <div className="text-center text-sm text-[var(--text-muted)] py-8">Loading entries...</div>
        ) : fetchError ? (
          // Bug #24: Distinct error state — not confused with empty state
          <Card className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <span className="text-4xl mb-1">⚠️</span>
            <h3 className="text-sm font-semibold text-red-400">
              Failed to load entries
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[260px]">
              {fetchError}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchEntries()}
              className="mt-2"
            >
              Retry
            </Button>
          </Card>
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
                <div className="flex items-center gap-2">
                  <span>{new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {/* Bug #11: Show day rating */}
                  {entry.day_rating && (
                    <span className="text-sm" title={`Day rating: ${entry.day_rating}/5`}>
                      {ratingEmojis[entry.day_rating - 1]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.ai_mode === 'diary' ? <span>📝 Diary</span> : <span>🎙️ Check-in</span>}
                  {/* Bug #3: Edit and delete buttons */}
                  {editingId !== entry.id && (
                    <>
                      <button
                        onClick={() => handleStartEdit(entry)}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        title="Edit entry"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleSoftDelete(entry.id)}
                        className="text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete entry"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bug #11: Show title */}
              {editingId === entry.id ? (
                // Bug #3: Inline editing mode
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Title (optional)"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <textarea
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] resize-none h-24"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(entry.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {entry.title && (
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">{entry.title}</h4>
                  )}
                  {/* Bug #10: Truncate long entries */}
                  <div className="relative">
                    <p
                      className={`text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed ${
                        !expandedEntries.has(entry.id) ? "max-h-32 overflow-hidden" : ""
                      }`}
                    >
                      {entry.transcript || "No text content."}
                    </p>
                    {/* Gradient fade for truncated content */}
                    {!expandedEntries.has(entry.id) && entry.transcript && entry.transcript.length > 300 && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent" />
                    )}
                  </div>
                  {entry.transcript && entry.transcript.length > 300 && (
                    <button
                      onClick={() => toggleExpanded(entry.id)}
                      className="text-xs font-medium text-[var(--brand-primary)] hover:underline cursor-pointer"
                    >
                      {expandedEntries.has(entry.id) ? "Read Less" : "Read More"}
                    </button>
                  )}
                  {entry.audio_url && (
                    <div className="mt-2.5">
                      {entry.audio_url.includes("video") || entry.audio_url.endsWith(".mp4") || entry.audio_url.includes("webm") ? (
                        <video
                          src={entry.audio_url}
                          controls
                          playsInline
                          className="w-full max-h-48 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.06)] bg-black"
                        />
                      ) : (
                        <audio
                          src={entry.audio_url}
                          controls
                          className="w-full focus:outline-none"
                        />
                      )}
                    </div>
                  )}
                </>
              )}
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

