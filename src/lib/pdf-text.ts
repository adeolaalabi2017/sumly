/**
 * Turn the positioned text pdf.js reads from a page into lines, table rows,
 * paragraphs and the file formats built from them (DOCX, EPUB). Everything
 * here is pure so it can be tested without a PDF or a browser.
 *
 * A PDF stores text as fragments with coordinates and no notion of rows or
 * paragraphs, so these are best-effort rebuilds: they suit text-based PDFs
 * with simple layouts and cannot recover a scanned page (no text to read).
 */
import { zipSync, strToU8, type Zippable } from "fflate";

/** One text fragment, in PDF space (origin bottom-left, y grows upward). */
export interface TextFragment {
  str: string;
  x: number;
  y: number;
  width: number;
  /** Font height in points. */
  height: number;
}

/** A run of fragments close enough together to be one piece of text. */
export interface Cell {
  x: number;
  text: string;
}

export interface Line {
  y: number;
  /** Tallest fragment on the line, in points. */
  height: number;
  cells: Cell[];
}

export type Block = { kind: "heading" | "paragraph"; text: string };

/** Strip characters XML 1.0 forbids; they appear in PDFs as stray control codes. */
export const cleanText = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/ /g, " ");

/** Group fragments into lines top to bottom, and into cells left to right. */
export function buildLines(fragments: TextFragment[]): Line[] {
  const frags = fragments
    .map((f) => ({ ...f, str: cleanText(f.str), height: f.height > 0 ? f.height : 10 }))
    .filter((f) => f.str.trim() !== "");
  frags.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: { y: number; height: number; items: typeof frags }[] = [];
  for (const f of frags) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - f.y) <= 0.4 * Math.max(f.height, row.height, 4)) {
      row.items.push(f);
      row.height = Math.max(row.height, f.height);
    } else {
      rows.push({ y: f.y, height: f.height, items: [f] });
    }
  }

  return rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    let end = -Infinity;
    for (const it of row.items) {
      const prev = cells[cells.length - 1];
      const gap = it.x - end;
      if (!prev || gap >= row.height) {
        cells.push({ x: it.x, text: it.str.trim() });
      } else {
        const needsSpace = gap > 0.12 * row.height && !/\s$/.test(prev.text) && !/^\s/.test(it.str);
        prev.text = (prev.text + (needsSpace ? " " : "") + it.str).replace(/\s+$/, "");
      }
      end = it.x + it.width;
    }
    return { y: row.y, height: row.height, cells };
  });
}

/** A line as plain text; cells that sat in separate columns are split by two spaces. */
export const lineText = (line: Line) => line.cells.map((c) => c.text).join("  ");

/**
 * Lay lines out as table rows. Column positions come from where cells start:
 * start positions within `tolerance` points merge into one column, and a column
 * must be used by more than one row (unless there is only one row) to count.
 */
export function linesToRows(lines: Line[], tolerance = 6): string[][] {
  const starts = lines.flatMap((l) => l.cells.map((c) => c.x)).sort((a, b) => a - b);
  const groups: { x: number; n: number }[] = [];
  for (const x of starts) {
    const g = groups[groups.length - 1];
    if (g && x - g.x <= tolerance) {
      g.x = (g.x * g.n + x) / (g.n + 1);
      g.n += 1;
    } else groups.push({ x, n: 1 });
  }
  const need = lines.length > 1 ? 2 : 1;
  const anchors = groups.filter((g) => g.n >= need).map((g) => g.x);
  if (anchors.length === 0) return lines.map((l) => l.cells.map((c) => c.text));

  return lines.map((line) => {
    const row: string[] = Array(anchors.length).fill("");
    for (const cell of line.cells) {
      // The last anchor at or left of the cell (with slack), else the first.
      let col = 0;
      for (let i = 0; i < anchors.length; i++) if (anchors[i] <= cell.x + tolerance) col = i;
      row[col] = row[col] ? `${row[col]} ${cell.text}` : cell.text;
    }
    return row;
  });
}

