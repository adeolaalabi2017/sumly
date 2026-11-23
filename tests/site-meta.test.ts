import { describe, expect, test } from "bun:test";
import { DOMAINS, TOOLS } from "@/lib/registry";
import { siteDescription, siteTitle } from "@/lib/site-meta";

describe("site-wide title and description", () => {
  const title = siteTitle(TOOLS.length);
  const description = siteDescription(TOOLS.length, DOMAINS.length);

  test("the title is 50-60 characters and names the brand and the tool count", () => {
    expect(title.length).toBeGreaterThanOrEqual(50);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.startsWith("Sumly")).toBe(true);
    expect(title).toContain(String(TOOLS.length));
  });

  test("the description is 140-160 characters and quotes the real counts", () => {
    expect(description.length).toBeGreaterThanOrEqual(140);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain(`${TOOLS.length} tools across ${DOMAINS.length} domains`);
  });

  test("the lengths hold up to a four-digit tool count", () => {
    expect(siteTitle(1000).length).toBeLessThanOrEqual(60);
    expect(siteDescription(1000, 100).length).toBeLessThanOrEqual(165);
  });
});
