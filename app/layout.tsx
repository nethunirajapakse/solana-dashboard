import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const description =
  "Track trending Solana tokens, build a watchlist, and inspect any wallet's holdings. Free, no account needed.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Solana Dashboard", template: "%s · Solana Dashboard" },
  description,
  openGraph: {
    title: "Solana Dashboard",
    description,
    type: "website",
    siteName: "Solana Dashboard",
  },
  twitter: { card: "summary", title: "Solana Dashboard", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply a saved theme before first paint to avoid a light/dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}',
          }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes into <body> before React hydrates. Only silences this
          element's own attributes, not its children. */}
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="page">
          {children}
        </main>
        <Footer />
        {/* Cookieless page-view analytics. Vercel-only: elsewhere its script
            endpoint doesn't exist and would just 404. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
