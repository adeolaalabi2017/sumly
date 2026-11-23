import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMAINS } from "@/lib/registry";

/** Parse public/_headers into path -> header lines (Cloudflare _headers format). */
function parse(): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string | null = null;
  for (const raw of readFileSync(join(process.cwd(), "public/_headers"), "utf8").split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (/^\s/.test(raw)) {
      if (current) rules.get(current)!.push(raw.trim());
    } else {
      current = raw.trim();
      rules.set(current, rules.get(current) ?? []);
    }
  }
  return rules;
}

const contentType = (rules: Map<string, string[]>, path: string) =>
  rules.get(path)?.find((h) => h.toLowerCase().startsWith("content-type:"))?.split(":").slice(1).join(":").trim();

describe("public/_headers: charset on HTTP responses", () => {
  const rules = parse();
  const html = "text/html; charset=utf-8";

  test("the home page, legal pages and 404 are served as UTF-8 HTML", () => {
    for (const p of ["/", "/privacy", "/terms", "/404"]) expect(contentType(rules, p), p).toBe(html);
  });

  test("every domain hub is listed (add new domains here)", () => {
    for (const d of DOMAINS) expect(contentType(rules, `/${d.slug}`), d.slug).toBe(html);
  });

  test("tool pages and profession pages are covered by the two-segment placeholder", () => {
    expect(contentType(rules, "/:section/:page")).toBe(html);
  });

  test("no rule relabels a deeper path as HTML, so the OG images and .txt payloads keep their types", () => {
    for (const [path, lines] of rules) {
      const ct = lines.find((h) => h.toLowerCase().startsWith("content-type:"));
      if (ct && /text\/html/.test(ct)) {
        expect(path.split("/").filter(Boolean).length, path).toBeLessThanOrEqual(2);
        expect(path.includes("*"), path).toBe(false);
      }
    }
    expect(contentType(rules, "/:domain/:tool/opengraph-image")).toBe("image/png");
  });

  test("text files declare UTF-8", () => {
    expect(contentType(rules, "/robots.txt")).toBe("text/plain; charset=utf-8");
    expect(contentType(rules, "/sitemap.xml")).toBe("application/xml; charset=utf-8");
    expect(contentType(rules, "/sw.js")).toBe("text/javascript; charset=utf-8");
  });
});
