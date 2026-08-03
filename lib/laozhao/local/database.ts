import {
  LaoZhaoLocalError,
  mapLaoZhaoStorageError,
  type LaoZhaoLocalOperation
} from "./errors";
import {
  LAOZHAO_LOCAL_DB_NAME,
  LAOZHAO_LOCAL_DB_VERSION,
  LAOZHAO_LOCAL_STORES,
  type LaoZhaoLocalStore
} from "./types";

let databasePromise: Promise<IDBDatabase> | null = null;
let databaseInstance: IDBDatabase | null = null;

function resetDatabaseConnection(database?: IDBDatabase) {
  if (database && databaseInstance !== database) return;
  databaseInstance = null;
  databasePromise = null;
}

function closeDatabaseConnection(database: IDBDatabase) {
  resetDatabaseConnection(database);
  try {
    database.close();
  } catch {
    // The browser may already have closed the connection.
  }
}

function getErrorName(error: unknown): string {
  if (typeof error !== "object" || error === null || !("name" in error)) return "";
  return typeof error.name === "string" ? error.name : "";
}

function isRecoverableConnectionError(error: unknown): boolean {
  if (error instanceof LaoZhaoLocalError && error.cause !== undefined) {
    return isRecoverableConnectionError(error.cause);
  }
  return ["AbortError", "InvalidStateError", "TransactionInactiveError"].includes(
    getErrorName(error)
  );
}

function assertIndexedDb(operation: LaoZhaoLocalOperation) {
  if (typeof indexedDB === "undefined") {
    throw new LaoZhaoLocalError(
      "unavailable",
      operation,
      "這個瀏覽器不提供 IndexedDB，本機學習紀錄沒有保存。"
    );
  }
}

function setupStores(database: IDBDatabase) {
  if (!database.objectStoreNames.contains("progress")) {
    const store = database.createObjectStore("progress", { keyPath: "videoId" });
    store.createIndex("updatedAt", "updatedAt", { unique: false });
  }

  if (!database.objectStoreNames.contains("bookmarks")) {
    const store = database.createObjectStore("bookmarks", { keyPath: "id" });
    store.createIndex("videoId", "videoId", { unique: false });
    store.createIndex("videoIdAtSec", ["videoId", "atSec"], { unique: false });
  }

  if (!database.objectStoreNames.contains("notes")) {
    const store = database.createObjectStore("notes", { keyPath: "id" });
    store.createIndex("videoId", "videoId", { unique: false });
    store.createIndex("videoIdUpdatedAt", ["videoId", "updatedAt"], { unique: false });
  }
}

export function openLaoZhaoDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      reject(mapLaoZhaoStorageError(error, "open"));
    };

    try {
      assertIndexedDb("open");
      const request = indexedDB.open(LAOZHAO_LOCAL_DB_NAME, LAOZHAO_LOCAL_DB_VERSION);
      timeoutId = setTimeout(() => {
        fail(
          new LaoZhaoLocalError(
            "unavailable",
            "open",
            "本機資料庫開啟逾時，這次瀏覽先使用暫存模式。"
          )
        );
      }, 4_000);

      request.onupgradeneeded = () => {
        setupStores(request.result);
      };

      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        databaseInstance = database;
        database.onversionchange = () => closeDatabaseConnection(database);
        database.addEventListener("close", () => resetDatabaseConnection(database));
        resolve(database);
      };

      request.onerror = () => fail(request.error);
      request.onblocked = () =>
        fail(
          new LaoZhaoLocalError(
            "blocked",
            "open",
            "本機資料庫正在被其他分頁使用，請關閉舊分頁後再試。"
          )
        );
    } catch (error) {
      fail(error);
    }
  });

  databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
}

async function withDatabaseRetry<T>(
  operation: (database: IDBDatabase) => Promise<T>,
  retried = false
): Promise<T> {
  const database = await openLaoZhaoDatabase();
  try {
    return await operation(database);
  } catch (error) {
    if (!retried && isRecoverableConnectionError(error)) {
      closeDatabaseConnection(database);
      return withDatabaseRetry(operation, true);
    }
    throw error;
  }
}

function getStoreNames(stores: LaoZhaoLocalStore[]) {
  return stores.length > 0 ? stores : [...LAOZHAO_LOCAL_STORES];
}

