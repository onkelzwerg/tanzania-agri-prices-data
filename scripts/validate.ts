/**
 * Validates every CSV in data/raw/ plus data/provenance.csv against the rules
 * in schema/datapackage.json (kept in sync by hand — this script is the
 * enforcement, the datapackage is the documentation).
 *
 *   bun scripts/validate.ts
 *
 * Zero dependencies; runs in CI on every push/PR.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const RAW = join(ROOT, "data", "raw");

const HEADER = "week_start,week_end,region,crop,price";
const CROPS = new Set([
  "maize",
  "rice",
  "beans",
  "sorghum",
  "bulrush_millet",
  "finger_millet",
  "round_potato",
]);
const REGIONS = new Set([
  "National Average",
  "Arusha",
  "Dar es Salaam",
  "Dodoma",
  "Geita",
  "Iringa",
  "Kagera",
  "Katavi",
  "Kigoma",
  "Kilimanjaro",
  "Lindi",
  "Manyara",
  "Mara",
  "Mbeya",
  "Morogoro",
  "Mtwara",
  "Mwanza",
  "Njombe",
  "Pemba North",
  "Pemba South",
  "Pwani",
  "Rukwa",
  "Ruvuma",
  "Shinyanga",
  "Simiyu",
  "Singida",
  "Songwe",
  "Tabora",
  "Tanga",
  "Unguja North",
  "Unguja South",
  "Mjini Magharibi",
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

const errors: string[] = [];
function err(file: string, line: number | null, msg: string) {
  errors.push(`${file}${line === null ? "" : `:${line}`}: ${msg}`);
}

/** Minimal RFC-4180 line parser (source_file names contain commas). */
function parseCsvLine(line: string): string[] | null {
  const cols: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"' && cur === "") {
      quoted = true;
    } else if (ch === ",") {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (quoted) return null;
  cols.push(cur);
  return cols;
}

function parseDate(s: string): number | null {
  if (!ISO_DATE.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  // Reject dates that normalize differently (e.g. 2025-02-30).
  if (new Date(t).toISOString().slice(0, 10) !== s) return null;
  return t;
}

// ---- data/raw/<year>/<week_start>.csv ----
const weekFiles: string[] = [];
for (const year of (await readdir(RAW)).sort()) {
  if (!/^\d{4}$/.test(year)) {
    err(`data/raw/${year}`, null, "unexpected entry; expected 4-digit year directories");
    continue;
  }
  for (const name of (await readdir(join(RAW, year))).sort()) {
    weekFiles.push(join(year, name));
  }
}

const weeksSeen = new Set<string>();

for (const rel of weekFiles) {
  const file = `data/raw/${rel}`;
  const [year, name] = rel.split("/");
  const weekFromName = name.replace(/\.csv$/, "");
  if (!name.endsWith(".csv") || parseDate(weekFromName) === null) {
    err(file, null, "file name must be <week_start>.csv with an ISO date");
    continue;
  }
  if (!weekFromName.startsWith(year)) {
    err(file, null, `file is in ${year}/ but week starts ${weekFromName}`);
  }
  weeksSeen.add(weekFromName);

  const text = await readFile(join(RAW, rel), "utf8");
  const lines = text.split("\n");
  if (lines[lines.length - 1] !== "") err(file, null, "must end with a newline");
  const rows = lines.filter((l) => l !== "");
  if (rows[0] !== HEADER) {
    err(file, 1, `header must be exactly "${HEADER}"`);
    continue;
  }

  const keys = new Set<string>();
  const regionsInFile = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const lineNo = i + 1;
    const cols = rows[i].split(",");
    if (cols.length !== 5) {
      err(file, lineNo, `expected 5 columns, got ${cols.length}`);
      continue;
    }
    const [start, end, region, crop, price] = cols;
    const startMs = parseDate(start);
    const endMs = parseDate(end);
    if (startMs === null) err(file, lineNo, `week_start "${start}" is not an ISO date`);
    if (endMs === null) err(file, lineNo, `week_end "${end}" is not an ISO date`);
    if (start !== weekFromName) err(file, lineNo, `week_start "${start}" != file name week`);
    if (startMs !== null && endMs !== null) {
      const span = (endMs - startMs) / DAY_MS;
      if (span < 1 || span > 7) err(file, lineNo, `week spans ${span} days (expected 1-7)`);
    }
    if (!REGIONS.has(region)) err(file, lineNo, `unknown region "${region}"`);
    if (!CROPS.has(crop)) err(file, lineNo, `unknown crop "${crop}"`);
    if (price !== "") {
      if (!/^[1-9]\d*$/.test(price)) {
        err(file, lineNo, `price "${price}" must be a positive integer or empty (never 0)`);
      }
    }
    const key = `${region}|${crop}`;
    if (keys.has(key)) err(file, lineNo, `duplicate row for ${key}`);
    keys.add(key);
    regionsInFile.add(region);
  }

  for (const region of regionsInFile) {
    let count = 0;
    for (const key of keys) if (key.startsWith(`${region}|`)) count++;
    if (count !== CROPS.size) {
      err(file, null, `region "${region}" has ${count} crop rows, expected ${CROPS.size}`);
    }
  }
}

// ---- data/provenance.csv ----
const PROV_HEADER = "week_start,source_file,source_sha256,source_url,imported_at,notes";
const provText = await readFile(join(ROOT, "data", "provenance.csv"), "utf8");
const provRows = provText.split("\n").filter((l) => l !== "");
const provWeeks = new Set<string>();
if (provRows[0] !== PROV_HEADER) {
  err("data/provenance.csv", 1, `header must be exactly "${PROV_HEADER}"`);
} else {
  for (let i = 1; i < provRows.length; i++) {
    const lineNo = i + 1;
    const cols = parseCsvLine(provRows[i]);
    if (cols === null || cols.length !== 6) {
      err("data/provenance.csv", lineNo, `expected 6 well-formed columns`);
      continue;
    }
    const [week, sourceFile, sha, , importedAt] = cols;
    if (parseDate(week) === null) err("data/provenance.csv", lineNo, `bad week_start "${week}"`);
    if (!sourceFile) err("data/provenance.csv", lineNo, "source_file is required");
    if (!/^[0-9a-f]{64}$/.test(sha)) err("data/provenance.csv", lineNo, "bad source_sha256");
    if (parseDate(importedAt) === null) err("data/provenance.csv", lineNo, "bad imported_at");
    if (provWeeks.has(week)) err("data/provenance.csv", lineNo, `duplicate week ${week}`);
    provWeeks.add(week);
  }
}

for (const w of weeksSeen) {
  if (!provWeeks.has(w)) err("data/provenance.csv", null, `missing provenance for week ${w}`);
}
for (const w of provWeeks) {
  if (!weeksSeen.has(w)) err("data/provenance.csv", null, `provenance for week ${w} without CSV`);
}

if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR ${e}`);
  console.error(`\n${errors.length} error(s) in ${weekFiles.length} week file(s).`);
  process.exit(1);
}
console.log(`OK: ${weekFiles.length} week files + provenance validated, no errors.`);
