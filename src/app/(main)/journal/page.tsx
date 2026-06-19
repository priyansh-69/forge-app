"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useVaultStore } from "@/stores/useVaultStore";
import { encryptText, decryptText } from "@/lib/crypto";
import { 
  getLocalEntries, 
  saveLocalEntry, 
  saveLocalEntriesBulk, 
  deleteLocalEntry, 
  addToSyncQueue 
} from "@/lib/indexedDb";

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
  const [decryptedEntries, setDecryptedEntries] = useState<DBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [newEntry, setNewEntry] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [dayRating, setDayRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deletedEntries, setDeletedEntries] = useState<DBEntry[]>([]);
  const [decryptedDeletedEntries, setDecryptedDeletedEntries] = useState<DBEntry[]>([]);
  
  // Vault state
  const { isVaultSetup, isUnlocked, vaultKey, unlockVault } = useVaultStore();
  const [feedPassword, setFeedPassword] = useState("");

  // Fetch entries (local-first fallback)
  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setFetchError(null);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { data, error } = await supabase
          .from("entries")
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        setEntries(data || []);
        // Save to local cache in background
        if (data && data.length > 0) {
          await saveLocalEntriesBulk(data);
        }
      } else {
        // Fetch from local IndexedDB cache
        const local = await getLocalEntries();
        const activeLocal = local.filter((e) => !e.deleted_at);
        // Sort descending by created_at
        activeLocal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setEntries(activeLocal);
        toast.info("Offline: Loaded from local cache.");
      }
    } catch (err) {
      console.error("Error fetching entries:", err);
      // Try local cache before showing error
      const local = await getLocalEntries();
      const activeLocal = local.filter((e) => !e.deleted_at);
      if (activeLocal.length > 0) {
        activeLocal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setEntries(activeLocal);
        toast.info("Loaded from local cache.");
      } else {
        setFetchError(err instanceof Error ? err.message : "Failed to load journal entries. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch deleted entries for recycle bin
  const fetchDeletedEntries = useCallback(async () => {
    if (!user) return;
    try {
      if (typeof navigator !== "undefined" && navigator.onLine) {
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
      } else {
        const local = await getLocalEntries();
        const deletedLocal = local.filter((e) => !!e.deleted_at);
        deletedLocal.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
        setDeletedEntries(deletedLocal);
      }
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
      const timer = setTimeout(() => {
        fetchDeletedEntries();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showRecycleBin, user, fetchDeletedEntries]);

  // Reactive Decryption: Entries
  useEffect(() => {
    const decryptAll = async () => {
      if (!isUnlocked || !vaultKey) {
        setDecryptedEntries(entries);
        return;
      }
      
      const decrypted = await Promise.all(
        entries.map(async (entry) => {
          const decTitle = entry.title ? await decryptText(entry.title, vaultKey) : null;
          const decTranscript = entry.transcript ? await decryptText(entry.transcript, vaultKey) : null;
          const decAiResponse = entry.ai_response ? await decryptText(entry.ai_response, vaultKey) : null;
          
          return {
            ...entry,
            title: decTitle,
            transcript: decTranscript,
            ai_response: decAiResponse,
          };
        })
      );
      setDecryptedEntries(decrypted);
    };

    decryptAll();
  }, [entries, isUnlocked, vaultKey]);

  // Reactive Decryption: Deleted Entries
  useEffect(() => {
    const decryptAllDeleted = async () => {
      if (!isUnlocked || !vaultKey) {
        setDecryptedDeletedEntries(deletedEntries);
        return;
      }
      
      const decrypted = await Promise.all(
        deletedEntries.map(async (entry) => {
          const decTitle = entry.title ? await decryptText(entry.title, vaultKey) : null;
          const decTranscript = entry.transcript ? await decryptText(entry.transcript, vaultKey) : null;
          const decAiResponse = entry.ai_response ? await decryptText(entry.ai_response, vaultKey) : null;
          
          return {
            ...entry,
            title: decTitle,
            transcript: decTranscript,
            ai_response: decAiResponse,
          };
        })
      );
      setDecryptedDeletedEntries(decrypted);
    };

    decryptAllDeleted();
  }, [deletedEntries, isUnlocked, vaultKey]);

  const handleSaveEntry = async () => {
    if (!newEntry.trim() || !user) return;
    
    setSaving(true);
    const entryId = "entry-" + Date.now();

    try {
      let finalTitle = newTitle.trim() || null;
      let finalTranscript = newEntry.trim();

      if (isVaultSetup) {
        if (!isUnlocked || !vaultKey) {
          toast.error("Please unlock your Privacy Vault to write encrypted entries.");
          setSaving(false);
          return;
        }
        finalTitle = finalTitle ? await encryptText(finalTitle, vaultKey) : null;
        finalTranscript = await encryptText(finalTranscript, vaultKey);
      }

      const payload = {
        id: entryId,
        user_id: user.id,
        transcript: finalTranscript,
        title: finalTitle,
        day_rating: dayRating,
        ai_mode: "diary",
        created_at: new Date().toISOString(),
        deleted_at: null,
      };

      // Save locally first (local-first)
      await saveLocalEntry(payload);

      // Attempt to save to Supabase
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { error } = await supabase.from("entries").insert(payload);
        if (error) {
          console.warn("Supabase save failed offline fallback:", error.message);
          await addToSyncQueue("insert", "entries", entryId, payload);
          toast.info("Offline: Entry saved locally.");
        } else {
          toast.success("Journal entry saved successfully!");
        }
      } else {
        await addToSyncQueue("insert", "entries", entryId, payload);
        toast.info("Offline: Entry saved locally.");
      }

      setNewEntry("");
      setNewTitle("");
      setDayRating(null);
      fetchEntries();
    } catch (err) {
      console.error("Error saving entry:", err);
      toast.error("Failed to save entry: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (entry: DBEntry) => {
    setEditingId(entry.id);
    setEditText(entry.transcript || "");
    setEditTitle(entry.title || "");
  };

  const handleSaveEdit = async (entryId: string) => {
    try {
      let finalTitle = editTitle.trim() || null;
      let finalTranscript = editText.trim();

      if (isVaultSetup) {
        if (!isUnlocked || !vaultKey) {
          toast.error("Please unlock your Privacy Vault to save changes.");
          return;
        }
        finalTitle = finalTitle ? await encryptText(finalTitle, vaultKey) : null;
        finalTranscript = await encryptText(finalTranscript, vaultKey);
      }

      // Fetch the full original entry to merge fields safely
      const local = await getLocalEntries();
      const original = local.find((e) => e.id === entryId) || {};
      const payload = {
        ...original,
        transcript: finalTranscript,
        title: finalTitle,
      };

      // Update local db
      await saveLocalEntry(payload);

      // Update Supabase
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { error } = await supabase
          .from("entries")
          .update({
            transcript: finalTranscript,
            title: finalTitle,
          })
          .eq("id", entryId);

        if (error) {
          await addToSyncQueue("update", "entries", entryId, { transcript: finalTranscript, title: finalTitle });
          toast.info("Offline: Changes saved locally.");
        } else {
          toast.success("Entry updated successfully!");
        }
      } else {
        await addToSyncQueue("update", "entries", entryId, { transcript: finalTranscript, title: finalTitle });
        toast.info("Offline: Changes saved locally.");
      }

      setEditingId(null);
      fetchEntries();
    } catch (err) {
      toast.error("Failed to update entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleSoftDelete = async (entryId: string) => {
    try {
      const deletedAt = new Date().toISOString();
      const local = await getLocalEntries();
      const original = local.find((e) => e.id === entryId);
      
      if (original) {
        await saveLocalEntry({ ...original, deleted_at: deletedAt });
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { error } = await supabase
          .from("entries")
          .update({ deleted_at: deletedAt })
          .eq("id", entryId);

        if (error) {
          await addToSyncQueue("update", "entries", entryId, { deleted_at: deletedAt });
          toast.info("Offline: Saved deletion locally.");
        } else {
          toast.success("Entry moved to recycle bin.");
        }
      } else {
        await addToSyncQueue("update", "entries", entryId, { deleted_at: deletedAt });
        toast.info("Offline: Saved deletion locally.");
      }

      fetchEntries();
    } catch (err) {
      toast.error("Failed to delete entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleRestore = async (entryId: string) => {
    try {
      const local = await getLocalEntries();
      const original = local.find((e) => e.id === entryId);
      
      if (original) {
        await saveLocalEntry({ ...original, deleted_at: null });
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { error } = await supabase
          .from("entries")
          .update({ deleted_at: null })
          .eq("id", entryId);

        if (error) {
          await addToSyncQueue("update", "entries", entryId, { deleted_at: null });
          toast.info("Offline: Restored locally.");
        } else {
          toast.success("Entry restored successfully!");
        }
      } else {
        await addToSyncQueue("update", "entries", entryId, { deleted_at: null });
        toast.info("Offline: Restored locally.");
      }

      fetchDeletedEntries();
      fetchEntries();
    } catch (err) {
      toast.error("Failed to restore entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handlePermanentDelete = async (entryId: string) => {
    if (!confirm("Permanently delete this entry? This cannot be undone.")) return;
    try {
      await deleteLocalEntry(entryId);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { error } = await supabase
          .from("entries")
          .delete()
          .eq("id", entryId);

        if (error) {
          await addToSyncQueue("delete", "entries", entryId, null);
          toast.info("Offline: Deleted permanently locally.");
        } else {
          toast.success("Entry permanently deleted.");
        }
      } else {
        await addToSyncQueue("delete", "entries", entryId, null);
        toast.info("Offline: Deleted permanently locally.");
      }

      fetchDeletedEntries();
    } catch (err) {
      toast.error("Failed to delete entry: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

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

      {/* In-line unlock banner if Vault is Locked */}
      {isVaultSetup && !isUnlocked && (
        <Card variant="glass" className="border-amber-500/20 bg-amber-500/5 p-3 flex flex-col md:flex-row items-center justify-between gap-3 mb-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <div className="text-left">
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Journal is Encrypted</h4>
              <p className="text-[10px] text-[var(--text-secondary)]">Enter master password to unlock and read your entries.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <input
              type="password"
              placeholder="Password"
              className="flex-1 md:w-32 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              value={feedPassword}
              onChange={(e) => setFeedPassword(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && feedPassword) {
                  const success = await unlockVault(feedPassword);
                  if (success) {
                    setFeedPassword("");
                    toast.success("Journal unlocked!");
                  } else {
                    toast.error("Incorrect password.");
                  }
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              className="cursor-pointer text-xs py-1"
              disabled={!feedPassword}
              onClick={async () => {
                const success = await unlockVault(feedPassword);
                if (success) {
                  setFeedPassword("");
                  toast.success("Journal unlocked!");
                } else {
                  toast.error("Incorrect password.");
                }
              }}
            >
              Unlock
            </Button>
          </div>
        </Card>
      )}

      <Card className="space-y-3">
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
          placeholder={isVaultSetup && !isUnlocked ? "Unlock vault to start writing encrypted entries..." : "How was your day? What's on your mind?"}
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          disabled={saving || (isVaultSetup && !isUnlocked)}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Rate your day:</span>
          <div className="flex gap-1">
            {ratingEmojis.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => setDayRating(dayRating === idx + 1 ? null : idx + 1)}
                disabled={saving || (isVaultSetup && !isUnlocked)}
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
            disabled={!newEntry.trim() || saving || (isVaultSetup && !isUnlocked)}
            size="sm"
          >
            Save Entry
          </Button>
        </div>
      </Card>

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
          decryptedDeletedEntries.length === 0 ? (
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
            decryptedDeletedEntries.map((entry) => {
              const isEncrypted = entry.transcript?.startsWith("__ENCRYPTED__:");
              return (
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
                  {isEncrypted && !isUnlocked ? (
                    <div className="text-sm text-[var(--text-muted)] italic">
                      [Encrypted Vault Locked 🔒]
                    </div>
                  ) : (
                    <>
                      {entry.title && (
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{entry.title}</h4>
                      )}
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed line-clamp-3">
                        {entry.transcript || "No text content."}
                      </p>
                    </>
                  )}
                </Card>
              );
            })
          )
        ) : loading ? (
          <div className="text-center text-sm text-[var(--text-muted)] py-8">Loading entries...</div>
        ) : fetchError ? (
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
        ) : decryptedEntries.length === 0 ? (
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
          decryptedEntries.map((entry) => {
            const isEncrypted = entry.transcript?.startsWith("__ENCRYPTED__:");
            
            return (
              <Card key={entry.id} className="space-y-2">
                <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span>{new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {entry.day_rating && (
                      <span className="text-sm" title={`Day rating: ${entry.day_rating}/5`}>
                        {ratingEmojis[entry.day_rating - 1]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.ai_mode === 'diary' ? <span>📝 Diary</span> : <span>🎙️ Check-in</span>}
                    {editingId !== entry.id && !showRecycleBin && (!isEncrypted || isUnlocked) && (
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

                {isEncrypted && !isUnlocked ? (
                  <div className="py-2 flex items-center justify-between text-xs text-[var(--text-muted)] bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] px-3 rounded-[var(--radius-sm)] italic select-none">
                    <span>[Encrypted Vault Locked 🔒]</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Unlock to read</span>
                  </div>
                ) : editingId === entry.id ? (
                  <div className="space-y-2 animate-fade-in">
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
                    <div className="relative">
                      <p
                        className={`text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed ${
                          !expandedEntries.has(entry.id) ? "max-h-32 overflow-hidden" : ""
                        }`}
                      >
                        {entry.transcript || "No text content."}
                      </p>
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
                {entry.ai_response && (!isEncrypted || isUnlocked) && (
                  <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-[var(--radius-sm)] border-l-2 border-[var(--brand-primary)]">
                    <p className="text-xs font-semibold text-[var(--brand-primary)] mb-1">AI Coach</p>
                    <p className="text-sm text-[var(--text-secondary)] italic">&quot;{entry.ai_response}&quot;</p>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
