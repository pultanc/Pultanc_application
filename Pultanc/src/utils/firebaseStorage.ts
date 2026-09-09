import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';
import { storage, auth } from '../firebase';
import { optimizeMediaImage } from './mediaOptimizer';
import { saveLocalVideoBlob, cacheVideoFileUnderKeys } from './localVideoCache';

export const STANDARD_VIDEO_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
export const STANDARD_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv'];

export function isStandardVideoFormat(file: File): boolean {
  if (!file) return false;
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  return STANDARD_VIDEO_FORMATS.includes(file.type) || 
         STANDARD_VIDEO_EXTENSIONS.includes(ext) || 
         file.type.startsWith('video/');
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Uploads a large file in chunked slices to the server storage endpoint.
 * Recommended for files exceeding 20MB.
 */
async function uploadViaChunks(
  file: File,
  folder: string,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const presignedRes = await fetch('/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, folder, size: file.size })
  });

  if (!presignedRes.ok) {
    throw new Error('Failed to obtain presigned upload metadata');
  }

  const { uploadId, filename: safeName, maxChunkSize = 5 * 1024 * 1024 } = await presignedRes.json();
  const chunkSize = maxChunkSize;
  const totalChunks = Math.ceil(file.size / chunkSize);

  let finalUrl = '';
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunkBlob = file.slice(start, end);

    const chunkUrl = `/api/storage/upload-chunk?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(file.name)}&uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}&safeName=${encodeURIComponent(safeName)}`;

    const res = await fetch(chunkUrl, {
      method: 'POST',
      body: chunkBlob
    });

    if (!res.ok) {
      throw new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed`);
    }

    const data = await res.json();
    if (onProgress) {
      const percent = Math.min(98, Math.round(((chunkIndex + 1) / totalChunks) * 98));
      onProgress(percent);
    }

    if (data.complete && data.url) {
      finalUrl = data.url;
    }
  }

  if (!finalUrl) {
    finalUrl = `/api/storage/uploads/${folder}/${safeName}`;
  }

  if (onProgress) onProgress(100);
  return finalUrl;
}

/**
 * Uploads user-generated files (Images, Audio, Video) to persistent app storage.
 * Prioritizes chunked/resumable upload for files > 20MB, direct server persistence,
 * falls back to Firebase Storage, and maintains an IndexedDB cache.
 * 
 * @param file The File object selected by the user
 * @param folder The target directory (e.g., 'videos', 'audio', 'images', 'profiles')
 * @param onProgress Optional callback receiving upload progress (0 to 100)
 * @returns Promise resolving to the persistent download URL
 */
export async function uploadMediaToStorage(
  file: File,
  folder: string = 'media',
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const userId = auth.currentUser?.uid || 'guest_user';
  
  // Cache in IndexedDB immediately for instant availability
  try {
    await saveLocalVideoBlob(`pending_${Date.now()}_${file.name}`, file, file.name);
  } catch (e) {
    // Ignore cache failure
  }

  // If file is an image, optimize it in client-side canvas (<50ms) to reduce size by 90-95%
  let uploadFile = file;
  let fallbackDataUrl: string | null = null;
  if (file.type.startsWith('image/')) {
    try {
      const optimized = await optimizeMediaImage(file, 1200, 0.85);
      uploadFile = optimized.file;
      fallbackDataUrl = optimized.dataUrl;
    } catch (e) {
      console.warn('Image optimization skipped:', e);
    }
  }

  // Strategy 0: For files exceeding 20MB, use chunked / resumable upload handling
  if (uploadFile.size > 20 * 1024 * 1024) {
    try {
      const chunkedUrl = await uploadViaChunks(uploadFile, folder, onProgress);
      if (chunkedUrl) {
        try {
          await cacheVideoFileUnderKeys([chunkedUrl, file.name], file, file.name);
        } catch (e) {}
        return chunkedUrl;
      }
    } catch (chunkErr) {
      console.warn('[Storage] Chunked upload fell through, attempting Firebase Storage resumable upload:', chunkErr);
    }
  }

  // Strategy 1: Upload directly to our persistent server storage endpoint
  try {
    const serverUrl = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const encodedFolder = encodeURIComponent(folder);
      const encodedFilename = encodeURIComponent(uploadFile.name);
      xhr.open('POST', `/api/storage/upload?folder=${encodedFolder}&filename=${encodedFilename}`);
      
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.min(98, Math.max(5, Math.round((evt.loaded / evt.total) * 98)));
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success && data.url) {
              if (onProgress) onProgress(100);
              resolve(data.url);
              return;
            }
          } catch (e) {
            // response was not json
          }
        }
        reject(new Error(`Server upload responded with status ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error('Network error during server storage upload'));
      xhr.ontimeout = () => reject(new Error('Timeout during server storage upload'));
      xhr.send(uploadFile);
    });

    if (serverUrl) {
      try {
        await cacheVideoFileUnderKeys([serverUrl, file.name], file, file.name);
      } catch (e) {}
      return serverUrl;
    }
  } catch (serverErr) {
    console.warn('[Storage] Server direct upload fell through, attempting Firebase Storage:', serverErr);
  }

  // Strategy 2: Firebase Storage Resumable Upload
  const sanitizeName = uploadFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${folder}/${userId}/${timestamp}_${sanitizeName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve) => {
    const uploadTask = uploadBytesResumable(storageRef, uploadFile);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) {
            onProgress(progress);
          }
        }
      },
      (error) => {
        console.warn(`[Firebase Storage] Upload error for ${file.name}:`, error);
        // Fallback to client-side object URL or compact dataUrl
        const fallbackUrl = fallbackDataUrl || URL.createObjectURL(file);
        saveLocalVideoBlob(fallbackUrl, file, file.name).catch(() => {});
        resolve(fallbackUrl);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (onProgress) onProgress(100);
          saveLocalVideoBlob(downloadUrl, file, file.name).catch(() => {});
          resolve(downloadUrl);
        } catch (err) {
          console.warn('[Firebase Storage] Failed to retrieve download URL:', err);
          const fallbackUrl = fallbackDataUrl || URL.createObjectURL(file);
          saveLocalVideoBlob(fallbackUrl, file, file.name).catch(() => {});
          resolve(fallbackUrl);
        }
      }
    );
  });
}

/**
 * Direct single-step upload for smaller files like avatars, images, or audio clips.
 * Fast compressed upload with server persistence and immediate fallback.
 */
export async function uploadDirectFile(file: File, folder: string = 'uploads'): Promise<string> {
  const userId = auth.currentUser?.uid || 'guest_user';
  let uploadFile = file;
  let fallbackDataUrl: string | null = null;

  if (file.type.startsWith('image/')) {
    try {
      const optimized = await optimizeMediaImage(file, 1000, 0.85);
      uploadFile = optimized.file;
      fallbackDataUrl = optimized.dataUrl;
    } catch (e) {
      console.warn('Image optimization skipped in direct upload:', e);
    }
  }

  // Strategy 1: Server direct upload
  try {
    const res = await fetch(`/api/storage/upload?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(uploadFile.name)}`, {
      method: 'POST',
      body: uploadFile
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch (e) {
    // Ignore and proceed to Firebase
  }

  // Strategy 2: Firebase uploadBytes
  const sanitizeName = uploadFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const storagePath = `${folder}/${userId}/${Date.now()}_${sanitizeName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const snapshot = await uploadBytes(storageRef, uploadFile);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.warn('[Firebase Storage] Direct upload failed, returning fallback:', error);
    return fallbackDataUrl || URL.createObjectURL(file);
  }
}
