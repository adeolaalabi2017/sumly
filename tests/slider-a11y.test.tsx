import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Slider } from "@/components/ui/slider";

// Radix puts role="slider" on the thumb, so the accessible name has to be on the thumb.
describe("Slider accessible name", () => {
  const html = renderToStaticMarkup(<Slider value={[40]} min={10} max={100} aria-label="Compression quality" />);

  test("the element with role=slider carries the aria-label", () => {
    const thumb = html.match(/<span[^>]*role="slider"[^>]*>/)?.[0] ?? "";
    expect(thumb).toContain('aria-label="Compression quality"');
  });

  test("aria-labelledby is forwarded to the thumb too", () => {
    const out = renderToStaticMarkup(<Slider value={[8]} min={8} max={64} aria-labelledby="len-label" />);
    const thumb = out.match(/<span[^>]*role="slider"[^>]*>/)?.[0] ?? "";
    expect(thumb).toContain('aria-labelledby="len-label"');
  });
});
