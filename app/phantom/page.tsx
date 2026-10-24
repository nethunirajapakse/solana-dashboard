"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import SaveWalletButton from "@/components/SaveWalletButton";

const PHANTOM_STORE_URL =
  "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa?hl=en";

// Phantom injects itself as window.solana (and, on newer versions,
// window.phantom.solana). We only declare the handful of members we
// actually touch rather than pulling in the full @solana/web3.js types.
type PhantomKey = { toString: () => string };
interface PhantomProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PhantomKey }>;
  disconnect: () => Promise<void>;
  on?: (event: string, handler: (arg?: PhantomKey | null) => void) => void;
  off?: (event: string, handler: (arg?: PhantomKey | null) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

type Detection = "checking" | "found" | "missing";

export default function PhantomPage() {
  const [detection, setDetection] = useState<Detection>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Phantom injects its provider asynchronously, so poll briefly before
  // concluding it isn't installed.
  useEffect(() => {
    let attempts = 0;
    const id = window.setInterval(() => {
      if (getPhantomProvider()) {
        setDetection("found");
        window.clearInterval(id);
      } else if (++attempts >= 10) {
        setDetection("missing");
        window.clearInterval(id);
      }
    }, 150);
    return () => window.clearInterval(id);
  }, []);

  // Once found: silently restore a previously-approved connection (no
  // popup), and follow the extension when the user switches accounts or
  // disconnects from inside Phantom.
  useEffect(() => {
    if (detection !== "found") return;
    const provider = getPhantomProvider();
    if (!provider) return;

    let cancelled = false;
    provider
      .connect({ onlyIfTrusted: true })
      .then((resp) => {
        if (!cancelled) setPublicKey(resp.publicKey.toString());
      })
      .catch(() => {
        // Not previously approved: wait for the user to click Connect.
      });

    const onAccountChanged = (key?: PhantomKey | null) =>
      setPublicKey(key ? key.toString() : null);
    const onDisconnect = () => setPublicKey(null);
    provider.on?.("accountChanged", onAccountChanged);
    provider.on?.("disconnect", onDisconnect);

    return () => {
      cancelled = true;
      provider.off?.("accountChanged", onAccountChanged);
      provider.off?.("disconnect", onDisconnect);
    };
  }, [detection]);

  async function handleConnect() {
    const provider = getPhantomProvider();
    if (!provider) {
      setDetection("missing");
      return;
    }
    setConnecting(true);
    setErrorMessage("");
    try {
      const resp = await provider.connect();
      setPublicKey(resp.publicKey.toString());
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : "Connection was rejected."
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await getPhantomProvider()?.disconnect();
    } finally {
      setPublicKey(null);
    }
  }

  return (
    <>
      <div className="eyebrow">Wallet connect</div>
      <h1 className="page-title">Phantom wallet</h1>
      <p className="page-subtitle">
        Connect your Phantom browser extension to open your own portfolio. This
        is read-only: the app only sees your public address and can never move
        funds or request signatures.
      </p>

      <div className="phantom-panel">
        {detection === "checking" && (
          <div role="status">
            <div className="spinner" aria-hidden="true" />
            Checking for Phantom…
          </div>
        )}

        {detection === "missing" && (
          <>
            <div className="phantom-ghost" aria-hidden="true">👻</div>
            <p>
              Install the Phantom wallet extension in Chrome to use this
              feature.
            </p>
            <a
              className="install-link"
              href={PHANTOM_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Phantom from the Chrome Web Store →
            </a>
            <p className="muted-note">
              No extension? You can still{" "}
              <Link href="/wallet" className="install-link">
                look up any wallet by address
              </Link>
              .
            </p>
          </>
        )}

        {detection === "found" && !publicKey && (
          <>
            <div className="phantom-ghost" aria-hidden="true">👻</div>
            <p>Phantom is installed. Connect to open your portfolio.</p>
            <button
              type="button"
              className="connect-button"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect Phantom"}
            </button>
            {errorMessage && (
              <div className="field-error" role="alert" style={{ marginTop: 16 }}>
                {errorMessage}
              </div>
            )}
          </>
        )}

        {detection === "found" && publicKey && (
          <>
            <div className="phantom-ghost" aria-hidden="true">👻</div>
            <p>Connected. Your public address:</p>
            <div className="phantom-key">{publicKey}</div>
            <div className="action-row center">
              <Link href={`/wallet/${publicKey}`} className="connect-button as-link">
                View my portfolio →
              </Link>
            </div>
            <div className="action-row center">
              <CopyButton value={publicKey} label="Copy your public address" />
              <SaveWalletButton address={publicKey} />
              <button type="button" className="ghost-button small" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
