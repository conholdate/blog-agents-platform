# URL Validator

Scans all blog post frontmatter for URL issues and reports findings to a Google Spreadsheet.

The validation logic is also integrated into the **Blog Agents Platform** UI — use the dashboard for interactive runs, or this CLI for scripted/offline use.

Each run covers one domain, selected via `--domain` (defaults to `blog.aspose.com`). The GitHub Actions workflow (below) drives all 6 domains by running the script once per domain with different env vars.

Results can go to either of two destinations:
- **Consolidated spreadsheet** (recommended, used when `URL_VALIDATOR_SPREADSHEET_ID` is set) — one persistent tab per domain, updated in place each run, plus a shared `History` tab with one summary row per run. No tab sprawl.
- **Legacy per-domain spreadsheets** (used when `URL_VALIDATOR_SPREADSHEET_ID` is unset) — each run creates two new dated tabs in that domain's own spreadsheet.

## What it checks

| Error | Description |
|---|---|
| `MISSING_URL` | No `url` field in frontmatter |
| `MISSING_TRAILING_SLASH` | URL doesn't end with `/` |
| `WRONG_PRODUCT` | URL product segment doesn't match the post's product folder |
| `DATE_BASED_URL` | URL uses `/YYYY/MM/DD/slug/` format instead of `/product/slug/` |
| `URL_TOO_SHORT` | URL has too few path segments |
| `LANG_CODE_MISMATCH` | Translated file's URL has the wrong language prefix |
| `URL_MISMATCH_WITH_ENGLISH` | Translated URL slug differs from the English base URL |
| `NO_ENGLISH_BASE` | Translated file exists but `index.md` is missing |

## Setup

**1. Install dependencies**

```bash
cd url-validator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**2. Configure `.env`**

Create a `.env` file inside `url-validator/`:

```env
# Shared service account — paste the full service account JSON value from Vercel env vars
GOOGLE_SERVICE_ACCOUNT_JSON=<paste-service-account-json-here>

# Consolidated spreadsheet (recommended) — one persistent tab per domain + a History tab
URL_VALIDATOR_SPREADSHEET_ID=your-consolidated-spreadsheet-id

# Content directory per domain (only the ones you run locally need a value)
URL_VALIDATOR_CONTENT_DIR_ASPOSE_COM=/path/to/aspose-blog/content/Aspose.Blog
URL_VALIDATOR_CONTENT_DIR_ASPOSE_CLOUD=/path/to/aspose-cloud-blog/content/Aspose.Cloud
URL_VALIDATOR_CONTENT_DIR_GROUPDOCS_COM=/path/to/groupdocs-blog/content/Groupdocs.Blog
URL_VALIDATOR_CONTENT_DIR_GROUPDOCS_CLOUD=/path/to/groupdocs-cloud-blog/content/GroupDocs.Cloud
URL_VALIDATOR_CONTENT_DIR_CONHOLDATE_COM=/path/to/conholdate-blog/content/Conholdate.Total
URL_VALIDATOR_CONTENT_DIR_CONHOLDATE_CLOUD=/path/to/blog.conholdate.cloud/content/Conholdate.Cloud

# Legacy: only needed if URL_VALIDATOR_SPREADSHEET_ID is unset (per-domain spreadsheets)
URL_VALIDATOR_SHEET_ID_ASPOSE_COM=
URL_VALIDATOR_SHEET_ID_ASPOSE_CLOUD=
URL_VALIDATOR_SHEET_ID_GROUPDOCS_COM=
URL_VALIDATOR_SHEET_ID_GROUPDOCS_CLOUD=
URL_VALIDATOR_SHEET_ID_CONHOLDATE_COM=
URL_VALIDATOR_SHEET_ID_CONHOLDATE_CLOUD=
```

The tool uses the same `GOOGLE_SERVICE_ACCOUNT_JSON` env var as the dashboard — paste the same JSON value from `dashboard/.env.local`. The spreadsheet must be shared with that service account email (`client_email` in the JSON) with **Editor** access.

As a fallback, credentials can still be placed in `credentials.json` (see `credentials.example.json`).

`BLOG_CONTENT_DIR` (legacy, no domain suffix) still works as an override but only for `blog.aspose.com` — it's intentionally not a cross-domain fallback, since that previously caused a run for one domain to scan another domain's content directory.

## Usage

**First time with the consolidated spreadsheet:** create its tabs before running a real scan —

```bash
source venv/bin/activate
python3 main.py --prepare-sheet
```

This only creates whatever's missing (the 6 domain tabs + `History`); it never touches a tab that already exists.

**Run a scan:**

```bash
source venv/bin/activate
python3 main.py --domain blog.aspose.com
```

The script will:
1. Scan all product and post directories under that domain's content dir
2. Print progress per product to the terminal
3. Write results:
   - If `URL_VALIDATOR_SPREADSHEET_ID` is set: update that domain's persistent tab in place, and append one row to `History`
   - Otherwise: create two new dated tabs (`YYYY-MM-DD` and `YYYY-MM-DD – Summary`) in that domain's own spreadsheet

## Output example

```
Scanning posts...
  ✓ words (198 posts)
  ✓ cells (87 posts)
  ...

