import { describe, expect, test } from "bun:test";
import { TOOLS } from "@/lib/registry";
import { ogAlt, ogImagePath } from "@/lib/og";

describe("per-tool OG alt text", () => {
  test("every tool has a distinct, descriptive alt", () => {
    const alts = TOOLS.map((t) => ogAlt(t));
    expect(new Set(alts).size).toBe(TOOLS.length);
    for (const [i, a] of alts.entries()) {
      expect(a.startsWith(`Sumly: ${TOOLS[i].name}.`), TOOLS[i].slug).toBe(true);
      expect(a.length, TOOLS[i].slug).toBeLessThanOrEqual(420);
      expect(/[.!?]$/.test(a), TOOLS[i].slug).toBe(true);
      expect(a).not.toContain("..");
    }
  });

  test("image path matches the generated route", () => {
    expect(ogImagePath({ domain: "finance", slug: "loan-mortgage-calculator" })).toBe(
      "/finance/loan-mortgage-calculator/opengraph-image"
    );
  });
});
