import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state-block">
      <h1 className="page-title" style={{ fontSize: 20 }}>
        Page not found
      </h1>
      <p>That page doesn&apos;t exist.</p>
      <Link href="/" className="install-link">
        Back to trending tokens →
      </Link>
    </div>
  );
}
