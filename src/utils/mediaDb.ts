const DB_NAME = 'MotionFluxMediaDB_v2';
const STORE_NAME = 'mediaFiles';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMediaFile(id: string, file: File | Blob): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save file in IndexedDB:', err);
  }
}

export async function getMediaFile(id: string): Promise<File | Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get file from IndexedDB:', err);
    return null;
  }
}

export async function deleteMediaFile(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete file from IndexedDB:', err);
  }
}

export async function restoreProjectMediaUrls(project: any): Promise<any> {
  if (!project) return project;
  
  // Restore media items
  if (project.media) {
    for (const item of project.media) {
      if (item.type !== 'text' && item.type !== 'shape') {
        const file = await getMediaFile(item.id);
        if (file) {
          // Re-create object URL
          item.dataUrl = URL.createObjectURL(file);
          item.file = file as File; // restore file object reference too!
        }
      }
    }
  }
  
  // Restore clips
  if (project.clips) {
    for (const clip of project.clips) {
      if (clip.type !== 'text' && clip.type !== 'shape') {
        const file = await getMediaFile(clip.id);
        if (file) {
          clip.dataUrl = URL.createObjectURL(file);
          clip.file = file as File;
        } else if (project.media) {
          // Fallback to media item
          const matchedMedia = project.media.find((m: any) => m.name === clip.name && m.type === clip.type);
          if (matchedMedia) {
            const mediaFile = await getMediaFile(matchedMedia.id);
            if (mediaFile) {
              clip.dataUrl = URL.createObjectURL(mediaFile);
              clip.file = mediaFile as File;
            }
          }
        }
      }
    }
  }
  
  return project;
}
