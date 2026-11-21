import { describe, expect, test } from "bun:test";
import { MAX_SIDE, SAFE_PIXELS } from "@/lib/canvas-limits";
import { placePictures, scalePlacement, shrinkFactor } from "@/lib/merge-layout";

const sizes = [{ w: 400, h: 300 }, { w: 200, h: 100 }];

describe("placePictures", () => {
  test("vertical scales to the widest and stacks with the gap", () => {
    const p = placePictures(sizes, "vertical", { gap: 10, columns: 2, fit: "largest" });
    expect(p.width).toBe(400);
    expect(p.rects).toEqual([{ x: 0, y: 0, w: 400, h: 300 }, { x: 0, y: 310, w: 400, h: 200 }]);
    expect(p.height).toBe(510);
  });

  test("vertical can scale to the narrowest instead", () => {
    const p = placePictures(sizes, "vertical", { gap: 0, columns: 2, fit: "smallest" });
    expect(p.width).toBe(200);
    expect(p.rects.map((r) => r.h)).toEqual([150, 100]);
    expect(p.height).toBe(250);
  });

  test("horizontal scales to the tallest and lines up in a row", () => {
    const p = placePictures(sizes, "horizontal", { gap: 20, columns: 2, fit: "largest" });
    expect(p.height).toBe(300);
    expect(p.rects).toEqual([{ x: 0, y: 0, w: 400, h: 300 }, { x: 420, y: 0, w: 600, h: 300 }]);
    expect(p.width).toBe(1020);
  });

  test("grid fits each picture inside equal cells, centred, never stretched", () => {
    const p = placePictures(sizes, "grid", { gap: 10, columns: 2, fit: "largest" });
    expect(p.width).toBe(810);
    expect(p.height).toBe(300);
    // The 2:1 picture fits the 400 x 300 cell by width and is centred vertically.
    expect(p.rects[1]).toEqual({ x: 410, y: 50, w: 400, h: 200 });
  });

  test("grid wraps into rows and uses at most one column per picture", () => {
    const p = placePictures([...sizes, ...sizes, sizes[0]], "grid", { gap: 0, columns: 2, fit: "largest" });
    expect(p.height).toBe(900);
    expect(placePictures(sizes, "grid", { gap: 0, columns: 9, fit: "largest" }).width).toBe(800);
  });

  test("empty input places nothing", () => {
    expect(placePictures([], "vertical", { gap: 0, columns: 1, fit: "largest" })).toEqual({ width: 0, height: 0, rects: [] });
  });
});

describe("canvas limits", () => {
  test("small results are untouched", () => {
    expect(shrinkFactor(4000, 3000)).toBe(1);
  });

  test("tall results shrink to the side limit and the pixel limit", () => {
    const f = shrinkFactor(4000, 40000);
    expect(f).toBeLessThan(1);
    const p = scalePlacement({ width: 4000, height: 40000, rects: [{ x: 0, y: 20000, w: 4000, h: 20000 }] }, f);
    expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(MAX_SIDE);
    expect(p.width * p.height).toBeLessThanOrEqual(100_000_000);
  });

  test("a lower pixel cap shrinks a result that the default cap leaves alone", () => {
    expect(shrinkFactor(8000, 6000)).toBe(1);
    const f = shrinkFactor(8000, 6000, SAFE_PIXELS);
    expect(f).toBeLessThan(1);
    expect(Math.round(8000 * f) * Math.round(6000 * f)).toBeLessThan(SAFE_PIXELS * 1.001);
  });
});