export async function readStore<T>(
  storeName: LaoZhaoLocalStore,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return withDatabaseRetry((database) => new Promise<T>((resolve, reject) => {
    let result: T;
    let hasResult = false;
    let transaction: IDBTransaction;

    try {
      transaction = database.transaction(storeName, "readonly");
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => {
        result = request.result;
        hasResult = true;
      };
      request.onerror = () => reject(mapLaoZhaoStorageError(request.error, "read"));
      transaction.oncomplete = () => {
        if (hasResult) resolve(result);
        else reject(new LaoZhaoLocalError("operation-failed", "read", "本機資料讀取沒有回傳結果。"));
      };
      transaction.onerror = () => reject(mapLaoZhaoStorageError(transaction.error, "read"));
      transaction.onabort = () => reject(mapLaoZhaoStorageError(transaction.error, "read"));
    } catch (error) {
      reject(mapLaoZhaoStorageError(error, "read"));
    }
  }));
}

export async function readAllStores() {
  return withDatabaseRetry((database) => new Promise<{
    progress: unknown[];
    bookmarks: unknown[];
    notes: unknown[];
  }>((resolve, reject) => {
    let progress: unknown[] = [];
    let bookmarks: unknown[] = [];
    let notes: unknown[] = [];
    let loaded = 0;

    try {
      const transaction = database.transaction(getStoreNames([]), "readonly");
      const requests = [
        ["progress", transaction.objectStore("progress").getAll()],
        ["bookmarks", transaction.objectStore("bookmarks").getAll()],
        ["notes", transaction.objectStore("notes").getAll()]
      ] as const;

      for (const [storeName, request] of requests) {
        request.onsuccess = () => {
          if (storeName === "progress") progress = request.result as unknown[];
          if (storeName === "bookmarks") bookmarks = request.result as unknown[];
          if (storeName === "notes") notes = request.result as unknown[];
          loaded += 1;
        };
        request.onerror = () => reject(mapLaoZhaoStorageError(request.error, "read"));
      }

      transaction.oncomplete = () => {
        if (loaded === requests.length) resolve({ progress, bookmarks, notes });
        else reject(new LaoZhaoLocalError("operation-failed", "read", "本機資料讀取不完整。"));
      };
      transaction.onerror = () => reject(mapLaoZhaoStorageError(transaction.error, "read"));
      transaction.onabort = () => reject(mapLaoZhaoStorageError(transaction.error, "read"));
    } catch (error) {
      reject(mapLaoZhaoStorageError(error, "read"));
    }
  }));
}

export async function writeStore<T>(
  storeName: LaoZhaoLocalStore,
  operation: (
    store: IDBObjectStore,
    setResult: (result: T) => void,
    fail: (error: unknown) => void
  ) => void
): Promise<T> {
  return withDatabaseRetry((database) => new Promise<T>((resolve, reject) => {
    let result: T;
    let hasResult = false;
    let settled = false;
    let transaction: IDBTransaction;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(mapLaoZhaoStorageError(error, "write"));
    };

    try {
      transaction = database.transaction(storeName, "readwrite");
      transaction.oncomplete = () => {
        if (settled) return;
        if (!hasResult) {
          fail(new LaoZhaoLocalError("operation-failed", "write", "本機資料寫入沒有回傳結果。"));
          return;
        }
        settled = true;
        resolve(result);
      };
      transaction.onerror = () => fail(transaction.error);
      transaction.onabort = () => fail(transaction.error);
      operation(
        transaction.objectStore(storeName),
        (nextResult) => {
          result = nextResult;
          hasResult = true;
        },
        fail
      );
    } catch (error) {
      fail(error);
    }
  }));
}

export async function clearAllStores() {
  return withDatabaseRetry((database) => new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(mapLaoZhaoStorageError(error, "clear"));
    };

    try {
      const transaction = database.transaction(getStoreNames([]), "readwrite");
      for (const storeName of getStoreNames([])) {
        transaction.objectStore(storeName).clear();
      }
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      transaction.onerror = () => fail(transaction.error);
      transaction.onabort = () => fail(transaction.error);
    } catch (error) {
      fail(error);
    }
  }));
}

export function resetLaoZhaoDatabaseConnectionForTests() {
  if (databaseInstance) closeDatabaseConnection(databaseInstance);
  else databasePromise = null;
}
