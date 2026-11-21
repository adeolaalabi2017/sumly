"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CalcLayout, FieldGrid, ResultHero, SelectField, Verdict, downloadBlob } from "./ui";
import { FileDropZone, MAX_TOTAL_BYTES, nextFileKey } from "./file-drop";
import { bytesToBlob, fmtBytes, writeArchive } from "@/lib/archive";
import { MAX_PIXELS, canvasKeepsPixels } from "@/lib/canvas-limits";

/**
 * One converter behind eight pages: JPG, PNG, WebP and HEIC in, JPG, PNG and
 * WebP out. Browsers decode JPG, PNG and WebP natively and re-encode them
 * through a canvas; HEIC needs a decoder library, loaded only when needed.
 */

type Target = "jpg" | "png" | "webp";

const MIME: Record<Target, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const LABEL: Record<Target, string> = { jpg: "JPG", png: "PNG", webp: "WebP" };

interface Source {
  label: string;
  accept: string;
  /** File names this source takes, for the extension swap and the file-type check. */
  ext: RegExp;
  heic?: boolean;
  svg?: boolean;
  tiff?: boolean;
}

const SOURCES: Record<"jpg" | "png" | "webp" | "heic" | "avif" | "gif" | "svg" | "tiff", Source> = {
  jpg: { label: "JPG", accept: "image/jpeg,.jpg,.jpeg,.jpe,.jfif", ext: /\.(jpe?g|jpe|jfif)$/i },
  png: { label: "PNG", accept: "image/png,.png", ext: /\.png$/i },
  webp: { label: "WebP", accept: "image/webp,.webp", ext: /\.webp$/i },
  heic: { label: "HEIC", accept: "image/heic,image/heif,.heic,.heif", ext: /\.(heic|heif)$/i, heic: true },
  avif: { label: "AVIF", accept: "image/avif,.avif", ext: /\.avif$/i },
  gif: { label: "GIF", accept: "image/gif,.gif", ext: /\.gif$/i },
  svg: { label: "SVG", accept: "image/svg+xml,.svg", ext: /\.svg$/i, svg: true },
  tiff: { label: "TIFF", accept: "image/tiff,.tif,.tiff", ext: /\.tiff?$/i, tiff: true },
};

/** Options some sources need: SVG has no pixel size of its own, and JPG has no transparency. */
interface Options {
  svgWidth: number;
  background: string;
}

interface Item {
  key: string;
  file: File;
  outName?: string;
  blob?: Blob;
  url?: string;
  width?: number;
  height?: number;
  error?: string;
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), type, quality)
  );

/** Decode to a bitmap with the camera's rotation applied. */
async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(blob);
  }
}

/** The slice of libheif-js this tool uses; the package ships no types for its bundled build. */
interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(target: { data: Uint8ClampedArray; width: number; height: number }, done: (result: { data: Uint8ClampedArray } | null) => void): void;
}
interface Libheif {
  HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
}

/** Decode a HEIC or HEIF photo to a canvas-ready bitmap. The decoder is WebAssembly, loaded on first use. */
async function decodeHeic(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D) => void }> {
  const mod = (await import("libheif-js/wasm-bundle")) as unknown as { default?: Libheif } & Libheif;
  const libheif = mod.default ?? mod;
  const images = new libheif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
  const image = images[0];
  if (!image) throw new Error("No image in file");
  const width = image.get_width();
  const height = image.get_height();
  if (width * height > MAX_PIXELS) throw new RangeError("too large");
  const pixels = new Uint8ClampedArray(width * height * 4);
  const done = await new Promise<{ data: Uint8ClampedArray } | null>((resolve) => image.display({ data: pixels, width, height }, resolve));
  if (!done) throw new Error("HEIC decode failed");
  return { width, height, draw: (ctx) => ctx.putImageData(new ImageData(pixels, width, height), 0, 0) };
}

type Decoded = { width: number; height: number; draw: (ctx: CanvasRenderingContext2D) => void; close?: () => void };

/** Read an SVG's drawing size from its width and height, or its viewBox, as an aspect ratio. */
function svgAspect(text: string): number {
  const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || root.querySelector("parsererror")) throw new TypeError("not svg");
  const px = (v: string | null) => (v && /^\s*[\d.]+\s*(px)?\s*$/.test(v) ? parseFloat(v) : 0);
  let w = px(root.getAttribute("width"));
  let h = px(root.getAttribute("height"));
  if (!w || !h) {
    const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) [w, h] = [vb[2], vb[3]];
  }
  return w > 0 && h > 0 ? w / h : 1;
}

