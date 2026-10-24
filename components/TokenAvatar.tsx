"use client";

import { useState } from "react";

// Token images come from arbitrary third-party hosts and fail often.
// On error we swap to the initials fallback instead of leaving a broken image.
export default function TokenAvatar({
  image,
  symbol,
  large = false,
}: {
  image: string | null;
  symbol: string;
  large?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const size = large ? " token-avatar-large" : "";

  if (image && failedSrc !== image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className={`token-avatar${size}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(image)}
      />
    );
  }

  return (
    <div className={`token-avatar-fallback${size}`} aria-hidden="true">
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}
