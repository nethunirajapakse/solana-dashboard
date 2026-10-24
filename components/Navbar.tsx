"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { usePersistedList } from "@/hooks/usePersistedList";
import { watchlist } from "@/lib/stores";

const LINKS = [
  { href: "/", label: "Trending" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/wallet", label: "Wallet" },
  { href: "/phantom", label: "Phantom" },
];

export default function Navbar() {
  const pathname = usePathname();
  const watchCount = usePersistedList(watchlist).length;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Solana Dashboard
        </Link>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map((link) => {
            const isActive =
              link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            const count = link.href === "/watchlist" ? watchCount : 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
                {count > 0 && <span className="nav-badge">{count}</span>}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
