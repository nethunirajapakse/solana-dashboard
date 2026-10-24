// A small localStorage-backed list that React can subscribe to with
// useSyncExternalStore. It powers the watchlist, saved wallets and recent
// lookups - per-browser conveniences that need no account.
//
// Robustness notes (all of these fail in real browsers):
//   - localStorage can throw (private mode, blocked storage, quota): the
//     list then keeps working in memory for the session.
//   - stored JSON can be corrupt or from an older shape: every item is
//     validated with the schema and bad ones are dropped, not crashed on.
//   - other tabs can change the data: we listen for `storage` events.
//   - the server has no localStorage: getServerSnapshot returns a stable
//     empty list so hydration matches.

import type { z } from "zod";

export type AddResult = { ok: true } | { ok: false; reason: "limit" };

export interface PersistedList<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly T[];
  getServerSnapshot: () => readonly T[];
  /** Newest first. Existing ids are replaced (and moved to the front if `bumpExisting`). */
  add: (item: T) => AddResult;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<T>) => void;
  has: (id: string) => boolean;
  clear: () => void;
}

interface Options<T> {
  key: string;
  schema: z.ZodType<T>;
  idOf: (item: T) => string;
  max: number;
  /** What to do when full: refuse the new item, or drop the oldest one. */
  onFull: "reject" | "evict-oldest";
  bumpExisting?: boolean;
}

const EMPTY: readonly never[] = Object.freeze([]);

export function createPersistedList<T>(opts: Options<T>): PersistedList<T> {
  const { key, schema, idOf, max, onFull, bumpExisting = false } = opts;

  let items: readonly T[] | null = null; // null until first client read
  const listeners = new Set<() => void>();
  let storageListening = false;

  function readStorage(): T[] {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const valid: T[] = [];
      for (const candidate of parsed) {
        const result = schema.safeParse(candidate);
        if (result.success) valid.push(result.data);
      }
      return valid.slice(0, max);
    } catch {
      return [];
    }
  }

  function notify() {
    listeners.forEach((l) => l());
  }

  function commit(next: readonly T[]) {
    items = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable or full: keep the in-memory copy.
    }
    notify();
  }

  function current(): readonly T[] {
    if (items === null) items = readStorage();
    return items;
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== key) return;
    items = readStorage();
    notify();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (!storageListening && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
        storageListening = true;
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && storageListening) {
          window.removeEventListener("storage", onStorage);
          storageListening = false;
        }
      };
    },

    getSnapshot() {
      return typeof window === "undefined" ? EMPTY : current();
    },

    getServerSnapshot() {
      return EMPTY;
    },

    add(item) {
      const list = current();
      const id = idOf(item);
      const exists = list.some((x) => idOf(x) === id);

      if (exists) {
        const rest = list.filter((x) => idOf(x) !== id);
        commit(bumpExisting ? [item, ...rest] : list.map((x) => (idOf(x) === id ? item : x)));
        return { ok: true };
      }

      if (list.length >= max) {
        if (onFull === "reject") return { ok: false, reason: "limit" };
        commit([item, ...list.slice(0, max - 1)]);
        return { ok: true };
      }

      commit([item, ...list]);
      return { ok: true };
    },

    remove(id) {
      const list = current();
      if (!list.some((x) => idOf(x) === id)) return;
      commit(list.filter((x) => idOf(x) !== id));
    },

    update(id, patch) {
      const list = current();
      if (!list.some((x) => idOf(x) === id)) return;
      commit(list.map((x) => (idOf(x) === id ? { ...x, ...patch } : x)));
    },

    has(id) {
      return current().some((x) => idOf(x) === id);
    },

    clear() {
      commit([]);
    },
  };
}
