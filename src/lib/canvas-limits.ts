/**
 * What a browser tab can safely hold as a canvas or a decoded bitmap. One set
 * of numbers for every image tool, so they cannot drift apart.
 */

/** Longest side a canvas may have in current desktop browsers. */
export const MAX_SIDE = 16384;
/** Most pixels one canvas may have before we refuse (about 400 MB as RGBA). */
export const MAX_PIXELS = 100_000_000;
/** Canvas area older iOS Safari still draws (4096 x 4096), used as the fallback. */
export const SAFE_PIXELS = 16_000_000;
/** Most pixels all decoded pictures may add up to at once (about 600 MB as RGBA). */
export const MAX_DECODED_PIXELS = 150_000_000;

/**
 * Whether a canvas of this size really keeps what is drawn on it. Browsers
 * that cap canvas area (older iOS Safari) do not throw: they quietly give back
 * a blank canvas. Paint the last pixel and read it back to find out; the
 * canvas is cleared afterwards. Read-back failing counts as unusable.
 */
export function canvasKeepsPixels(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(width - 1, height - 1, 1, 1);
    const alpha = ctx.getImageData(width - 1, height - 1, 1, 1).data[3];
    ctx.clearRect(width - 1, height - 1, 1, 1);
    ctx.restore();
    return alpha === 255;
  } catch {
    return false;
  }
}
