import { describe, expect, test } from "bun:test";
import { DOMAINS } from "@/lib/registry";
import { GOOGLE_APP_CATEGORIES, appCategory, breadcrumbSchema, jsonLd } from "@/lib/structured-data";

describe("structured data helpers", () => {
  test("every domain maps to a category Google accepts", () => {
    for (const d of DOMAINS) {
      expect(GOOGLE_APP_CATEGORIES as readonly string[], d.slug).toContain(appCategory(d.slug));
    }
  });

  test("breadcrumb positions run from 1 and URLs are absolute", () => {
    const s = breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Finance", path: "/finance" },
      { name: "Loan", path: "/finance/loan" },
    ]);
    expect(s["@type"]).toBe("BreadcrumbList");
    expect(s.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    for (const i of s.itemListElement) expect(i.item).toMatch(/^https?:\/\/[^/]+(\/.*)?$/);
    expect(s.itemListElement[0].item.endsWith("/")).toBe(false);
    expect(s.itemListElement[2].item.endsWith("/finance/loan")).toBe(true);
  });

  test("jsonLd cannot close the script tag", () => {
    const out = jsonLd({ text: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).text).toBe("</script><script>alert(1)</script>");
  });
});
