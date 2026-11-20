import { describe, expect, test } from "bun:test";
import { DOMAINS, PROFESSIONS, TOOLS } from "@/lib/registry";
import { LEGAL_UPDATED, formatLongDate } from "@/lib/legal-dates";
import {
  lastmodManifest,
  toolFingerprint,
  toolLastModified,
} from "@/lib/lastmod";
import sitemap from "@/app/sitemap";

describe("lastmod manifest", () => {
  test("covers every tool and nothing else", () => {
    expect(Object.keys(lastmodManifest).sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });

  test("is current: run `bun run lastmod` after changing tool content", () => {
    const stale = TOOLS.filter((t) => lastmodManifest[t.slug].hash !== toolFingerprint(t.slug)).map((t) => t.slug);
    expect(stale, `stale lastmod entries, run: bun run lastmod\n${stale.join(", ")}`).toEqual([]);
  });

  test("dates are valid and not in the future", () => {
    const today = new Date().toLocaleDateString("en-CA");
    for (const [slug, e] of Object.entries(lastmodManifest)) {
      expect(e.date, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(e.date).getTime()), slug).toBe(false);
      expect(e.date <= today, `${slug} is dated in the future`).toBe(true);
    }
  });
});

describe("sitemap lastModified", () => {
  const entries = sitemap();
  const at = (suffix: string) => entries.find((e) => e.url.endsWith(suffix))!;

  test("tool pages use the manifest date, not the build time", () => {
    for (const t of TOOLS) {
      const e = at(`/${t.domain}/${t.slug}`);
      expect((e.lastModified as Date).toISOString().slice(0, 10), t.slug).toBe(lastmodManifest[t.slug].date);
      expect((e.lastModified as Date).getTime()).toBe(toolLastModified(t.slug).getTime());
    }
  });

  test("hubs take the newest date of the tools they list", () => {
    for (const d of DOMAINS) {
      const newest = TOOLS.filter((t) => t.domain === d.slug).map((t) => lastmodManifest[t.slug].date).sort().pop()!;
      expect((at(`/${d.slug}`).lastModified as Date).toISOString().slice(0, 10), d.slug).toBe(newest);
    }
    for (const p of PROFESSIONS) {
      const newest = p.liveSlugs.map((s) => lastmodManifest[s].date).sort().pop()!;
      expect((at(`/professions/${p.slug}`).lastModified as Date).toISOString().slice(0, 10), p.slug).toBe(newest);
    }
  });

  test("no URL is stamped with the current time", () => {
    const now = Date.now();
    for (const e of entries) expect(now - (e.lastModified as Date).getTime(), e.url).toBeGreaterThan(60_000);
  });

  test("legal pages use their own dates", () => {
    expect((at("/privacy").lastModified as Date).toISOString().slice(0, 10)).toBe(LEGAL_UPDATED.privacy);
    expect((at("/terms").lastModified as Date).toISOString().slice(0, 10)).toBe(LEGAL_UPDATED.terms);
    expect(formatLongDate("2026-11-19")).toBe("19 November 2026");
  });
});
