# URL Validator

Scans all blog post frontmatter for URL issues and reports findings to a Google Spreadsheet.

The validation logic is also integrated into the **Blog Agents Platform** UI — use the dashboard for interactive runs, or this CLI for scripted/offline use.

Currently covers **blog.aspose.com** only. Support for other blog domains (GroupDocs, Conholdate, etc.) is planned.

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
# Absolute path to the blog content directory
BLOG_CONTENT_DIR=/path/to/aspose-blog/content/Aspose.Blog

# Shared service account — paste the full service account JSON value from Vercel env vars
GOOGLE_SERVICE_ACCOUNT_JSON=<paste-service-account-json-here>

# Google Spreadsheet ID for URL validation results
URL_VALIDATOR_SHEET_ID=your-spreadsheet-id-here
```

The tool uses the same `GOOGLE_SERVICE_ACCOUNT_JSON` env var as the dashboard — paste the same JSON value from `dashboard/.env.local`. The spreadsheet must be shared with that service account email (`client_email` in the JSON) with **Editor** access.

As a fallback, credentials can still be placed in `credentials.json` (see `credentials.example.json`).

If `BLOG_CONTENT_DIR` is not set, the script defaults to looking two levels up from its own directory (`url-validator/` → `blog-agents-platform/` → repo root), then `aspose-blog/content/Aspose.Blog` relative to that root. This works if the blog content repo is checked out alongside `blog-agents-platform/`.

## Usage

```bash
source venv/bin/activate
python3 main.py
```

The script will:
1. Scan all product and post directories under `BLOG_CONTENT_DIR`
2. Print progress per product to the terminal
3. Create two new tabs in the spreadsheet named after today's date:
   - **`YYYY-MM-DD`** — full issue list with colour-coded error types
   - **`YYYY-MM-DD – Summary`** — counts by error type, product, and language

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

## Tests

```bash
source venv/bin/activate
python3 -m pytest test_main.py -v
```

70 tests covering all validation rules, edge cases, and filesystem scanning.

## Security

Both `.env` and `credentials.json` are listed in `.gitignore` and will never be committed. Only `credentials.example.json` (with placeholder values) is tracked in git.
