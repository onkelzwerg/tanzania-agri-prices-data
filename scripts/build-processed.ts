/**
 * Concatenates every weekly CSV in data/raw/ into a single long-format file
 * data/processed/prices.csv (one header, chronological). This is the file the
 * web app fetches via jsDelivr — the raw per-week files stay the source of
 * truth, this is a generated convenience artifact.
 *
 *   bun scripts/build-processed.ts          # write
 *   bun scripts/build-processed.ts --check  # verify committed file is current (CI)
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "data", "processed", "prices.csv");
const HEADER = "week_start,week_end,region,crop,price";

const files: string[] = [];
for (const year of (await readdir(RAW)).filter((d) => /^\d{4}$/.test(d)).sort()) {
  for (const name of (await readdir(join(RAW, year))).filter((n) => n.endsWith(".csv")).sort()) {
    files.push(join(RAW, year, name));
  }
}

const out = [HEADER];
for (const file of files) {
  const lines = (await readFile(file, "utf8")).split("\n");
  if (lines[0] !== HEADER) throw new Error(`${file}: unexpected header`);
  for (const line of lines.slice(1)) if (line !== "") out.push(line);
}
const content = out.join("\n") + "\n";

if (process.argv.includes("--check")) {
  const current = await readFile(OUT, "utf8").catch(() => "");
  if (current !== content) {
    console.error(
      "data/processed/prices.csv is out of date. Run `bun scripts/build-processed.ts` and commit.",
    );
    process.exit(1);
  }
  console.log(`OK: data/processed/prices.csv is current (${out.length - 1} rows).`);
} else {
  await mkdir(join(ROOT, "data", "processed"), { recursive: true });
  await writeFile(OUT, content);
  console.log(`Wrote data/processed/prices.csv (${out.length - 1} rows from ${files.length} weeks).`);
}
