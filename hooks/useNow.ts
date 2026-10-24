"use client";

import { useEffect, useState } from "react";

/** Current time, re-rendered every `intervalMs` (for "updated 12s ago" labels). */
export function useNow(intervalMs: number = 5_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
