# Tanzania Agricultural Prices — Data

Weekly wholesale prices for seven food crops across Tanzanian mainland regions,
extracted from the **Weekly Market Bulletins** published by the Tanzanian
Ministry of Agriculture.

This repository holds the growing, machine-readable dataset. The extraction
code (PDF parser + web app) lives in the companion repository
[`tanzania-agri-prices`](https://github.com/onkelzwerg/tanzania-agri-prices).

## Coverage

| | |
|---|---|
| Weeks | 67 (2024-12-02 … 2026-05-25, plus one new bulletin per week) |
| Regions | 26 mainland regions + "National Average" |
| Crops | maize, rice, beans, sorghum, bulrush millet, finger millet, round potato |
| Rows | ~10,300 (about 80 % carry a price; the rest were not reported) |

Not every region reports every week, and some weeks were never published.
Known gaps (no bulletin available): 2025-03-17, 2025-06-30, 2025-10-27,
2025-12-22, 2026-01-12, 2026-01-26, 2026-02-02, 2026-02-23, 2026-03-02,
2026-04-06, 2026-04-27.

## Layout & schema

```
data/
  raw/<year>/<week_start>.csv   one file per bulletin week (long format, source of truth)
  processed/prices.csv          all weeks concatenated (generated; what the web app fetches)
  provenance.csv                source PDF, SHA-256 and import date per week
schema/datapackage.json         machine-readable schema (Frictionless-style)
scripts/validate.ts             validation, runs in CI on every push/PR
scripts/build-processed.ts      regenerates data/processed/prices.csv
```

`data/processed/prices.csv` is a generated artifact — do not edit it by hand.
Regenerate it with `bun scripts/build-processed.ts` after changing any week
file; CI fails if the committed copy is stale. The companion web app loads it
over [jsDelivr](https://www.jsdelivr.com/):
`https://cdn.jsdelivr.net/gh/onkelzwerg/tanzania-agri-prices-data@main/data/processed/prices.csv`

Each week file is long-format CSV:

```csv
week_start,week_end,region,crop,price
2026-05-11,2026-05-15,Arusha,maize,800
2026-05-11,2026-05-15,Arusha,bulrush_millet,
```

- **Unit:** TZS (Tanzanian Shilling) per kilogram — as stated in the bulletins
  ("Unit of measurement: For food, crops are in TZS per kg.").
- **Missing values:** an empty `price` means the bulletin marked the value as
  not available ("-"). Prices are **never 0**; a zero is a data error.
- **Dates:** ISO 8601 (`YYYY-MM-DD`). `week_start`/`week_end` are the Monday
  and Friday printed in the bulletin.
- **Key:** (`week_start`, `region`, `crop`) is unique across the dataset.

Only raw values as printed in the bulletins are stored here — no
interpolation, no aggregation, no seasonal adjustment.

## Provenance & corrections

Every week in `data/provenance.csv` names its source PDF and the file's
SHA-256, so each value can be traced back to a specific ministry publication.
The source PDFs themselves are not part of this repository yet; they will be
added under `sources/` at a later point.

Corrections happen **only as new commits** (never through history rewrites):
if the ministry re-publishes a bulletin or an extraction error is found, the
week's CSV is updated together with a note in `provenance.csv`.

The initial backfill (67 weeks) was re-extracted from the original PDFs with
the parser from the companion repository. It intentionally differs from any
earlier published spreadsheet in 86 cells where a column-shift bug in an older
parser version had misassigned values (mostly the Katavi region); the values
here match the PDFs.

## License & citation

The dataset is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see `LICENSE`).

The underlying price figures originate from the Weekly Market Bulletins of the
**Ministry of Agriculture, United Republic of Tanzania**
([kilimo.go.tz](https://www.kilimo.go.tz)). This dataset is an independent
compilation; it is **not** endorsed by or affiliated with the ministry.

Suggested citation:

> Tanzania Agricultural Prices dataset, compiled from Ministry of Agriculture
> (Tanzania) Weekly Market Bulletins.
> https://github.com/onkelzwerg/tanzania-agri-prices-data

## Validation

```bash
bun scripts/validate.ts
```

Checks schema, date sanity, region/crop enums, NULL-not-zero, key uniqueness
and provenance completeness. CI runs this on every push and pull request.