/** The most common line height, which is the body text size. */
function bodyHeight(lines: Line[]): number {
  const counts = new Map<number, number>();
  for (const l of lines) {
    const h = Math.round(l.height * 2) / 2;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best = 0;
  let bestN = 0;
  for (const [h, n] of counts) if (n > bestN) [best, bestN] = [h, n];
  return best;
}

/**
 * Join lines into paragraphs and headings. A larger gap than normal line
 * spacing starts a new paragraph, and short lines set in a clearly larger
 * size become headings. Table rows stay one paragraph each. A hyphen at the end of a line is joined to the word
 * that continues on the next one.
 */
export function linesToBlocks(pages: Line[][]): Block[] {
  const body = bodyHeight(pages.flat());
  const blocks: Block[] = [];
  for (const lines of pages) {
    let open: Block | null = null;
    let lastY = 0;
    let lastHeight = 0;
    let lastColumns = false;
    for (const line of lines) {
      const text = line.cells.map((c) => c.text).join(" ");
      const heading = body > 0 && line.height >= body * 1.25 && text.length <= 120;
      const gap = lastY - line.y;
      // Lines made of several columns are table rows: each stays its own paragraph.
      const columns = line.cells.length > 1;
      const breaks = !open || heading || open.kind === "heading" || columns || lastColumns || gap > 1.7 * Math.max(line.height, lastHeight);
      if (breaks) {
        open = { kind: heading ? "heading" : "paragraph", text };
        blocks.push(open);
      } else if (open) {
        open.text = /[A-Za-z]-$/.test(open.text) && /^[a-z]/.test(text) ? open.text.slice(0, -1) + text : `${open.text} ${text}`;
      }
      lastY = line.y;
      lastHeight = line.height;
      lastColumns = columns;
    }
  }
  return blocks;
}

/** Plain text for a document: a blank line between paragraphs and between pages. */
export function pagesToText(pages: Line[][], separatePages: boolean): string {
  return pages
    .map((lines) =>
      linesToBlocks([lines])
        .map((b) => b.text)
        .join("\n\n")
    )
    .filter(Boolean)
    .map((t, i) => (separatePages ? `--- Page ${i + 1} ---\n\n${t}` : t))
    .join("\n\n");
}

/** Quote a field the standard way, and neutralise formulas that spreadsheets would run. */
export function csvField(v: string, delimiter: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) && !/^[+-]?\d[\d.,]*$/.test(v) ? `'${v}` : v;
  return safe.includes(delimiter) || /["\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function rowsToCsv(rows: string[][], delimiter = ","): string {
  return rows.map((r) => r.map((v) => csvField(v, delimiter)).join(delimiter)).join("\r\n");
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

export const xmlEscape = (s: string) =>
  cleanText(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/** A minimal, valid Word document: Normal and Heading 1 styles and one paragraph per block. */
export function buildDocx(blocks: Block[], title: string): Uint8Array {
  const body = blocks
    .map((b) =>
      b.kind === "heading"
        ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(b.text)}</w:t></w:r></w:p>`
        : `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(b.text)}</w:t></w:r></w:p>`
    )
    .join("");
  const files: Zippable = {
    "[Content_Types].xml": strToU8(
      `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
    ),
    "_rels/.rels": strToU8(
      `${XML_DECL}<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
    ),
    "docProps/core.xml": strToU8(
      `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEscape(title)}</dc:title></cp:coreProperties>`
    ),
    "word/_rels/document.xml.rels": strToU8(
      `${XML_DECL}<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    ),
    "word/styles.xml": strToU8(
      `${XML_DECL}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>`
    ),
    "word/document.xml": strToU8(
      `${XML_DECL}<w:document xmlns:w="${W_NS}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`
    ),
  };
  return zipSync(files, { level: 6 });
}

/* ------------------------------------------------------------------ */
/* EPUB                                                                */
/* ------------------------------------------------------------------ */

export interface EpubChapter {
  title: string;
  blocks: Block[];
}

const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** A valid EPUB 3 file: stored mimetype first, a nav document and one XHTML file per chapter. */
export function buildEpub(chapters: EpubChapter[], title: string, id: string, modified: Date): Uint8Array {
  const chapterFiles = chapters.map((c, i) => ({
    href: `chapter-${i + 1}.xhtml`,
    id: `ch${i + 1}`,
    title: c.title,
    xhtml: `${XML_DECL}<html xmlns="${XHTML_NS}" xml:lang="en" lang="en"><head><meta charset="utf-8"/><title>${xmlEscape(c.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${c.blocks
      .map((b) => (b.kind === "heading" ? `<h2>${xmlEscape(b.text)}</h2>` : `<p>${xmlEscape(b.text)}</p>`))
      .join("")}</body></html>`,
  }));
  const stamp = modified.toISOString().replace(/\.\d+Z$/, "Z");
  const nav = `${XML_DECL}<html xmlns="${XHTML_NS}" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><meta charset="utf-8"/><title>Contents</title></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${chapterFiles
    .map((c) => `<li><a href="${c.href}">${xmlEscape(c.title)}</a></li>`)
    .join("")}</ol></nav></body></html>`;
  const opf = `${XML_DECL}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${xmlEscape(id)}</dc:identifier><dc:title>${xmlEscape(title)}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">${stamp}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${chapterFiles
    .map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
    .join("")}</manifest><spine>${chapterFiles.map((c) => `<itemref idref="${c.id}"/>`).join("")}</spine></package>`;

  const files: Zippable = {
    // The mimetype entry must come first and be stored, not compressed.
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      `${XML_DECL}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
    ),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
    "OEBPS/style.css": strToU8("body{font-family:serif;line-height:1.5;margin:5%}h2{margin:1.5em 0 .5em}p{margin:0 0 .9em}"),
  };
  for (const c of chapterFiles) files[`OEBPS/${c.href}`] = strToU8(c.xhtml);
  return zipSync(files, { level: 6 });
}