/** Draw an SVG at the width chosen. It loads as an image, so scripts in it never run. */
async function decodeSvg(file: File, svgWidth: number): Promise<Decoded> {
  const text = await file.text();
  const aspect = svgAspect(text);
  const width = svgWidth;
  const height = Math.max(1, Math.round(width / aspect));
  if (width * height > MAX_PIXELS) throw new RangeError("too large");
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width, height, draw: (ctx) => ctx.drawImage(img, 0, 0, width, height) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The slice of UTIF this tool uses. */
interface Utif {
  decode(buf: ArrayBuffer): { width: number; height: number }[];
  decodeImage(buf: ArrayBuffer, ifd: { width: number; height: number }): void;
  toRGBA8(ifd: { width: number; height: number }): Uint8Array;
}

/** Decode the first page of a TIFF. */
async function decodeTiff(file: File): Promise<Decoded> {
  const mod = (await import("utif")) as unknown as { default?: Utif } & Utif;
  const UTIF = mod.default ?? mod;
  const buf = await file.arrayBuffer();
  const pages = UTIF.decode(buf);
  const ifd = pages[0];
  if (!ifd) throw new Error("No image in file");
  UTIF.decodeImage(buf, ifd);
  const { width, height } = ifd;
  if (!width || !height) throw new Error("Empty image");
  if (width * height > MAX_PIXELS) throw new RangeError("too large");
  const rgba = new Uint8ClampedArray(UTIF.toRGBA8(ifd));
  return { width, height, draw: (ctx) => ctx.putImageData(new ImageData(rgba, width, height), 0, 0) };
}

async function convertOne(file: File, source: Source, to: Target, quality: number, opts: Options): Promise<{ blob: Blob; width: number; height: number }> {
  let decoded: Decoded;
  if (source.heic) decoded = await decodeHeic(file);
  else if (source.svg) decoded = await decodeSvg(file, opts.svgWidth);
  else if (source.tiff) decoded = await decodeTiff(file);
  else {
    const bmp = await decode(file);
    decoded = { width: bmp.width, height: bmp.height, draw: (ctx) => ctx.drawImage(bmp, 0, 0), close: () => bmp.close() };
  }
  const { width, height, draw, close } = decoded;
  try {
    if (width * height > MAX_PIXELS) throw new RangeError("too large");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    // Some browsers hand back a blank canvas instead of failing when it is too big.
    if (!canvasKeepsPixels(ctx, width, height)) throw new RangeError("too large");
    // JPG has no transparency, so transparent areas get a solid colour (white unless chosen) instead of black.
    if (to === "jpg") {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, width, height);
    }
    draw(ctx);
    const blob = await canvasToBlob(canvas, MIME[to], to === "png" ? undefined : quality / 100);
    // A browser that can't write WebP silently hands back a PNG.
    if (blob.type !== MIME[to]) throw new TypeError(`This browser can't save ${LABEL[to]} files.`);
    return { blob, width, height };
  } finally {
    close?.();
  }
}

