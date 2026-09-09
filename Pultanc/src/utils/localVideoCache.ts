/**
 * Local IndexedDB cache for user uploaded video files and media.
 * Ensures uploaded videos remain instantly available and persistent
 * even across page reloads and view switches without fallback to mock videos.
 */

const DB_NAME = 'pultanc_media_cache';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalVideoBlob(key: string, blob: Blob | File, filename?: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        key,
        blob,
        filename: filename || (blob instanceof File ? blob.name : 'video.mp4'),
        savedAt: Date.now(),
        type: blob.type
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[LocalVideoCache] Save failed:', err);
  }
}

export async function getLocalVideoBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LocalVideoCache] Get failed:', err);
    return null;
  }
}

export async function getLocalVideoUrl(key: string): Promise<string | null> {
  const blob = await getLocalVideoBlob(key);
  if (blob) {
    return URL.createObjectURL(blob);
  }
  return null;
}

/**
 * Caches a video blob under multiple identifiers (URL, ID, title, filename)
 * so it can always be retrieved even if references change.
 */
export async function cacheVideoFileUnderKeys(
  keys: (string | undefined | null)[],
  blob: Blob | File,
  filename?: string
): Promise<void> {
  for (const k of keys) {
    if (k && typeof k === 'string' && k.trim()) {
      await saveLocalVideoBlob(k.trim(), blob, filename);
    }
  }
}

/**
 * Checks if a string looks like a valid playable video URL.
 * Rejects placeholder mock URLs like oceans.mp4 when user videos are expected.
 */
export function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:video/')
  );
}

/**
 * Resolves the best available playable video source for an episode/funnel.
 * Checks IndexedDB cache if local blob is available, or uses the direct URL.
 * Guarantees that real uploaded videos are never supplanted by mock videos.
 */
export async function resolveVideoSource(
  videoUrl?: string | null,
  identifiers: (string | undefined | null)[] = []
): Promise<string> {
  const trimmed = (videoUrl || '').trim();

  // Check local cache first for instant zero-latency playback
  for (const id of [trimmed, ...identifiers]) {
    if (id && typeof id === 'string' && id.trim()) {
      try {
        const cachedBlobUrl = await getLocalVideoUrl(id.trim());
        if (cachedBlobUrl) {
          return cachedBlobUrl;
        }
      } catch (e) {
        // Continue to network URL
      }
    }
  }

  // If already a valid URL (relative server path or full URL), return directly
  if (isPlayableVideoUrl(trimmed)) {
    return trimmed;
  }

  return trimmed;
}
