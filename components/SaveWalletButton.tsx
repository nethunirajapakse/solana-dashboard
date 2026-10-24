"use client";

import { usePersistedList } from "@/hooks/usePersistedList";
import { savedWallets } from "@/lib/stores";

export default function SaveWalletButton({ address }: { address: string }) {
  const items = usePersistedList(savedWallets);
  const saved = items.some((w) => w.address === address);

  function toggle() {
    if (saved) savedWallets.remove(address);
    else savedWallets.add({ address, label: "", savedAt: Date.now() });
  }

  return (
    <button
      type="button"
      className={`ghost-button small${saved ? " on" : ""}`}
      onClick={toggle}
      aria-pressed={saved}
    >
      {saved ? "Saved ✓" : "Save wallet"}
    </button>
  );
}
