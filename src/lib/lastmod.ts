import { createHash } from "node:crypto";
import { DOMAINS, PROFESSIONS, TOOLS, toolBySlug } from "./registry";
import { TOOL_CONTENT } from "./registry/tool-content";
import manifestJson from "./registry/lastmod.json";

/**
 * Sitemap <lastmod> values that only move when a page's content really changes.
 * A date that is "now" on every build teaches Google to ignore the field.
 *
 * Each tool page is fingerprinted from the text it shows (name, tagline,
 * description, tags, how it works, example, steps, FAQs). src/lib/registry/lastmod.json
 * stores the last fingerprint and the date it was first seen. After changing
 * tool content, run `bun run lastmod`; tests fail until the manifest is current.
 */
export interface LastmodEntry {
  hash: string;
  /** YYYY-MM-DD */
  date: string;
}
export type LastmodManifest = Record<string, LastmodEntry>;

export const lastmodManifest = manifestJson as LastmodManifest;

export function toolFingerprint(slug: string): string | null {
  const t = toolBySlug(slug);
  const content = TOOL_CONTENT[slug];
  if (!t || !content) return null;
  const payload = JSON.stringify({
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    tags: t.tags,
    content,
  });
  return createHash("sha1").update(payload).digest("hex").slice(0, 12);
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const latest = (dates: Date[]) => new Date(Math.max(...dates.map((d) => d.getTime())));

export function toolLastModified(slug: string): Date {
  const entry = lastmodManifest[slug];
  if (!entry) throw new Error(`lastmod manifest has no entry for "${slug}". Run: bun run lastmod`);
  return toDate(entry.date);
}

export function domainLastModified(domainSlug: string): Date {
  return latest(TOOLS.filter((t) => t.domain === domainSlug).map((t) => toolLastModified(t.slug)));
}

export function professionLastModified(professionSlug: string): Date {
  const p = PROFESSIONS.find((x) => x.slug === professionSlug);
  if (!p) throw new Error(`Unknown profession "${professionSlug}"`);
  return latest(p.liveSlugs.map((s) => toolLastModified(s)));
}

export function homeLastModified(): Date {
  return latest(DOMAINS.map((d) => domainLastModified(d.slug)));
}