function failure(e: unknown, source: Source): string {
  if (e instanceof TypeError && /can't save/.test(e.message)) return e.message;
  if (e instanceof RangeError) return "That picture is too large to convert in the browser.";
  // An SVG that uses <foreignObject> or external content taints the canvas, so it can be drawn but not saved.
  if (e instanceof DOMException && e.name === "SecurityError") {
    return "That SVG uses features browsers can't export to an image, such as embedded web content (foreignObject) or linked files. Remove them and try again.";
  }
  return `That file couldn't be read as a ${source.label}. It may be damaged or a different kind of file.`;
}

const swapExt = (name: string, source: Source, to: Target) =>
  `${name.replace(source.ext, "").replace(/\.[^.]+$/, "") || "image"}.${to}`;

export function ImageConverter({ from, to }: { from: keyof typeof SOURCES; to: Target }) {
  const source = SOURCES[from];
  const [items, setItems] = React.useState<Item[]>([]);
  const [quality, setQuality] = React.useState(90);
  const [svgWidth, setSvgWidth] = React.useState("1024");
  const [background, setBackground] = React.useState("#ffffff");
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const urls = React.useRef<string[]>([]);

  const releaseUrls = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
  };
  // False once the page unmounts, so a conversion still running can't create URLs nobody will free.
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      releaseUrls();
    };
  }, []);

  const reset = (next: Item[]) => {
    releaseUrls();
    setItems(next.map(({ key, file }) => ({ key, file })));
  };

  const add = (files: File[]) => {
    if (busy) return;
    setNotice("");
    const total = [...items, ...files.map((file) => ({ file }))].reduce((n, i) => n + i.file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setNotice(`That's ${fmtBytes(total)} in all. The browser tools handle up to ${fmtBytes(MAX_TOTAL_BYTES)} at a time.`);
      return;
    }
    const wrong = files.filter((f) => !source.ext.test(f.name) && !(source.accept.split(",").includes(f.type)));
    if (wrong.length) {
      setNotice(`${wrong.map((f) => f.name).join(", ")} ${wrong.length === 1 ? "isn't a" : "aren't"} ${source.label} file${wrong.length === 1 ? "" : "s"} and ${wrong.length === 1 ? "was" : "were"} skipped.`);
    }
    const ok = files.filter((f) => !wrong.includes(f));
    reset([...items, ...ok.map((file) => ({ key: nextFileKey(), file }))]);
  };

  const done = items.filter((i) => i.blob);
  const failed = items.filter((i) => i.error);

  const convert = async () => {
    releaseUrls();
    // The list is locked while this runs (see `busy`), so this snapshot is still the whole list at the end.
    const out: Item[] = [];
    for (const [n, it] of items.entries()) {
      setBusy(`Converting ${n + 1} of ${items.length}…`);
      try {
        const { blob, width, height } = await convertOne(it.file, source, to, quality, { svgWidth: Number(svgWidth), background });
        if (!alive.current) return;
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        out.push({ key: it.key, file: it.file, blob, url, width, height, outName: swapExt(it.file.name, source, to) });
      } catch (e) {
        out.push({ key: it.key, file: it.file, error: failure(e, source) });
      }
      // Let the page paint between pictures; HEIC decoding blocks the thread.
      await new Promise((r) => setTimeout(r, 0));
    }
    if (!alive.current) return;
    setItems(out);
    setBusy("");
  };

  const downloadAll = async () => {
    const entries = await Promise.all(done.map(async (i) => ({ name: i.outName!, data: new Uint8Array(await i.blob!.arrayBuffer()) })));
    downloadBlob(`${LABEL[from].toLowerCase()}-to-${to}.zip`, bytesToBlob(writeArchive(entries, "zip", 0), "application/zip"));
  };

  const converted = items.length > 0 && items.every((i) => i.blob || i.error);
  const inBytes = done.reduce((n, i) => n + i.file.size, 0);
  const outBytes = done.reduce((n, i) => n + i.blob!.size, 0);
  const lossy = to !== "png";

  return (
    <CalcLayout
      inputFirst
      inputs={
        <div className="space-y-4">
          <FileDropZone
            multiple
            accept={source.accept}
            onFiles={add}
            disabled={!!busy}
            title={`Add ${source.label} images`}
            hint={`Pick one or many. Converted on your device, nothing is uploaded.`}
          />
          {items.length > 0 && (
            <ul aria-label="Images to convert" className="divide-y divide-border/70 rounded-lg border">
              {items.map((it) => (
                <li key={it.key} className="flex items-center gap-3 px-3 py-2">
                  {it.url ? (
                    <img src={it.url} alt="" className="h-10 w-10 shrink-0 rounded border bg-muted object-cover" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded border bg-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.outName ?? it.file.name}</span>
                    <span className={it.error ? "block text-xs text-destructive" : "tnum block text-xs text-muted-foreground"}>
                      {it.error ??
                        (it.blob
                          ? `${it.width} × ${it.height} px · ${fmtBytes(it.file.size)} to ${fmtBytes(it.blob.size)}`
                          : fmtBytes(it.file.size))}
                    </span>
                  </span>
                  {it.blob && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => downloadBlob(it.outName!, it.blob!)} aria-label={`Save ${it.outName}`}>
                      <Download className="h-3.5 w-3.5" aria-hidden /> Save
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => reset(items.filter((x) => x.key !== it.key))}
                    disabled={!!busy}
                    aria-label={`Remove ${it.file.name}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {source.svg && (
            <FieldGrid>
              <SelectField
                label="Width"
                value={svgWidth}
                onChange={(v) => {
                  setSvgWidth(v);
                  if (converted) reset(items);
                }}
                options={[
                  { value: "256", label: "256 px" },
                  { value: "512", label: "512 px" },
                  { value: "1024", label: "1024 px" },
                  { value: "2048", label: "2048 px" },
                  { value: "4096", label: "4096 px" },
                ]}
              />
              {to === "jpg" && (
                <SelectField
                  label="Background"
                  value={background}
                  onChange={(v) => {
                    setBackground(v);
                    if (converted) reset(items);
                  }}
                  options={[
                    { value: "#ffffff", label: "White" },
                    { value: "#000000", label: "Black" },
                  ]}
                />
              )}
            </FieldGrid>
          )}
          {lossy && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor={`quality-${from}-${to}`} className="text-sm font-medium">
                  {LABEL[to]} quality
                </Label>
                <span className="tnum text-sm font-semibold">{quality}%</span>
              </div>
              <Slider
                id={`quality-${from}-${to}`}
                value={[quality]}
                min={40}
                max={100}
                step={1}
                onValueChange={(v) => {
                  setQuality(v[0] ?? quality);
                  if (converted) reset(items);
                }}
                aria-label={`${LABEL[to]} quality`}
              />
            </div>
          )}
        </div>
      }
      results={
        notice && items.length === 0 ? (
          <Verdict tone="warn">{notice}</Verdict>
        ) : items.length === 0 ? (
          <Verdict tone="neutral">
            Add {source.label} images to convert them to {LABEL[to]}.
          </Verdict>
        ) : (
          <div className="space-y-4">
            <ResultHero
              label={converted ? "Converted" : "Images to convert"}
              value={String(converted ? done.length : items.length)}
              sub={converted ? (done.length ? `${fmtBytes(inBytes)} to ${fmtBytes(outBytes)} as ${LABEL[to]}` : "Nothing could be converted") : `${source.label} to ${LABEL[to]}`}
            />
            {notice && <Verdict tone="warn">{notice}</Verdict>}
            {failed.length > 0 && <Verdict tone="bad">{failed.length === 1 ? "One file" : `${failed.length} files`} couldn&apos;t be converted. See the list.</Verdict>}
            {busy && <Verdict tone="neutral">{busy}</Verdict>}
            {!converted ? (
              <Button type="button" className="w-full" onClick={convert} disabled={!!busy}>
                {busy ? "Converting…" : `Convert to ${LABEL[to]}`}
              </Button>
            ) : done.length > 0 ? (
              <Button type="button" className="w-full gap-2" onClick={() => (done.length === 1 ? downloadBlob(done[0].outName!, done[0].blob!) : downloadAll())}>
                <Download className="h-4 w-4" aria-hidden /> {done.length === 1 ? `Download ${LABEL[to]}` : "Download all as ZIP"}
              </Button>
            ) : null}
            {to === "jpg" && <Verdict tone="neutral">JPG can&apos;t be transparent, so transparent areas turn {background === "#000000" ? "black" : "white"}.</Verdict>}
            {source.tiff && <Verdict tone="neutral">Only the first page of a multi-page TIFF is converted.</Verdict>}
            {source.svg && <Verdict tone="neutral">An SVG has no pixel size of its own, so it is drawn at the width you chose. Fonts that aren&apos;t embedded in the file may be replaced.</Verdict>}
          </div>
        )
      }
    />
  );
}

export const JpgToPng = () => <ImageConverter from="jpg" to="png" />;
export const PngToJpg = () => <ImageConverter from="png" to="jpg" />;
export const WebpToPng = () => <ImageConverter from="webp" to="png" />;
export const WebpToJpg = () => <ImageConverter from="webp" to="jpg" />;
export const PngToWebp = () => <ImageConverter from="png" to="webp" />;
export const JpgToWebp = () => <ImageConverter from="jpg" to="webp" />;
export const HeicToJpg = () => <ImageConverter from="heic" to="jpg" />;
export const AvifToJpg = () => <ImageConverter from="avif" to="jpg" />;
export const GifToJpg = () => <ImageConverter from="gif" to="jpg" />;
export const SvgToPng = () => <ImageConverter from="svg" to="png" />;
export const SvgToJpg = () => <ImageConverter from="svg" to="jpg" />;
export const TiffToJpg = () => <ImageConverter from="tiff" to="jpg" />;
export const HeicToPng = () => <ImageConverter from="heic" to="png" />;