Scan complete:
  Products : 12
  Posts    : 4021
  Files    : 18374
  Issues   : 237

  MISSING_TRAILING_SLASH              98
  WRONG_PRODUCT                       61
  MISSING_URL                         44
  ...
```

## Running via GitHub Actions

`.github/workflows/url-validator.yml` runs the scan for all 6 domains on a daily schedule, or on demand via the Actions tab (`workflow_dispatch`, with an optional single-domain selector). Each domain runs as its own matrix job that checks out that domain's content repo, so no local checkout is needed.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|---|---|
| `CONTENT_REPOS_PAT` | Classic PAT with `repo` scope, used to check out the 6 (mostly private) content repos. If any of those orgs enforce SAML SSO, authorize the token for that org too. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Same service account JSON used by the dashboard and local `.env` setup. |
| `URL_VALIDATOR_SPREADSHEET_ID` | The consolidated spreadsheet ID — run `python3 main.py --prepare-sheet` once locally before relying on the workflow, so the domain tabs already exist. |
| `URL_VALIDATOR_SHEET_ID_ASPOSE_COM` | Legacy per-domain fallback, only used if `URL_VALIDATOR_SPREADSHEET_ID` is unset. |
| `URL_VALIDATOR_SHEET_ID_ASPOSE_CLOUD` | Legacy per-domain fallback, only used if `URL_VALIDATOR_SPREADSHEET_ID` is unset. |
| `URL_VALIDATOR_SHEET_ID_GROUPDOCS_COM` | Legacy per-domain fallback, only used if `URL_VALIDATOR_SPREADSHEET_ID` is unset. |
| `URL_VALIDATOR_SHEET_ID_GROUPDOCS_CLOUD` | Legacy per-domain fallback, only used if `URL_VALIDATOR_SPREADSHEET_ID` is unset. |
| `URL_VALIDATOR_SHEET_ID_CONHOLDATE_COM` | Legacy per-domain fallback, only used if `URL_VALIDATOR_SPREADSHEET_ID` is unset. |
| `URL_VALIDATOR_SHEET_ID_CONHOLDATE_CLOUD` | Legacy per-domain fallback, only used if `URL_VALIDATOR_SPREADSHEET_ID` is unset. |

Content repo → path mapping used by the workflow:

| Domain | Content repo | Content path |
|---|---|---|
| blog.aspose.com | `aspose/aspose-blog` | `content/Aspose.Blog` |
| blog.aspose.cloud | `aspose-cloud/aspose-cloud-blog` | `content/Aspose.Cloud` |
| blog.groupdocs.com | `groupdocs/groupdocs-blog` | `content/Groupdocs.Blog` |
| blog.groupdocs.cloud | `groupdocs-cloud/groupdocs-cloud-blog` | `content/GroupDocs.Cloud` |
| blog.conholdate.com | `conholdate/conholdate-blog` | `content/Conholdate.Total` |
| blog.conholdate.cloud | `conholdate-cloud/blog.conholdate.cloud` | `content/Conholdate.Cloud` |

## Tests

```bash
source venv/bin/activate
python3 -m pytest test_main.py -v
```

70 tests covering all validation rules, edge cases, and filesystem scanning.

## Security

Both `.env` and `credentials.json` are listed in `.gitignore` and will never be committed. Only `credentials.example.json` (with placeholder values) is tracked in git.
