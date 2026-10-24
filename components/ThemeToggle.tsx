"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const LABEL: Record<ThemeChoice, string> = { system: "Auto", light: "Light", dark: "Dark" };

const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Applies the choice to <html>; "system" removes the override so the OS setting wins. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export default function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: still apply for this page view */
    }
    applyTheme(next);
    listeners.forEach((l) => l());
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[choice]}. Click to change.`}
      title="Switch theme: Auto, Light, Dark"
    >
      {LABEL[choice]}
    </button>
  );
}
