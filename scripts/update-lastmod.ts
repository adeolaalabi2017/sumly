/**
 * Refresh src/lib/registry/lastmod.json.
 *
 *   bun run lastmod                 stamp changed or new tools with today's date
 *   bun run lastmod -- --date 2026-11-20   use a specific date (also seeds a fresh manifest)
 *
 * A tool whose fingerprint is unchanged keeps its old date, so unchanged pages
 * keep an unchanged <lastmod>.
 */
import fs from "node:fs";
import path from "node:path";
import { TOOLS } from "../src/lib/registry";
import { toolFingerprint, type LastmodManifest } from "../src/lib/lastmod";

const file = path.join(import.meta.dir, "../src/lib/registry/lastmod.json");
const argIndex = process.argv.indexOf("--date");
const today = new Date().toLocaleDateString("en-CA");
const date = argIndex > -1 ? process.argv[argIndex + 1] : today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error(`Bad date "${date}". Use YYYY-MM-DD.`);
  process.exit(1);
}

const previous: LastmodManifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const next: LastmodManifest = {};
const changed: string[] = [];

for (const t of TOOLS) {
  const hash = toolFingerprint(t.slug);
  if (!hash) throw new Error(`No content for ${t.slug}`);
  const old = previous[t.slug];
  if (old && old.hash === hash) {
    next[t.slug] = old;
  } else {
    next[t.slug] = { hash, date };
    changed.push(t.slug);
  }
}
const removed = Object.keys(previous).filter((s) => !next[s]);

fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
console.log(`lastmod: ${changed.length} updated to ${date}, ${removed.length} removed, ${TOOLS.length - changed.length} unchanged`);
for (const s of changed.slice(0, 20)) console.log(`  ~ ${s}`);
if (changed.length > 20) console.log(`  … and ${changed.length - 20} more`);
