/**
 * Where each picture goes when several are merged into one. Pure geometry, so
 * it can be tested without a canvas.
 */
export type MergeLayout = "vertical" | "horizontal" | "grid";
export type MergeFit = "largest" | "smallest";

export interface Size {
  w: number;
  h: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}
export interface Placement {
  width: number;
  height: number;
  rects: Rect[];
}

import { MAX_PIXELS, MAX_SIDE } from "./canvas-limits";

const pick = (values: number[], fit: MergeFit) => (fit === "largest" ? Math.max(...values) : Math.min(...values));

/**
 * Stack pictures in a column or a row, or lay them in a grid. A column scales
 * every picture to one width and a row to one height, so edges line up; a
 * grid fits each picture inside equal cells without cropping or stretching.
 */
export function placePictures(sizes: Size[], layout: MergeLayout, opts: { gap: number; columns: number; fit: MergeFit }): Placement {
  const n = sizes.length;
  if (n === 0) return { width: 0, height: 0, rects: [] };
  const { gap, fit } = opts;
  const rects: Rect[] = [];

  if (layout === "vertical") {
    const width = Math.round(pick(sizes.map((s) => s.w), fit));
    let y = 0;
    for (const s of sizes) {
      const h = Math.max(1, Math.round((s.h * width) / s.w));
      rects.push({ x: 0, y, w: width, h });
      y += h + gap;
    }
    return { width, height: y - gap, rects };
  }

  if (layout === "horizontal") {
    const height = Math.round(pick(sizes.map((s) => s.h), fit));
    let x = 0;
    for (const s of sizes) {
      const w = Math.max(1, Math.round((s.w * height) / s.h));
      rects.push({ x, y: 0, w, h: height });
      x += w + gap;
    }
    return { width: x - gap, height, rects };
  }

  const columns = Math.max(1, Math.min(opts.columns, n));
  const rows = Math.ceil(n / columns);
  const cellW = Math.round(pick(sizes.map((s) => s.w), fit));
  const cellH = Math.round(pick(sizes.map((s) => s.h), fit));
  sizes.forEach((s, i) => {
    const scale = Math.min(cellW / s.w, cellH / s.h);
    const w = Math.max(1, Math.round(s.w * scale));
    const h = Math.max(1, Math.round(s.h * scale));
    const cx = (i % columns) * (cellW + gap);
    const cy = Math.floor(i / columns) * (cellH + gap);
    rects.push({ x: cx + Math.round((cellW - w) / 2), y: cy + Math.round((cellH - h) / 2), w, h });
  });
  return { width: columns * cellW + (columns - 1) * gap, height: rows * cellH + (rows - 1) * gap, rects };
}

/** How much to shrink a result so it fits the canvas limits; 1 when it already does. */
export function shrinkFactor(width: number, height: number, maxPixels: number = MAX_PIXELS): number {
  return Math.min(1, MAX_SIDE / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
}

/** Apply a shrink factor to a placement. */
export function scalePlacement(p: Placement, factor: number): Placement {
  if (factor >= 1) return p;
  const r = (v: number) => Math.max(1, Math.round(v * factor));
  return {
    width: r(p.width),
    height: r(p.height),
    rects: p.rects.map((q) => ({ x: Math.round(q.x * factor), y: Math.round(q.y * factor), w: r(q.w), h: r(q.h) })),
  };
}
