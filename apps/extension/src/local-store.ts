const DATABASE = "candidate-phase0";
const VERSION = 1;
const STORE = "records";

async function openDatabase(factory: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      // Local schema migration v1. Future changes must increment VERSION.
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(new Error("Local IndexedDB could not be opened."));
    request.onblocked = () => reject(new Error("Local storage upgrade is blocked by another workspace. Close it and retry."));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** Each transaction closes its connection. No durable state relies on worker/page globals. */
export function localStore(factory: IDBFactory = indexedDB) {
  async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
    const database = await openDatabase(factory);
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      let request: IDBRequest<T>;
      try { request = work(tx.objectStore(STORE)); }
      catch { database.close(); tx.abort(); reject(new Error("Local state could not be cloned or saved.")); return; }
      tx.oncomplete = () => { database.close(); resolve(request.result); };
      tx.onabort = () => { database.close(); reject(new Error("Local state transaction failed; no saved result is confirmed.")); };
      tx.onerror = () => { /* onabort reports the final result */ };
    });
  }
  return {
    async get<T>(key: string): Promise<T | undefined> { return transaction("readonly", store => store.get(key)); },
    async put<T>(key: string, value: T) { await transaction("readwrite", store => store.put(value, key)); },
    async add<T>(key: string, value: T) { await transaction("readwrite", store => store.add(value, key)); },
    async addWithPointer<T>(key: string, value: T, pointer: string, id: string) {
      await transaction("readwrite", store => { store.add(value, key); return store.put(id, pointer); });
    },
    async merge<T extends object>(key: string, defaults: T, patch: Partial<T>): Promise<T> {
      let merged = defaults;
      await transaction("readwrite", store => {
        const request = store.get(key);
        request.onsuccess = () => { merged = { ...defaults, ...request.result, ...patch }; store.put(merged, key); };
        return request;
      });
      return merged;
    },
    async remove(key: string) { await transaction("readwrite", store => store.delete(key)); },
  };
}

export const DIRECTORY_KEY = "archive-directory";
