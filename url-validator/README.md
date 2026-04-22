# URL Validator

> **Status: Development Phase** — This tool is not yet ready for production use. Behaviour, configuration, and output format may change without notice.

Scans all blog post frontmatter for URL issues and reports findings to a Google Spreadsheet.

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

**2. Add Google service account credentials**

Copy the example file and fill in your real service account key:

```bash
cp credentials.example.json credentials.json
```

Then edit `credentials.json` with values from your Google Cloud service account JSON key file.

If you don't have a service account yet:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project → Enable **Google Sheets API**
3. IAM & Admin → Service Accounts → Create → Add key → JSON
4. Save the downloaded file as `credentials.json` in this folder

**3. Share the spreadsheet**

Share the target Google Spreadsheet with the service account email (`client_email` in `credentials.json`), giving it **Editor** access.

**4. Configure paths (if needed)**

Open `main.py` and verify these constants match your setup:

```python
CONTENT_DIR    = REPO_ROOT / "aspose-blog" / "content" / "Aspose.Blog"
SPREADSHEET_ID = "your-spreadsheet-id-here"
```

`REPO_ROOT` is resolved as two levels up from the script (`url-validator/` → `blog-team-tools/` → repo root). The blog content repo is expected to be checked out alongside `blog-team-tools/`.

## Usage

```bash
source venv/bin/activate
python3 main.py
```

The script will:
1. Scan all product and post directories under `CONTENT_DIR`
2. Print progress per product to the terminal
3. Create two new tabs in the spreadsheet named after today's date:
   - **`YYYY-MM-DD`** — full issue list with color-coded error types
   - **`YYYY-MM-DD – Summary`** — counts by error type, product, and language

## Output example

```
Scanning posts...
  ✓ total (312 posts)
  ✓ words (198 posts)
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

## Security

`credentials.json` is listed in `.gitignore` and will never be committed. Only `credentials.example.json` (with placeholder values) is tracked in git.
