"use client";

const DB_NAME = "forge_local_db";
const DB_VERSION = 1;

const isBrowser = typeof window !== "undefined";

// Initialize database
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser) {
      reject(new Error("IndexedDB is only supported in browser environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB opening failed:", event);
      reject(new Error("IndexedDB open failed"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // entries store for caching journal logs
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "id" });
      }

      // sync_queue store for queueing transactions made offline
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

// ==========================================
// Entries Operations (Local Cache)
// ==========================================

export async function getLocalEntries(): Promise<any[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("entries", "readonly");
      const store = transaction.objectStore(transaction.objectStoreNames[0] || "entries");
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to get local entries:", err);
    return [];
  }
}

export async function saveLocalEntry(entry: any): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("entries", "readwrite");
      const store = transaction.objectStore("entries");
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to save entry locally:", err);
  }
}

export async function saveLocalEntriesBulk(entries: any[]): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("entries", "readwrite");
      const store = transaction.objectStore("entries");

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };

      entries.forEach((entry) => {
        store.put(entry);
      });
    });
  } catch (err) {
    console.error("Failed bulk caching entries:", err);
  }
}

export async function deleteLocalEntry(id: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("entries", "readwrite");
      const store = transaction.objectStore("entries");
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to delete entry locally:", err);
  }
}

// Clear all local entries in database cache
export async function clearLocalEntries(): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("entries", "readwrite");
      const store = transaction.objectStore("entries");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to clear local entries store:", err);
  }
}

// ==========================================
// Sync Queue Operations (Offline Ledger)
// ==========================================

export interface SyncAction {
  id?: number;
  action: "insert" | "update" | "delete";
  table: "entries";
  recordId: string;
  payload: any;
  timestamp: number;
}

export async function addToSyncQueue(
  action: "insert" | "update" | "delete",
  table: "entries",
  recordId: string,
  payload: any
): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("sync_queue", "readwrite");
      const store = transaction.objectStore("sync_queue");
      const syncItem: SyncAction = {
        action,
        table,
        recordId,
        payload,
        timestamp: Date.now(),
      };

      const request = store.add(syncItem);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to queue sync action offline:", err);
  }
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("sync_queue", "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () => {
        // Return sorted by timestamp to process oldest first
        const sorted = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        resolve(sorted);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to fetch offline sync queue:", err);
    return [];
  }
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("sync_queue", "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to remove sync queue item:", err);
  }
}
