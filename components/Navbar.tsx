"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Trending" },
  { href: "/wallet", label: "Wallet" },
  { href: "/phantom", label: "Phantom" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand">
          <span className="brand-dot" />
          Solana Dashboard
        </Link>
        <nav className="nav-links">
          {LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${isActive ? " active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
