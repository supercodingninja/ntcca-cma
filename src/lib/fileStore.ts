// ==========================================================================
// This Area Of Code Is: The IndexedDB File Store — real file uploads.
// Explanation: Audio and video files the team uploads are stored as binary
// blobs in the device's IndexedDB (way bigger than localStorage, fully
// offline). Songs reference them as "idb://<id>", and the player resolves
// that to a playable object URL at runtime. Local-first: files live on the
// device, no server required.
// In Other Words: The app has its own hard drive for your recordings.
// ==========================================================================

const DB_NAME = 'ntcca-files';
const STORE = 'blobs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a file, return its "idb://<id>" reference. */
export async function storeFile(file: File): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return `idb://${id}`;
}

/** Resolve an "idb://" reference to a playable object URL (or null). */
export async function resolveFileUrl(ref: string): Promise<string | null> {
  if (!ref.startsWith('idb://')) return ref;
  const db = await openDB();
  const blob = await new Promise<Blob | null>((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(ref.slice(6));
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
  return blob ? URL.createObjectURL(blob) : null;
}
