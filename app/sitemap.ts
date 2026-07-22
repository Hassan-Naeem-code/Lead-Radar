import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fresh-leads.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/login", priority: 0.5 },
    { path: "/signup", priority: 0.8 },
    { path: "/privacy", priority: 0.4 },
    { path: "/terms", priority: 0.4 },
  ];
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: p.priority,
  }));
}
