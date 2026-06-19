import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { deriveKey, encryptText, decryptText, generateSalt, generateRecoveryKey } from "@/lib/crypto";
import { getSyncQueue, removeSyncQueueItem } from "@/lib/indexedDb";

interface VaultState {
  isVaultSetup: boolean;
  isUnlocked: boolean;
  vaultKey: CryptoKey | null;
  syncStatus: "synced" | "syncing" | "offline";
  pendingSyncCount: number;
  initialize: () => Promise<void>;
  setupVault: (password: string) => Promise<string>;
  unlockVault: (password: string) => Promise<boolean>;
  unlockWithRecovery: (recoveryKey: string, newPassword: string) => Promise<boolean>;
  lockVault: () => void;
  syncQueueWithSupabase: () => Promise<void>;
}

const supabase = createClient();

const getLocalStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
};

const setLocalStorage = (key: string, value: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
};

const removeLocalStorage = (key: string) => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(key);
  }
};

export const useVaultStore = create<VaultState>((set, get) => ({
  isVaultSetup: false,
  isUnlocked: false,
  vaultKey: null,
  syncStatus: "synced",
  pendingSyncCount: 0,

  initialize: async () => {
    const salt = getLocalStorage("vault_salt");
    const isSetup = !!salt;
    
    let count = 0;
    try {
      const queue = await getSyncQueue();
      count = queue.length;
    } catch (e) {
      console.warn("Failed to check sync queue size during init:", e);
    }

    const online = typeof navigator !== "undefined" ? navigator.onLine : true;

    set({
      isVaultSetup: isSetup,
      pendingSyncCount: count,
      syncStatus: count > 0 ? (online ? "syncing" : "offline") : "synced",
    });

    // Auto sync on init if online and has pending queue items
    if (count > 0 && online) {
      setTimeout(() => {
        get().syncQueueWithSupabase();
      }, 500);
    }
  },

  setupVault: async (password) => {
    // 1. Generate salt and derive key
    const salt = generateSalt();
    const key = await deriveKey(password, salt);

    // 2. Generate a verification test vector
    const testVector = await encryptText("vault_verification_token", key);

    // 3. Generate recovery phrase and derive a key from it
    const recoveryPhrase = generateRecoveryKey();
    const recoveryKeyMaterial = await deriveKey(recoveryPhrase, salt);
    const recoveryVector = await encryptText("vault_verification_token", recoveryKeyMaterial);

    // 4. Save metadata in localStorage
    setLocalStorage("vault_salt", salt);
    setLocalStorage("vault_test_vector", testVector);
    setLocalStorage("vault_recovery_vector", recoveryVector);

    set({
      isVaultSetup: true,
      isUnlocked: true,
      vaultKey: key,
    });

    return recoveryPhrase;
  },

  unlockVault: async (password) => {
    const salt = getLocalStorage("vault_salt");
    const testVector = getLocalStorage("vault_test_vector");
    if (!salt || !testVector) {
      return false;
    }

    try {
      // Derive key from password and try decrypting the test vector
      const key = await deriveKey(password, salt);
      const decrypted = await decryptText(testVector, key);

      if (decrypted === "vault_verification_token") {
        set({
          isUnlocked: true,
          vaultKey: key,
        });
        
        // Trigger background sync once unlocked
        get().syncQueueWithSupabase();
        return true;
      }
    } catch (err) {
      console.error("Vault unlocking attempt failed:", err);
    }
    return false;
  },

  unlockWithRecovery: async (recoveryKey, newPassword) => {
    const salt = getLocalStorage("vault_salt");
    const recoveryVector = getLocalStorage("vault_recovery_vector");
    if (!salt || !recoveryVector) {
      return false;
    }

    try {
      // 1. Derive key from recovery code and verify it
      const cleanRecovery = recoveryKey.trim().toUpperCase();
      const recKey = await deriveKey(cleanRecovery, salt);
      const decrypted = await decryptText(recoveryVector, recKey);

      if (decrypted === "vault_verification_token") {
        // 2. Re-derive key from new password
        const newKey = await deriveKey(newPassword, salt);
        
        // 3. Encrypt new password verification vector
        const newTestVector = await encryptText("vault_verification_token", newKey);
        setLocalStorage("vault_test_vector", newTestVector);

        set({
          isUnlocked: true,
          vaultKey: newKey,
        });

        // Trigger background sync once unlocked
        get().syncQueueWithSupabase();
        return true;
      }
    } catch (err) {
      console.error("Recovery unlock failed:", err);
    }
    return false;
  },

  lockVault: () => {
    set({
      isUnlocked: false,
      vaultKey: null,
    });
  },

  syncQueueWithSupabase: async () => {
    // Guard against multiple concurrent sync runs
    if (get().syncStatus === "syncing") return;

    const queue = await getSyncQueue();
    if (queue.length === 0) {
      set({ syncStatus: "synced", pendingSyncCount: 0 });
      return;
    }

    // Check connectivity
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ syncStatus: "offline", pendingSyncCount: queue.length });
      return;
    }

    set({ syncStatus: "syncing", pendingSyncCount: queue.length });

    for (const item of queue) {
      try {
        let success = false;
        
        if (item.table === "entries") {
          if (item.action === "insert") {
            const { error } = await supabase.from("entries").upsert({
              id: item.recordId,
              ...item.payload,
            });
            if (!error) success = true;
            else console.error("Sync insert error:", error.message);
          } else if (item.action === "update") {
            const { error } = await supabase
              .from("entries")
              .update(item.payload)
              .eq("id", item.recordId);
            if (!error) success = true;
            else console.error("Sync update error:", error.message);
          } else if (item.action === "delete") {
            const { error } = await supabase
              .from("entries")
              .delete()
              .eq("id", item.recordId);
            if (!error) success = true;
            else console.error("Sync delete error:", error.message);
          }
        }

        if (success && item.id !== undefined) {
          // Remove from local IndexedDB queue
          await removeSyncQueueItem(item.id);
        } else {
          // Break loop on failure (probably network loss or rate limit)
          break;
        }
      } catch (err) {
        console.error("Sync loop error:", err);
        break;
      }
    }

    // Recalculate remaining items
    const remainingQueue = await getSyncQueue();
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;

    set({
      pendingSyncCount: remainingQueue.length,
      syncStatus: remainingQueue.length > 0 
        ? (online ? "syncing" : "offline") 
        : "synced",
    });
  },
}));
