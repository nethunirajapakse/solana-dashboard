"use client";

import { useEffect, useState } from "react";

const PHANTOM_STORE_URL =
  "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa?hl=en";

// Phantom injects itself as window.solana (and, on newer versions,
// window.phantom.solana). We only declare the handful of members we
// actually touch rather than pulling in the full @solana/web3.js types.
interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
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

type Status = "checking" | "not-installed" | "installed" | "connecting" | "connected" | "error";

export default function PhantomPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [publicKey, setPublicKey] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Phantom injects its provider asynchronously, so we check once
    // immediately and once more on window load in case the extension
    // hasn't finished injecting yet.
    const check = () => {
      setStatus(getPhantomProvider() ? "installed" : "not-installed");
    };
    check();
    window.addEventListener("load", check);
    return () => window.removeEventListener("load", check);
  }, []);

  async function handleConnect() {
    const provider = getPhantomProvider();
    if (!provider) {
      setStatus("not-installed");
      return;
    }

    setStatus("connecting");
    try {
      const resp = await provider.connect();
      setPublicKey(resp.publicKey.toString());
      setStatus("connected");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Connection was rejected."
      );
      setStatus("error");
    }
  }

  return (
    <>
      <div className="eyebrow">Wallet connect</div>
      <h1 className="page-title">Phantom wallet</h1>
      <p className="page-subtitle">
        Connect your Phantom browser extension to view your public key.
      </p>

      <div className="phantom-panel">
        {status === "checking" && (
          <>
            <div className="spinner" />
            Checking for Phantom…
          </>
        )}

        {status === "not-installed" && (
          <>
            <div className="phantom-ghost">👻</div>
            <p>
              Install Phantom Wallet extension on Google Chrome to use this
              feature
            </p>
            <a
              className="install-link"
              href={PHANTOM_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Phantom from the Chrome Web Store →
            </a>
          </>
        )}

        {(status === "installed" ||
          status === "connecting" ||
          status === "error") && (
          <>
            <div className="phantom-ghost">👻</div>
            <p>Phantom is installed. Connect to view your public key.</p>
            <button
              className="connect-button"
              onClick={handleConnect}
              disabled={status === "connecting"}
            >
              {status === "connecting" ? "Connecting…" : "Connect Phantom"}
            </button>
            {status === "error" && (
              <div className="field-error" style={{ marginTop: 16 }}>
                {errorMessage}
              </div>
            )}
          </>
        )}

        {status === "connected" && (
          <>
            <div className="phantom-ghost">👻</div>
            <p>Connected. Your public key:</p>
            <div className="phantom-key">{publicKey}</div>
          </>
        )}
      </div>
    </>
  );
}
