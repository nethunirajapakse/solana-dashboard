import type { MetadataRoute } from "next";

// Crawlers have no reason to hit /api (it spends upstream quota).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
