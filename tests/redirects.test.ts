import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import {
  appendSegmentRequestKeyPart,
  convertSegmentPathToStaticExportFilename,
  createSegmentRequestKeyPart,
  ROOT_SEGMENT_REQUEST_KEY,
} from "next/dist/shared/lib/segment-cache/segment-value-encoding";

type Rule = { from: string; to: string; status: number };

const rules: Rule[] = readFileSync(join(process.cwd(), "public/_redirects"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [from, to, status] = line.split(/\s+/);
    return { from, to, status: Number(status) };
  });

/** Apply the first matching rule the way Cloudflare does: `:name` matches one path segment. */
function apply(path: string): { status: number; path: string } | null {
  for (const { from, to, status } of rules) {
    const pattern = from
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:([A-Za-z]\w*)/g, "(?<$1>[^/]+)");
    const match = path.match(new RegExp(`^${pattern}$`));
    if (match) {
      return { status, path: to.replace(/:([A-Za-z]\w*)/g, (_, name) => match.groups![name]) };
    }
  }
  return null;
}

/** The page payload URL Next requests for each dynamic route under src/app. */
function dynamicPayloadPaths(): string[] {
  const appDir = join(process.cwd(), "src/app");
  return (readdirSync(appDir, { recursive: true }) as string[])
    .filter((file) => file.endsWith(`${sep}page.tsx`) && file.includes("["))
    .map((file) => {
      const folders = file.split(sep).slice(0, -1);
      let key = ROOT_SEGMENT_REQUEST_KEY;
      for (const folder of folders) {
        const param = folder.match(/^\[(\w+)\]$/)?.[1];
        const part = createSegmentRequestKeyPart(param ? [param, "x", "d", null] : folder);
        key = appendSegmentRequestKeyPart(key, "children", part);
      }
      const url = folders.map((f) => (f.startsWith("[") ? "sample" : f)).join("/");
      return `/${url}/${convertSegmentPathToStaticExportFilename(`${key}/__PAGE__`)}`;
    });
}

/** Cloudflare's asset server redirects (307) any path that differs from this form. */
const canonical = (path: string) => path.split("/").map(encodeURIComponent).join("/");

describe("public/_redirects: Next page payloads are served without a 307", () => {
  const paths = dynamicPayloadPaths();

  test("the dynamic routes are discovered", () => {
    expect(paths.sort()).toEqual([
      "/professions/sample/__next.professions.$d$profession.__PAGE__.txt",
      "/sample/__next.$d$domain.__PAGE__.txt",
      "/sample/sample/__next.$d$domain.$d$tool.__PAGE__.txt",
    ]);
  });

  test("each literal $ path is rewritten (200) to its encoded form", () => {
    for (const path of paths) {
      expect(apply(path), path).toEqual({ status: 200, path: canonical(path) });
    }
  });
});
