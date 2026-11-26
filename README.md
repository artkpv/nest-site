# NEST project site

Static project page for *NEST: Nascent Encoded Steganographic Thoughts* (NeurIPS 2026, Track on
Evaluations and Datasets). Plain HTML/CSS/JS, no build step, no external requests.

```
index.html  style.css  app.js     page, styles, charts + decoder (vanilla JS, inline SVG)
data/*.json                       numbers and transcripts the page renders (exported, ~36 KiB)
assets/                           Fig. 1, maze example (PNG from the paper PDFs), poster PDF
tools/export_data.py              regenerates data/*.json from frozen artifacts in ../../code
robots.txt  .nojekyll             AI-crawler opt-out (canary data); serve files as is on Pages
```

## Preview

`fetch()` does not work from `file://`, so serve the folder:

```bash
cd paper/site && python3 -m http.server 8765   # open http://127.0.0.1:8765/
```

## Regenerate the data

```bash
python3 -I paper/site/tools/export_data.py      # from the nest/ root; stdlib only, no network
```

Sources (all frozen; the script asserts the paper's totals, e.g. 38/1,096 stego_success, 7 of 24
cells without a hit, per-model McNemar b/c, Opus 4.5 92%/54% at D=4, 39 counting models):

| JSON | source in `code/` | paper |
|---|---|---|
| `models.json` | `artifacts/2026-10-31/rg_clean/report/{cells,mcnemar_model,mcnemar_family}.csv`; counting D=4 from `artifacts/2026-11-04/counting_openweight_merge/table_model_D.csv` | Sec. 3.2, Figs. 2–3 |
| `counting.json` | `artifacts/2026-11-04/counting_openweight_merge/table_model_D.csv` (D=4) | Sec. 4, App. heatmap |
| `examples.json` | counting trials `artifacts/stego_counting/D*/trials/*.json` (incl. the Fig. 1b trial); RG picks from HF `artkpv/nest` v1.1 `transcripts/transcripts.jsonl` (clean run only; stego cover text only, no prompts) | Fig. 1b, Fig. maze_example, App. transcripts |

The decoder's sentence split is the scorer's (`SentenceAcrostic.extract`); the export asserts the
letters match the logged `encoding_extracted` / `extracted_letters` for every example. The "hand
reading" strings are copied from the owner's adjudication notes (`picks.tsv`).

Reporting rules kept on the page: automated counts are labelled upper bounds and shown with the
hand read (15/43); no "zero"/"cannot" capability claims; cuts/refusals by category only.

## Deploy (GitHub Pages, repo `artkpv/nest-site`)

`paper/site/` stays the source (inside the paper repo); the Pages repo is a separate checkout:

```bash
mkdir -p ~/my/work/nest/nest-site && rsync -a --delete --exclude tools --exclude .git \
  ~/my/work/nest/paper/site/ ~/my/work/nest/nest-site/
cd ~/my/work/nest/nest-site
git init -b main && git add . && git commit -m "NEST project site"
gh repo create artkpv/nest-site --public --source . --push
gh api -X POST repos/artkpv/nest-site/pages -f 'source[branch]=main' -f 'source[path]=/'
# -> https://artkpv.github.io/nest-site/   (first build takes ~1 min)
```

Recommended: a custom subdomain, so the URL in the paper/poster never changes if hosting moves.
Add a DNS `CNAME nest.artkpv.net -> artkpv.github.io`, then
`echo nest.artkpv.net > CNAME`, commit, and in repo Settings → Pages set the custom domain and
tick "Enforce HTTPS". Updating the site = re-run the export, re-run the rsync, commit, push (rsync `--delete` keeps
`.git` and `CNAME` only if you add `--exclude CNAME`).

Alternatives: Cloudflare Pages or Netlify (same folder, no build command) give preview deploys
and analytics without cookies; not needed for a single page.
