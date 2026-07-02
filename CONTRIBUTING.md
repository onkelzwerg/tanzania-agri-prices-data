# Contributing

Thanks for helping grow this dataset! Two ground rules keep it trustworthy:

1. **No value without a ministry source.** Every number must come from a
   published Weekly Market Bulletin (or another verifiable Ministry of
   Agriculture publication). PRs that add or change values must name the
   source bulletin (file name + SHA-256 in `data/provenance.csv`, ideally with
   a download URL in `source_url`).
2. **No history rewrites.** Corrections are new commits that change the
   week's CSV and add a note to `provenance.csv`. Force-pushes to `main` are
   never OK — downstream users may have cloned the data.

## Adding a new week

1. Extract the bulletin with the parser from the
   [companion repo](https://github.com/onkelzwerg/tanzania-agri-prices):

   ```bash
   cd parser && bun run pdf-to-csv --out /path/to/data-repo/data/raw/<year> bulletin.pdf
   ```

   It writes `<week_start>.csv` and prints the provenance line (JSON) for
   `data/provenance.csv`.

2. Append the provenance row (`week_start,source_file,source_sha256,source_url,imported_at,notes`).
3. Regenerate the combined file: `bun scripts/build-processed.ts`.
4. Run `bun scripts/validate.ts` — it must pass.
5. Open a PR titled `Add week <week_start>`. One bulletin per commit.

CI validates the data **and** checks that `data/processed/prices.csv` is in
sync with the week files, so don't forget step 3.

## Fixing a value

Open an issue or PR that names the week, region, crop, the wrong and the
correct value, and the source bulletin proving it. Update the CSV and add a
`notes` entry in the week's provenance row (e.g. `corrected beans for Mbeya,
see #12`).
