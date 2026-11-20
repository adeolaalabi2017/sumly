import type { MetadataRoute } from "next";

export const dynamic = "force-static";
import { DOMAINS, PROFESSIONS, TOOLS } from "@/lib/registry";
import { LEGAL_UPDATED } from "@/lib/legal-dates";
import {
  domainLastModified,
  homeLastModified,
  professionLastModified,
  toolLastModified,
} from "@/lib/lastmod";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sumly.cc";

  // Root landing page
  const rootRoute: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: homeLastModified(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...(["privacy", "terms"] as const).map((path) => ({
      url: `${baseUrl}/${path}`,
      lastModified: new Date(`${LEGAL_UPDATED[path]}T00:00:00Z`),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  // Every live domain
  const domainRoutes: MetadataRoute.Sitemap = DOMAINS.map((d) => ({
    url: `${baseUrl}/${d.slug}`,
    lastModified: domainLastModified(d.slug),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Profession hubs
  const professionRoutes: MetadataRoute.Sitemap = PROFESSIONS.map((p) => ({
    url: `${baseUrl}/professions/${p.slug}`,
    lastModified: professionLastModified(p.slug),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Every tool page
  const toolRoutes: MetadataRoute.Sitemap = TOOLS.map((t) => ({
    url: `${baseUrl}/${t.domain}/${t.slug}`,
    lastModified: toolLastModified(t.slug),
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  return [...rootRoute, ...domainRoutes, ...professionRoutes, ...toolRoutes];
}
