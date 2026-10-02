/**
 * How shared collections (diaries, photos, cards, anniversaries, plans, Dating Fees, calendar
 * notes) are reconciled between the two phones and the room document in the cloud.
 *
 * The rule that keeps writing safe: an item only ever leaves a list because someone deleted it.
 * Deleting leaves a tombstone (id -> when) in the room, and tombstones travel alongside the data.
 * Anything without a tombstone is kept — even when the cloud's copy of the list happens not to
 * contain it — because "not in the cloud yet" is far more often "not uploaded yet" (a slow or
 * failed write, the other phone overwriting the list, the app reloading too soon) than "deleted".
 *
 * The one exception is an item this phone has already SEEN in the cloud that has since gone
 * without a tombstone: that was a delete made by an older version of the app (which deleted by
 * rewriting the list) while this phone was away, and following the cloud there is right.
 */

export type Tombstones = Record<string, number>; // item id -> deletedAt (ms)

/** Last-modified time of an item, from whichever timestamp field it carries. */
export function getItemTimestamp(item: any): number {
  if (!item) return 0;
  if (typeof item.updatedAt === 'number' && !isNaN(item.updatedAt) && item.updatedAt > 0) return item.updatedAt;
  if (typeof item.createdAt === 'number' && !isNaN(item.createdAt) && item.createdAt > 0) return item.createdAt;
  if (typeof item.timestamp === 'number' && !isNaN(item.timestamp) && item.timestamp > 0) return item.timestamp;
  if (typeof item.sentAt === 'number' && !isNaN(item.sentAt) && item.sentAt > 0) return item.sentAt;
  if (typeof item.date === 'number' && !isNaN(item.date) && item.date > 0) return item.date;
  if (typeof item.date === 'string' && item.date) {
    const t = new Date(item.date).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Every deletion the room knows about: the durable `tombstones` map, plus the two fields older
 * versions of the app used (`deletedItemIds`, and `deletedId` — which only ever held the latest).
 */
export function readTombstones(doc: any): Tombstones {
  const out: Tombstones = {};
  if (doc?.tombstones && typeof doc.tombstones === 'object') {
    for (const [id, at] of Object.entries(doc.tombstones)) out[id] = Number(at) || 1;
  }
  if (Array.isArray(doc?.deletedItemIds)) for (const id of doc.deletedItemIds) if (typeof id === 'string' && !out[id]) out[id] = 1;
  if (typeof doc?.deletedId === 'string' && doc.deletedId && !out[doc.deletedId]) out[doc.deletedId] = 1;
  return out;
}

const hasId = (item: any): item is { id: string } => !!item && typeof item.id === 'string' && item.id.length > 0;

/**
 * Two versions of one list made into one: every item from either side, the newer copy of an item
 * that is on both (ties go to `b`), and nothing that has a tombstone. Order follows `b`, then
 * whatever only `a` had. Used when writing: `a` = the cloud's list, `b` = this phone's.
 */
export function mergeCollections<T>(a: T[] = [], b: T[] = [], tombstones: Tombstones = {}): T[] {
  const byId = new Map<string, T>();
  for (const item of b) if (hasId(item) && !tombstones[item.id]) byId.set(item.id, item);
  const onlyA: T[] = [];
  for (const item of a) {
    if (!hasId(item) || tombstones[item.id]) continue;
    const mine = byId.get(item.id);
    if (!mine) onlyA.push(item);
    else if (getItemTimestamp(item) > getItemTimestamp(mine)) byId.set(item.id, item);
  }
  return [...byId.values(), ...onlyA];
}

export interface IncomingMerge<T> {
  merged: T[];
  /** Items this phone holds that the cloud lacks or has an older copy of — they must be uploaded. */
  unsynced: T[];
  /** Ids now seen in the cloud (to remember as confirmed). */
  remoteIds: string[];
}

/**
 * The cloud's list arriving on this phone. Nothing local is thrown away unless it was deleted
 * (tombstoned), or it was seen in the cloud before and is gone now (see the header comment).
 */
export function mergeIncoming<T>(local: T[] = [], remote: T[] = [], tombstones: Tombstones = {}, confirmed: Set<string> = new Set()): IncomingMerge<T> {
  const remoteById = new Map<string, T>();
  for (const item of remote) if (hasId(item) && !tombstones[item.id]) remoteById.set(item.id, item);

  const unsynced: T[] = [];
  const localWins = new Map<string, T>();
  const localOnly: T[] = [];
  for (const item of local) {
    if (!hasId(item) || tombstones[item.id]) continue;
    const theirs = remoteById.get(item.id);
    if (theirs) {
      if (getItemTimestamp(item) > getItemTimestamp(theirs)) {
        localWins.set(item.id, item); // an edit here the cloud hasn't got yet
        unsynced.push(item);
      }
    } else if (!confirmed.has(item.id)) {
      localOnly.push(item); // written here, not uploaded yet: keep it, and upload it
      unsynced.push(item);
    }
  }

  const merged = [...Array.from(remoteById.values()).map((r) => localWins.get((r as any).id) ?? r), ...localOnly];
  return { merged, unsynced, remoteIds: Array.from(remoteById.keys()) };
}
