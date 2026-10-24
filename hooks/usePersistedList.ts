"use client";

import { useSyncExternalStore } from "react";
import type { PersistedList } from "@/lib/persistedList";

export function usePersistedList<T>(list: PersistedList<T>): readonly T[] {
  return useSyncExternalStore(list.subscribe, list.getSnapshot, list.getServerSnapshot);
}
