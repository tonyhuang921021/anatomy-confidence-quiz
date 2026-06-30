import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { freeLocalStorageSpaceForAuth } from "@/lib/storage";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

let browserClient: SupabaseClient | null = null;

type MaybePromise<T> = T | Promise<T>;

type BrowserAuthStorage = {
  getItem: (key: string) => MaybePromise<string | null>;
  setItem: (key: string, value: string) => MaybePromise<void>;
  removeItem: (key: string) => MaybePromise<void>;
};

type AuthStorageLocation = "localStorage" | "indexedDB" | "sessionStorage" | "unavailable";

const AUTH_INDEXED_DB_NAME = "anatomy-confidence-auth";
const AUTH_INDEXED_DB_STORE = "supabase-auth";

let authIndexedDbPromise: Promise<IDBDatabase | null> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function isQuotaExceededError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeDomError = error as { code?: number; name?: string; message?: string };
  return (
    maybeDomError.name === "QuotaExceededError" ||
    maybeDomError.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    maybeDomError.code === 22 ||
    maybeDomError.code === 1014 ||
    maybeDomError.message?.toLowerCase().includes("quota")
  );
}

function safelyRead(storage: Storage | undefined, key: string) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safelyRemove(storage: Storage | undefined, key: string) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore browsers that block storage access.
  }
}

function notifyAuthStorageLocation(storage: AuthStorageLocation, reason?: string) {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent("medquiz-auth-storage-location-change", {
      detail: { storage, reason }
    })
  );
}

function tryWriteLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function getAuthIndexedDb() {
  if (!isBrowser() || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  if (!authIndexedDbPromise) {
    authIndexedDbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = window.indexedDB.open(AUTH_INDEXED_DB_NAME, 1);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(AUTH_INDEXED_DB_STORE)) {
            db.createObjectStore(AUTH_INDEXED_DB_STORE);
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            authIndexedDbPromise = null;
          };
          resolve(db);
        };

        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  return authIndexedDbPromise;
}

async function readIndexedDbAuthItem(key: string) {
  const db = await getAuthIndexedDb();
  if (!db) return null;

  return new Promise<string | null>((resolve) => {
    try {
      const transaction = db.transaction(AUTH_INDEXED_DB_STORE, "readonly");
      const request = transaction.objectStore(AUTH_INDEXED_DB_STORE).get(key);
      request.onsuccess = () => {
        resolve(typeof request.result === "string" ? request.result : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIndexedDbAuthItem(key: string, value: string) {
  const db = await getAuthIndexedDb();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (saved: boolean) => {
      if (!settled) {
        settled = true;
        resolve(saved);
      }
    };

    try {
      const transaction = db.transaction(AUTH_INDEXED_DB_STORE, "readwrite");
      transaction.oncomplete = () => finish(true);
      transaction.onerror = () => finish(false);
      transaction.onabort = () => finish(false);
      transaction.objectStore(AUTH_INDEXED_DB_STORE).put(value, key);
    } catch {
      finish(false);
    }
  });
}

async function removeIndexedDbAuthItem(key: string) {
  const db = await getAuthIndexedDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    try {
      const transaction = db.transaction(AUTH_INDEXED_DB_STORE, "readwrite");
      transaction.oncomplete = finish;
      transaction.onerror = finish;
      transaction.onabort = finish;
      transaction.objectStore(AUTH_INDEXED_DB_STORE).delete(key);
    } catch {
      finish();
    }
  });
}

function createResilientAuthStorage(): BrowserAuthStorage | undefined {
  if (!isBrowser()) return undefined;

  return {
    async getItem(key) {
      const localValue = safelyRead(window.localStorage, key);
      if (localValue) return localValue;

      const indexedDbValue = await readIndexedDbAuthItem(key);
      if (indexedDbValue) return indexedDbValue;

      return safelyRead(window.sessionStorage, key);
    },
    async setItem(key, value) {
      if (tryWriteLocalStorage(key, value)) {
        void removeIndexedDbAuthItem(key);
        safelyRemove(window.sessionStorage, key);
        notifyAuthStorageLocation("localStorage");
        return;
      }

      const recoveredKeys = freeLocalStorageSpaceForAuth();
      if (recoveredKeys > 0 && tryWriteLocalStorage(key, value)) {
        void removeIndexedDbAuthItem(key);
        safelyRemove(window.sessionStorage, key);
        notifyAuthStorageLocation("localStorage", "recovered-space");
        return;
      }

      if (await writeIndexedDbAuthItem(key, value)) {
        safelyRemove(window.localStorage, key);
        safelyRemove(window.sessionStorage, key);
        notifyAuthStorageLocation("indexedDB", "local-storage-unavailable");
        return;
      }

      try {
        window.sessionStorage.setItem(key, value);
        notifyAuthStorageLocation("sessionStorage", "persistent-storage-unavailable");
      } catch (error) {
        notifyAuthStorageLocation("unavailable", isQuotaExceededError(error) ? "quota-exceeded" : "blocked");
        throw error;
      }
    },
    removeItem(key) {
      safelyRemove(window.localStorage, key);
      safelyRemove(window.sessionStorage, key);
      void removeIndexedDbAuthItem(key);
    }
  };
}

function getSupabaseAuthStorageKeys() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];

  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    if (!projectRef) return [];
    const baseKey = `sb-${projectRef}-auth-token`;
    return [baseKey, `${baseKey}-code-verifier`];
  } catch {
    return [];
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are missing.");
  }
  if (isSupabaseRecoveryMode()) {
    throw new Error("Supabase recovery mode is active.");
  }

  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        auth: {
          persistSession: true,
          storage: createResilientAuthStorage(),
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return browserClient;
}

export function clearSupabaseBrowserAuthStorage() {
  if (!isBrowser()) return;

  for (const key of getSupabaseAuthStorageKeys()) {
    safelyRemove(window.localStorage, key);
    safelyRemove(window.sessionStorage, key);
    void removeIndexedDbAuthItem(key);
  }
}
