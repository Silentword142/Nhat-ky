import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Big inline images (diary photos, card drawings, avatars — base64 `data:` URLs) are kept OUT of
 * the room document. The whole room lives in one Firestore document, and Firestore refuses any
 * write that would take a document past 1 MiB: a handful of diary photos inline was enough to
 * make every later save fail — silently — so new pages never reached the cloud and vanished.
 *
 * Each image is stored once in its own document, rooms/{room}/blobs/{hash} (named by its
 * content, so the same picture is never stored twice), and the room document carries only a
 * short reference to it. Reading resolves references back into the images, so the rest of the
 * app keeps seeing plain data URLs exactly as before.
 */

export const BLOB_REF_PREFIX = 'lsblob:';
/** Inline strings at least this long are moved out of the room document. */
const OFFLOAD_MIN_CHARS = 20_000;
/** A blob document has the same 1 MiB cap; anything bigger can't sync at all (it stays on this device). */
const BLOB_MAX_CHARS = 900_000;

const memory = new Map<string, string>(); // hash -> data URL
const pending = new Map<string, Promise<string | null>>();

const uploadedKey = (room: string) => `lovesync_blobs_uploaded_${room}`;
const uploadedCache = new Map<string, Set<string>>();
const uploadedFor = (room: string) => {
  let set = uploadedCache.get(room);
  if (!set) {
    try {
      set = new Set<string>(JSON.parse(localStorage.getItem(uploadedKey(room)) || '[]'));
    } catch {
      set = new Set<string>();
    }
    uploadedCache.set(room, set);
  }
  return set;
};
const markUploaded = (room: string, hash: string) => {
  const set = uploadedFor(room);
  if (set.has(hash)) return;
  set.add(hash);
  try {
    localStorage.setItem(uploadedKey(room), JSON.stringify(Array.from(set)));
  } catch {
    // only an optimisation: at worst an image is uploaded again, harmlessly
  }
};

/** cyrb53 — a fast 53-bit string hash; with the length appended, collisions are not a practical concern here. */
const hashString = (str: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}${str.length.toString(36)}`;
};

const blobDoc = (room: string, hash: string) => doc(db, 'rooms', room, 'blobs', hash);

const offloadString = async (value: string, room: string): Promise<string> => {
  if (!value.startsWith('data:') || value.length < OFFLOAD_MIN_CHARS) return value;
  if (value.length > BLOB_MAX_CHARS) return ''; // too big to sync anywhere; this device keeps its copy
  const hash = hashString(value);
  memory.set(hash, value);
  if (!uploadedFor(room).has(hash)) {
    // Upload first and only then hand back the reference: a reference must never reach the room
    // before the image it points to exists. A failure here throws, so the caller doesn't write.
    await setDoc(blobDoc(room, hash), { data: value, size: value.length, createdAt: Date.now() });
    markUploaded(room, hash);
  }
  return `${BLOB_REF_PREFIX}${hash}`;
};

/** A copy of `value` with every big inline image replaced by a reference (uploading the images first). */
export async function offloadInlineImages<T>(value: T, room: string): Promise<T> {
  if (typeof value === 'string') return (await offloadString(value, room)) as unknown as T;
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => offloadInlineImages(v, room)))) as unknown as T;
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([k, v]) => [k, await offloadInlineImages(v, room)] as const));
    return Object.fromEntries(entries) as T;
  }
  return value;
}

const fetchBlob = (room: string, hash: string): Promise<string | null> => {
  const known = memory.get(hash);
  if (known) return Promise.resolve(known);
  let p = pending.get(hash);
  if (!p) {
    p = getDoc(blobDoc(room, hash))
      .then((snap) => {
        const data = snap.exists() ? (snap.data() as { data?: string }).data : undefined;
        if (typeof data === 'string') {
          memory.set(hash, data);
          markUploaded(room, hash); // it's in the cloud: never upload it again from here
          return data;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => pending.delete(hash));
    pending.set(hash, p);
  }
  return p;
};

/** A copy of `value` with every image reference replaced by the image. Unreachable ones stay as references and are retried next time. */
export async function resolveImageRefs<T>(value: T, room: string): Promise<T> {
  if (typeof value === 'string') {
    if (!value.startsWith(BLOB_REF_PREFIX)) return value;
    return ((await fetchBlob(room, value.slice(BLOB_REF_PREFIX.length))) ?? value) as unknown as T;
  }
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => resolveImageRefs(v, room)))) as unknown as T;
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([k, v]) => [k, await resolveImageRefs(v, room)] as const));
    return Object.fromEntries(entries) as T;
  }
  return value;
}
