import type { Tool } from "./registry/types";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Where the per-tool Open Graph image is served. */
export const ogImagePath = (t: Pick<Tool, "domain" | "slug">) => `/${t.domain}/${t.slug}/opengraph-image`;

/**
 * Alt text for a tool's social preview. The image shows the tool name, its
 * tagline, the domain and the Sumly mark, so the alt says the same in a sentence.
 */
export function ogAlt(t: Pick<Tool, "name" | "tagline">): string {
  const tagline = t.tagline.trim();
  const end = /[.!?]$/.test(tagline) ? "" : ".";
  return `Sumly: ${t.name}. ${tagline}${end}`;
}
