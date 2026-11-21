"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalcLayout, CopyButton, FieldGrid, ResultHero, SelectField, TextField, Verdict, downloadBlob, downloadText } from "./ui";
import { FileDropZone } from "./file-drop";
import { baseName, openWithPdfjs, pdfError, readBytes, useSinglePdf } from "./pdf";
import { bytesToBlob, fmtBytes } from "@/lib/archive";
import { inferCell, sheetFileName } from "@/lib/spreadsheet";
import {
  buildDocx,
  buildEpub,
  buildLines,
  linesToBlocks,
  linesToRows,
  pagesToText,
  rowsToCsv,
  type Block,
  type EpubChapter,
  type Line,
  type TextFragment,
} from "@/lib/pdf-text";

/**
 * PDF to text, CSV, Excel, Word and EPUB. All five read the text layer of the
 * PDF with pdf.js and rebuild lines from where each piece of text sits on the
 * page, so they work on PDFs made from documents and not on scanned images.
 */

/** Reading text is much lighter than drawing pages, but a book still takes a while. */
const MAX_TEXT_PAGES = 500;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

/** Open a PDF and read its text, page by page, as soon as one is chosen. */
function usePdfText() {
  const { file, pageCount, error, setError, open } = useSinglePdf();
  const [pages, setPages] = React.useState<Line[][] | null>(null);
  const [progress, setProgress] = React.useState("");
  const [readError, setReadError] = React.useState("");

  React.useEffect(() => {
    setPages(null);
    setReadError("");
    if (!file) return;
    if (pageCount > MAX_TEXT_PAGES) {
      setReadError(`This PDF has ${pageCount.toLocaleString("en-US")} pages. Split it first: these tools read up to ${MAX_TEXT_PAGES} pages at a time.`);
      return;
    }
    let cancelled = false;
    (async () => {
      const { doc, close } = await openWithPdfjs(await readBytes(file));
      try {
        const out: Line[][] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          setProgress(`Reading page ${n} of ${doc.numPages}…`);
          const page = await doc.getPage(n);
          const content = await page.getTextContent();
          const frags: TextFragment[] = [];
          for (const it of content.items) {
            if (!("str" in it)) continue;
            frags.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height || Math.abs(it.transform[3]) });
          }
          out.push(buildLines(frags));
          page.cleanup();
        }
        if (cancelled) return;
        if (!out.some((p) => p.length)) {
          setReadError("No text found in this PDF. It is probably scans or photos of pages, which need OCR (text recognition) to convert. These tools read the text a PDF already contains.");
        } else setPages(out);
      } catch (e) {
        if (!cancelled) setReadError(pdfError(e));
      } finally {
        await close();
        if (!cancelled) setProgress("");
      }
    })().catch((e) => {
      if (!cancelled) {
        setReadError(pdfError(e));
        setProgress("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file, pageCount]);

  return { file, pageCount, pages, progress, error: error || readError, setError, open };
}

/** The shared shell: one PDF in, options on the left, a result on the right. */
function PdfConvert({
  verb,
  options,
  children,
}: {
  verb: string;
  options?: React.ReactNode;
  children: (ctx: { pages: Line[][]; file: File; stem: string }) => React.ReactNode;
}) {
  const { file, pageCount, pages, progress, error, open } = usePdfText();
  return (
    <CalcLayout
      inputFirst
      inputs={
        <div className="space-y-4">
          <FileDropZone
            accept="application/pdf,.pdf"
            onFiles={open}
            title={file ? `${file.name} · ${plural(pageCount, "page")}` : "Open a PDF"}
            hint="Text-based PDFs only. Nothing is uploaded."
          />
          {options}
        </div>
      }
      results={
        error ? (
          <Verdict tone="bad">{error}</Verdict>
        ) : !file ? (
          <Verdict tone="neutral">Open a PDF to {verb}.</Verdict>
        ) : progress || !pages ? (
          <Verdict tone="neutral">{progress || "Reading the PDF…"}</Verdict>
        ) : (
          children({ pages, file, stem: baseName(file.name) })
        )
      }
    />
  );
}

/** First rows of a table, as a small preview. */
function TablePreview({ rows }: { rows: string[][] }) {
  const cols = Math.min(12, Math.max(0, ...rows.map((r) => r.length)));
  return (
    <div className="space-y-1.5">
      <div className="max-h-72 overflow-auto rounded-lg border">
        <table className="w-full text-xs">
          <tbody>
            {rows.slice(0, 40).map((r, i) => (
              <tr key={i} className={i === 0 ? "bg-muted font-medium" : "border-t border-border/60"}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="max-w-40 truncate px-2 py-1.5">
                    {r[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length > 40 || cols < Math.max(0, ...rows.map((r) => r.length))
          ? "The preview shows the top-left corner. The download has everything."
          : "Check the columns line up before you rely on the numbers."}
      </p>
    </div>
  );
}

const wordCount = (text: string) => (text.match(/\S+/g) ?? []).length;

/* ================================================================== */
/* PDF to Text                                                         */
/* ================================================================== */

export function PdfToText() {
  const [markers, setMarkers] = React.useState("none");
  return (
    <PdfConvert
      verb="get its text"
      options={
        <SelectField
          label="Between pages"
          value={markers}
          onChange={setMarkers}
          options={[
            { value: "none", label: "Just a blank line" },
            { value: "marks", label: "A “--- Page 2 ---” line" },
          ]}
        />
      }
    >
      {({ pages, stem }) => {
        const text = pagesToText(pages, markers === "marks");
        const shown = text.length > 20000 ? `${text.slice(0, 20000)}\n\n…` : text;
        return (
          <div className="space-y-4">
            <ResultHero label="Words" value={wordCount(text).toLocaleString("en-US")} sub={`${plural(pages.length, "page")} · ${fmtBytes(new Blob([text]).size)} as text`} />
            <div role="region" aria-label="Extracted text" className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-sm leading-relaxed">
              <pre className="whitespace-pre-wrap break-words font-sans">{shown}</pre>
            </div>
            {text.length > 20000 && <p className="text-xs text-muted-foreground">The preview shows the first 20,000 characters. Copy and download have everything.</p>}
            <div className="flex gap-2">
              <CopyButton text={text} />
              <Button type="button" className="h-10 flex-1 gap-2 sm:h-8" onClick={() => downloadText(`${stem}.txt`, text)}>
                <Download className="h-4 w-4" aria-hidden /> Download {stem}.txt
              </Button>
            </div>
          </div>
        );
      }}
    </PdfConvert>
  );
}

/* ================================================================== */
/* PDF to CSV                                                          */
/* ================================================================== */

/** Table rows for the whole document: columns are worked out page by page, since tables differ between pages. */
const allRows = (pages: Line[][]) => pages.flatMap((lines) => linesToRows(lines));

const DELIMS = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon (many European Excel versions)" },
  { value: "\t", label: "Tab" },
];

export function PdfToCsv() {
  const [delimiter, setDelimiter] = React.useState(",");
  return (
    <PdfConvert
      verb="turn its tables into CSV"
      options={<SelectField label="Separator" value={delimiter} onChange={setDelimiter} options={DELIMS} />}
    >
      {({ pages, stem }) => {
        const rows = allRows(pages);
        const cols = Math.max(0, ...rows.map((r) => r.length));
        const csv = rowsToCsv(rows, delimiter);
        return (
          <div className="space-y-4">
            <ResultHero label="Rows" value={rows.length.toLocaleString("en-US")} sub={`${plural(cols, "column")} · from ${plural(pages.length, "page")}`} />
            <TablePreview rows={rows} />
            <Button type="button" className="w-full gap-2" onClick={() => downloadBlob(`${stem}.csv`, new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }))}>
              <Download className="h-4 w-4" aria-hidden /> Download {stem}.csv
            </Button>
            <Verdict tone="neutral">Every line of text becomes a row, and text that starts at the same left edge on several lines becomes a column. Tables with merged cells or wrapped text may need tidying.</Verdict>
          </div>
        );
      }}
    </PdfConvert>
  );
}

/* ================================================================== */
/* PDF to Excel                                                        */
/* ================================================================== */

export function PdfToExcel() {
  const [layout, setLayout] = React.useState("one");
  const [numbers, setNumbers] = React.useState("detect");
  const [made, setMade] = React.useState("");
  const [error, setError] = React.useState("");

  return (
    <PdfConvert
      verb="turn its tables into an Excel workbook"
      options={
        <FieldGrid>
          <SelectField
            label="Sheets"
            value={layout}
            onChange={(v) => {
              setLayout(v);
              setMade("");
            }}
            options={[
              { value: "one", label: "One sheet for the whole PDF" },
              { value: "per-page", label: "One sheet per page" },
            ]}
          />
          <SelectField
            label="Numbers"
            value={numbers}
            onChange={(v) => {
              setNumbers(v);
              setMade("");
            }}
            options={[
              { value: "detect", label: "Store as numbers" },
              { value: "text", label: "Keep everything as text" },
            ]}
          />
        </FieldGrid>
      }
    >
      {({ pages, stem }) => {
        const rows = allRows(pages);
        const cols = Math.max(0, ...rows.map((r) => r.length));
        const fileName = `${sheetFileName(stem)}.xlsx`;
        const create = async () => {
          setError("");
          try {
            const XLSX = await import("xlsx");
            const book = XLSX.utils.book_new();
            const sheets = layout === "one" ? [rows] : pages.map((lines) => linesToRows(lines));
            sheets.forEach((sheetRows, i) => {
              if (sheetRows.length === 0) return;
              // Strings stay strings: text starting with "=" is never stored as a live formula.
              const ws = XLSX.utils.aoa_to_sheet(sheetRows.map((r) => r.map((v) => inferCell(v, numbers === "text"))));
              const width = Math.max(0, ...sheetRows.map((r) => r.length));
              ws["!cols"] = Array.from({ length: width }, (_, c) => ({
                wch: Math.min(50, Math.max(8, ...sheetRows.slice(0, 500).map((r) => (r[c] ?? "").length + 1))),
              }));
              XLSX.utils.book_append_sheet(book, ws, layout === "one" ? "PDF" : `Page ${i + 1}`);
            });
            const out: ArrayBuffer = XLSX.write(book, { type: "array", bookType: "xlsx", compression: true });
            downloadBlob(fileName, new Blob([out], { type: XLSX_MIME }));
            setMade(fileName);
          } catch {
            setError("The workbook couldn't be created from this PDF.");
          }
        };
        return (
          <div className="space-y-4">
            <ResultHero
              label={layout === "one" ? "Rows" : "Sheets"}
              value={(layout === "one" ? rows.length : pages.filter((p) => p.length).length).toLocaleString("en-US")}
              sub={made ? `${made} downloaded` : `${plural(cols, "column")} · from ${plural(pages.length, "page")}`}
            />
            <TablePreview rows={rows} />
            {error && <Verdict tone="bad">{error}</Verdict>}
            <Button type="button" className="w-full gap-2" onClick={create}>
              <Download className="h-4 w-4" aria-hidden /> Create {fileName}
            </Button>
            <Verdict tone="neutral">Every line of text becomes a row, and text that starts at the same left edge on several lines becomes a column. Check the columns before relying on the numbers.</Verdict>
          </div>
        );
      }}
    </PdfConvert>
  );
}

/* ================================================================== */
/* PDF to Word                                                         */
/* ================================================================== */

function BlockPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div role="region" aria-label="Document preview" className="max-h-72 space-y-2 overflow-auto rounded-md bg-muted p-4 text-sm leading-relaxed">
      {blocks.slice(0, 60).map((b, i) =>
        b.kind === "heading" ? (
          <p key={i} className="text-base font-semibold">
            {b.text}
          </p>
        ) : (
          <p key={i}>{b.text.length > 400 ? `${b.text.slice(0, 400)}…` : b.text}</p>
        )
      )}
      {blocks.length > 60 && <p className="text-xs text-muted-foreground">The preview shows the first 60 paragraphs. The download has everything.</p>}
    </div>
  );
}

export function PdfToWord() {
  return (
    <PdfConvert verb="turn it into a Word document">
      {({ pages, stem }) => {
        const blocks = linesToBlocks(pages);
        const headings = blocks.filter((b) => b.kind === "heading").length;
        return (
          <div className="space-y-4">
            <ResultHero
              label="Paragraphs"
              value={blocks.length.toLocaleString("en-US")}
              sub={`${plural(headings, "heading")} · ${plural(wordCount(blocks.map((b) => b.text).join(" ")), "word")} · from ${plural(pages.length, "page")}`}
            />
            <BlockPreview blocks={blocks} />
            <Button type="button" className="w-full gap-2" onClick={() => downloadBlob(`${stem}.docx`, bytesToBlob(buildDocx(blocks, stem), DOCX_MIME))}>
              <Download className="h-4 w-4" aria-hidden /> Download {stem}.docx
            </Button>
            <Verdict tone="neutral">The document keeps the text, paragraphs and headings. Page layout, columns, images and tables are not carried over, so expect to tidy the formatting.</Verdict>
          </div>
        );
      }}
    </PdfConvert>
  );
}

/* ================================================================== */
/* PDF to EPUB                                                         */
/* ================================================================== */

export function PdfToEpub() {
  const [title, setTitle] = React.useState("");
  const [perChapter, setPerChapter] = React.useState("10");
  return (
    <PdfConvert
      verb="turn it into an EPUB e-book"
      options={
        <FieldGrid>
          <TextField label="Book title" value={title} onChange={setTitle} placeholder="Taken from the file name" />
          <SelectField
            label="Chapter every"
            value={perChapter}
            onChange={setPerChapter}
            options={[
              { value: "1", label: "Page" },
              { value: "5", label: "5 pages" },
              { value: "10", label: "10 pages" },
              { value: "25", label: "25 pages" },
              { value: "1000", label: "Whole book as one chapter" },
            ]}
          />
        </FieldGrid>
      }
    >
      {({ pages, stem }) => {
        const size = Number(perChapter);
        const bookTitle = title.trim() || stem;
        const chapters: EpubChapter[] = [];
        for (let start = 0; start < pages.length; start += size) {
          const slice = pages.slice(start, start + size);
          const blocks = linesToBlocks(slice);
          if (blocks.length === 0) continue;
          const end = start + slice.length;
          chapters.push({ title: size >= pages.length ? bookTitle : start + 1 === end ? `Page ${end}` : `Pages ${start + 1}–${end}`, blocks });
        }
        const make = () => {
          const bytes = buildEpub(chapters, bookTitle, crypto.randomUUID(), new Date());
          downloadBlob(`${sheetFileName(bookTitle)}.epub`, bytesToBlob(bytes, "application/epub+zip"));
        };
        return (
          <div className="space-y-4">
            <ResultHero label="Chapters" value={chapters.length.toLocaleString("en-US")} sub={`${plural(wordCount(chapters.flatMap((c) => c.blocks.map((b) => b.text)).join(" ")), "word")} · from ${plural(pages.length, "page")}`} />
            <BlockPreview blocks={chapters.flatMap((c) => c.blocks)} />
            <Button type="button" className="w-full gap-2" onClick={make}>
              <Download className="h-4 w-4" aria-hidden /> Download {sheetFileName(bookTitle)}.epub
            </Button>
            <Verdict tone="neutral">The e-book is reflowable text with headings, so it resizes on any reader. Images, tables and the original page layout are left out.</Verdict>
          </div>
        );
      }}
    </PdfConvert>
  );
}
