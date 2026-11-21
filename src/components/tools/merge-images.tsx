"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalcLayout, FieldGrid, ResultHero, SelectField, Verdict, downloadBlob } from "./ui";
import { FileDropZone, FileList, MAX_TOTAL_BYTES, nextFileKey } from "./file-drop";
import { fmtBytes } from "@/lib/archive";
import { placePictures, scalePlacement, shrinkFactor, type MergeFit, type MergeLayout } from "@/lib/merge-layout";

interface Picture {
  key: string;
  name: string;
  size: number;
  file: File;
}

const FORMATS = {
  png: { mime: "image/png", label: "PNG" },
  jpg: { mime: "image/jpeg", label: "JPG" },
  webp: { mime: "image/webp", label: "WebP" },
} as const;
type Format = keyof typeof FORMATS;

const decode = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
};

export function MergeImages() {
  const [pictures, setPictures] = React.useState<Picture[]>([]);
  const [layout, setLayout] = React.useState<MergeLayout>("vertical");
  const [columns, setColumns] = React.useState("2");
  const [gap, setGap] = React.useState("0");
  const [fit, setFit] = React.useState<MergeFit>("largest");
  const [background, setBackground] = React.useState("#ffffff");
  const [format, setFormat] = React.useState<Format>("png");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{ width: number; height: number; shrunk: boolean } | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const bitmaps = React.useRef(new Map<string, ImageBitmap>());

  const add = (files: File[]) => {
    setNotice("");
    const total = [...pictures.map((p) => p.size), ...files.map((f) => f.size)].reduce((a, b) => a + b, 0);
    if (total > MAX_TOTAL_BYTES) {
      setNotice(`That's ${fmtBytes(total)} in all. The browser tools handle up to ${fmtBytes(MAX_TOTAL_BYTES)} at a time.`);
      return;
    }
    setPictures((prev) => [...prev, ...files.map((file) => ({ key: nextFileKey(), name: file.name, size: file.size, file }))]);
  };

  // Free bitmaps of pictures that were removed, and all of them on leaving.
  React.useEffect(() => {
    const keep = new Set(pictures.map((p) => p.key));
    for (const [k, b] of bitmaps.current) {
      if (!keep.has(k)) {
        b.close();
        bitmaps.current.delete(k);
      }
    }
  }, [pictures]);
  React.useEffect(() => {
    const map = bitmaps.current;
    return () => {
      map.forEach((b) => b.close());
      map.clear();
    };
  }, []);

  const transparent = background === "transparent";
  const effectiveFormat: Format = transparent && format === "jpg" ? "png" : format;

  // Draw the merged picture whenever the pictures or the settings change.
  React.useEffect(() => {
    let cancelled = false;
    setError("");
    if (pictures.length === 0) {
      setResult(null);
      return;
    }
    (async () => {
      try {
        const loaded: ImageBitmap[] = [];
        for (const p of pictures) {
          let b = bitmaps.current.get(p.key);
          if (!b) {
            b = await decode(p.file);
            if (cancelled) {
              b.close();
              return;
            }
            bitmaps.current.set(p.key, b);
          }
          loaded.push(b);
        }
        if (cancelled || !canvas.current) return;
        const full = placePictures(
          loaded.map((b) => ({ w: b.width, h: b.height })),
          layout,
          { gap: Number(gap), columns: Number(columns), fit }
        );
        const factor = shrinkFactor(full.width, full.height);
        const placed = scalePlacement(full, factor);
        const el = canvas.current;
        el.width = placed.width;
        el.height = placed.height;
        const ctx = el.getContext("2d");
        if (!ctx) throw new Error("No canvas");
        ctx.clearRect(0, 0, el.width, el.height);
        if (!transparent) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, el.width, el.height);
        }
        ctx.imageSmoothingQuality = "high";
        placed.rects.forEach((r, i) => ctx.drawImage(loaded[i], r.x, r.y, r.w, r.h));
        setResult({ width: placed.width, height: placed.height, shrunk: factor < 1 });
      } catch {
        if (!cancelled) {
          setResult(null);
          setError("One of the files couldn't be read as an image. Remove it and try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pictures, layout, columns, gap, fit, background, transparent]);

  const save = () => {
    const el = canvas.current;
    if (!el) return;
    const { mime, label } = FORMATS[effectiveFormat];
    el.toBlob(
      (blob) => {
        if (!blob || blob.type !== mime) {
          setError(`This browser couldn't save a ${label} file. Choose another format.`);
          return;
        }
        downloadBlob(`merged.${effectiveFormat}`, blob);
      },
      mime,
      0.92
    );
  };

  return (
    <CalcLayout
      inputFirst
      inputs={
        <div className="space-y-4">
          <FileDropZone
            multiple
            accept="image/*"
            onFiles={add}
            title="Add images"
            hint="JPG, PNG, WebP, GIF and AVIF. Merged on your device, nothing is uploaded."
          />
          {pictures.length > 0 && <FileList items={pictures} onChange={setPictures} label="Images in merge order" />}
          <FieldGrid>
            <SelectField
              label="Layout"
              value={layout}
              onChange={(v) => setLayout(v as MergeLayout)}
              options={[
                { value: "vertical", label: "Top to bottom" },
                { value: "horizontal", label: "Left to right" },
                { value: "grid", label: "Grid" },
              ]}
            />
            {layout === "grid" ? (
              <SelectField
                label="Columns"
                value={columns}
                onChange={setColumns}
                options={["2", "3", "4", "5"].map((v) => ({ value: v, label: v }))}
              />
            ) : (
              <SelectField
                label={layout === "vertical" ? "Match the width of the" : "Match the height of the"}
                value={fit}
                onChange={(v) => setFit(v as MergeFit)}
                options={[
                  { value: "largest", label: "Largest image" },
                  { value: "smallest", label: "Smallest image" },
                ]}
              />
            )}
            <SelectField
              label="Spacing"
              value={gap}
              onChange={setGap}
              options={[
                { value: "0", label: "None" },
                { value: "10", label: "10 px" },
                { value: "20", label: "20 px" },
                { value: "40", label: "40 px" },
              ]}
            />
            <SelectField
              label="Background"
              value={background}
              onChange={setBackground}
              options={[
                { value: "#ffffff", label: "White" },
                { value: "#000000", label: "Black" },
                { value: "transparent", label: "Transparent (PNG, WebP)" },
              ]}
            />
          </FieldGrid>
          <SelectField
            label="Save as"
            value={effectiveFormat}
            onChange={(v) => setFormat(v as Format)}
            options={[
              { value: "png", label: "PNG (lossless)" },
              { value: "jpg", label: "JPG (smaller files)" },
              { value: "webp", label: "WebP (smallest)" },
            ]}
          />
        </div>
      }
      results={
        error ? (
          <Verdict tone="bad">{error}</Verdict>
        ) : notice && pictures.length === 0 ? (
          <Verdict tone="warn">{notice}</Verdict>
        ) : pictures.length === 0 ? (
          <Verdict tone="neutral">Add two or more images to merge them into one picture.</Verdict>
        ) : (
          <div className="space-y-4">
            <ResultHero
              label="Merged image"
              value={result ? `${result.width.toLocaleString("en-US")} × ${result.height.toLocaleString("en-US")}` : "…"}
              sub={`${pictures.length} ${pictures.length === 1 ? "image" : "images"} · ${effectiveFormat.toUpperCase()}`}
            />
            {notice && <Verdict tone="warn">{notice}</Verdict>}
            {result?.shrunk && <Verdict tone="warn">The result was too large for a browser to draw, so it was scaled down to fit.</Verdict>}
            <div className="overflow-hidden rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2">
              <canvas ref={canvas} aria-label="Preview of the merged image" className="mx-auto h-auto max-h-96 w-auto max-w-full" />
            </div>
            <Button type="button" className="w-full gap-2" onClick={save} disabled={!result}>
              <Download className="h-4 w-4" aria-hidden /> Download merged.{effectiveFormat}
            </Button>
            {pictures.length === 1 && <Verdict tone="neutral">Add at least one more image to merge.</Verdict>}
          </div>
        )
      }
    />
  );
}
