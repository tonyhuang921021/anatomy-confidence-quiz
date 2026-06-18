import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

let browserClient: SupabaseClient | null = null;

type BrowserAuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

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

function createResilientAuthStorage(): BrowserAuthStorage | undefined {
  if (!isBrowser()) return undefined;

  return {
    getItem(key) {
      return safelyRead(window.localStorage, key) ?? safelyRead(window.sessionStorage, key);
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
        safelyRemove(window.sessionStorage, key);
        return;
      } catch (error) {
        if (!isQuotaExceededError(error)) {
          throw error;
        }
      }

      // If old quiz history has filled localStorage, keep auth usable without
      // deleting local-only quiz records. The session survives this tab/window.
      window.sessionStorage.setItem(key, value);
    },
    removeItem(key) {
      safelyRemove(window.localStorage, key);
      safelyRemove(window.sessionStorage, key);
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
  }
}
