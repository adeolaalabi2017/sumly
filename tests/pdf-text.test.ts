import { describe, expect, test } from "bun:test";
import { unzipSync, strFromU8 } from "fflate";
import {
  buildDocx,
  buildEpub,
  buildLines,
  csvField,
  linesToBlocks,
  linesToRows,
  pagesToText,
  rowsToCsv,
  type TextFragment,
} from "@/lib/pdf-text";

const f = (str: string, x: number, y: number, height = 10, width = str.length * 5): TextFragment => ({ str, x, y, width, height });

// A small table: three columns, three rows, the way pdf.js reports it.
const table: TextFragment[] = [
  f("Item", 50, 700), f("Size", 200, 700), f("Price", 320, 700),
  f("Tea", 50, 685), f("Large", 200, 685), f("2.50", 320, 685),
  f("Coffee", 50, 670), f("Small", 200, 670), f("3.10", 320, 670),
];

describe("buildLines", () => {
  test("orders lines top to bottom and splits columns into cells", () => {
    const lines = buildLines([...table].reverse());
    expect(lines.map((l) => l.cells.map((c) => c.text))).toEqual([
      ["Item", "Size", "Price"],
      ["Tea", "Large", "2.50"],
      ["Coffee", "Small", "3.10"],
    ]);
  });

  test("joins fragments of one word and spaces separate words", () => {
    const [line] = buildLines([f("Hel", 10, 100, 10, 15), f("lo", 25, 100, 10, 10), f("world", 40, 100, 10, 25)]);
    expect(line.cells.map((c) => c.text)).toEqual(["Hello world"]);
  });

  test("drops empty and control-character text", () => {
    expect(buildLines([f("   ", 1, 1), f("\u0000\u0001", 5, 1)])).toEqual([]);
  });
});

describe("linesToRows", () => {
  test("finds the columns from where cells start", () => {
    expect(linesToRows(buildLines(table))).toEqual([
      ["Item", "Size", "Price"],
      ["Tea", "Large", "2.50"],
      ["Coffee", "Small", "3.10"],
    ]);
  });

  test("a cell missing from a row leaves its column empty", () => {
    const rows = linesToRows(buildLines([...table, f("Water", 50, 655), f("1.00", 320, 655)]));
    expect(rows[3]).toEqual(["Water", "", "1.00"]);
  });

  test("a single line keeps all its cells", () => {
    expect(linesToRows(buildLines([f("A", 10, 10), f("B", 100, 10)]))).toEqual([["A", "B"]]);
  });
});

describe("paragraphs and text", () => {
  const page = buildLines([
    f("Annual Report", 50, 750, 20, 130),
    f("First line of the", 50, 700), f("paragraph continues.", 50, 688),
    f("A second para-", 50, 660), f("graph starts here.", 50, 648),
  ]);

  test("headings, paragraph breaks and hyphen joins", () => {
    expect(linesToBlocks([page])).toEqual([
      { kind: "heading", text: "Annual Report" },
      { kind: "paragraph", text: "First line of the paragraph continues." },
      { kind: "paragraph", text: "A second paragraph starts here." },
    ]);
  });

  test("table rows stay separate paragraphs", () => {
    expect(linesToBlocks([buildLines(table)]).map((b) => b.text)).toEqual(["Item  Size  Price".replace(/  /g, " "), "Tea Large 2.50", "Coffee Small 3.10"]);
  });

  test("page markers are optional", () => {
    expect(pagesToText([page, page], true)).toContain("--- Page 2 ---");
    expect(pagesToText([page, page], false)).not.toContain("---");
  });
});

describe("CSV output", () => {
  test("quotes separators, quotes and line breaks", () => {
    expect(csvField('a,b', ",")).toBe('"a,b"');
    expect(csvField('say "hi"', ",")).toBe('"say ""hi"""');
    expect(csvField("x;y", ",")).toBe("x;y");
    expect(csvField("x;y", ";")).toBe('"x;y"');
  });

  test("neutralises spreadsheet formulas but leaves numbers alone", () => {
    expect(csvField("=SUM(A1:A9)", ",")).toBe("'=SUM(A1:A9)");
    expect(csvField("@cmd", ",")).toBe("'@cmd");
    expect(csvField("-12.50", ",")).toBe("-12.50");
    expect(csvField("+44 20 7946", ",")).toBe("'+44 20 7946");
  });

  test("rows are joined with CRLF", () => {
    expect(rowsToCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });
});

describe("DOCX and EPUB", () => {
  test("DOCX is a zip with the required parts and escaped text", () => {
    const files = unzipSync(buildDocx([{ kind: "heading", text: "A & B <C>" }, { kind: "paragraph", text: "Body \u0000text" }], "T"));
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "word/_rels/document.xml.rels", "word/document.xml", "word/styles.xml",
    ]);
    const doc = strFromU8(files["word/document.xml"]);
    expect(doc).toContain("A &amp; B &lt;C&gt;");
    expect(doc).toContain("Heading1");
    expect(doc).toContain("Body text");
  });

  test("EPUB stores its mimetype first and uncompressed", () => {
    const bytes = buildEpub([{ title: "Pages 1–2", blocks: [{ kind: "paragraph", text: "Hi" }] }], "Book", "abc", new Date("2026-01-02T03:04:05.678Z"));
    // First local file header: signature, then the file name "mimetype" and its bytes, uncompressed.
    expect(new TextDecoder().decode(bytes.slice(30, 38))).toBe("mimetype");
    expect(new TextDecoder().decode(bytes.slice(38, 58))).toBe("application/epub+zip");
    const files = unzipSync(bytes);
    expect(strFromU8(files["OEBPS/content.opf"])).toContain("2026-01-02T03:04:05Z");
    expect(strFromU8(files["OEBPS/nav.xhtml"])).toContain("Pages 1–2");
    expect(strFromU8(files["OEBPS/chapter-1.xhtml"])).toContain("<p>Hi</p>");
  });
});
