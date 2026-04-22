#!/usr/local/bin/python3
"""
URL Validator for blog.aspose.com posts
Validates frontmatter URLs and reports issues to Google Sheets.

Setup:
  1. pip install -r requirements.txt
  2. Place your Google service account credentials.json in this folder
  3. Share the target spreadsheet with the service account email
  4. Run: python3 main.py
"""

import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import yaml
import gspread
from google.oauth2.service_account import Credentials

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR      = Path(__file__).parent
REPO_ROOT       = SCRIPT_DIR.parent.parent
CONTENT_DIR     = REPO_ROOT / "aspose-blog" / "content" / "Aspose.Blog"
SPREADSHEET_ID  = "1LVr91XakURG1CMCGpO4aaloF4d5wLqnZkob8uBI6jOc"
CREDENTIALS_FILE = SCRIPT_DIR / "credentials.json"
SCOPES          = ["https://www.googleapis.com/auth/spreadsheets"]

# ── Frontmatter ───────────────────────────────────────────────────────────────
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
DATE_URL_RE    = re.compile(r"^/\d{4}/\d{2}/\d{2}/(.+)$")


def parse_frontmatter(file_path: Path) -> dict:
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        m = FRONTMATTER_RE.match(content)
        if not m:
            return {}
        return yaml.safe_load(m.group(1)) or {}
    except Exception:
        return {}


def get_url(fm: dict) -> str:
    val = fm.get("url", "")
    if val is None:
        return ""
    return str(val).strip()


def normalize_url(url: str) -> str:
    """Ensure trailing slash for comparison purposes."""
    return url if url.endswith("/") else url + "/"


def slug_from_folder(post_folder: str) -> str:
    """Strip leading YYYY-MM-DD- date prefix from folder name to get best-effort slug."""
    return re.sub(r"^\d{4}-\d{2}-\d{2}-", "", post_folder)


# ── Validators ────────────────────────────────────────────────────────────────
def make_issue(product, post_folder, rel_path, lang, error_type, current_url, expected_url, notes=""):
    return {
        "product":      product,
        "post_folder":  post_folder,
        "file":         rel_path,
        "lang":         lang,
        "error_type":   error_type,
        "current_url":  current_url,
        "expected_url": expected_url,
        "notes":        notes,
    }


def validate_english(file_path: Path, product: str, post_folder: str) -> tuple[list, str]:
    """
    Returns (issues, normalized_english_url).
    normalized_english_url is None if url is missing.
    """
    fm = parse_frontmatter(file_path)
    rel = str(file_path.relative_to(REPO_ROOT))
    url = get_url(fm)
    issues = []

    slug = slug_from_folder(post_folder)

    if not url:
        issues.append(make_issue(
            product, post_folder, rel, "en",
            "MISSING_URL", "", f"/{product}/{slug}/",
            "No url field in frontmatter"
        ))
        return issues, None

    normalized = normalize_url(url)

    if not url.endswith("/"):
        issues.append(make_issue(
            product, post_folder, rel, "en",
            "MISSING_TRAILING_SLASH", url, normalized,
        ))

    parts = normalized.strip("/").split("/")

    if len(parts) < 2:
        issues.append(make_issue(
            product, post_folder, rel, "en",
            "URL_TOO_SHORT", url, f"/{product}/{slug}/",
            f"Expected 2 path segments, got {len(parts)}"
        ))
        return issues, normalized

    # Detect date-based URL: /YYYY/MM/DD/slug/
    date_match = DATE_URL_RE.match(normalized.rstrip("/") + "/")
    if not date_match:
        date_match = DATE_URL_RE.match(normalized)
    if re.match(r"^/\d{4}/", normalized):
        date_slug = parts[-1] if parts[-1] else slug
        expected = f"/{product}/{date_slug}/"
        issues.append(make_issue(
            product, post_folder, rel, "en",
            "DATE_BASED_URL", url, expected,
            f"URL uses date-based format instead of /{product}/slug/"
        ))
        return issues, normalized

    if parts[0] != product:
        expected = f"/{product}/{'/'.join(parts[1:])}/"
        issues.append(make_issue(
            product, post_folder, rel, "en",
            "WRONG_PRODUCT", url, expected,
            f"URL has '/{parts[0]}/' but post is under '/{product}/'"
        ))

    return issues, normalized


def validate_translated(file_path: Path, product: str, post_folder: str, lang: str, english_url) -> list:
    """
    english_url: normalized English URL string, or None if English base is missing.
    """
    fm = parse_frontmatter(file_path)
    rel = str(file_path.relative_to(REPO_ROOT))
    url = get_url(fm)
    issues = []
    slug = slug_from_folder(post_folder)

    expected_fallback = (
        f"/{lang}{english_url}" if english_url
        else f"/{lang}/{product}/{slug}/"
    )

    if not url:
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "MISSING_URL", "", expected_fallback,
            "No url field in frontmatter"
        ))
        return issues

    normalized = normalize_url(url)

    if not url.endswith("/"):
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "MISSING_TRAILING_SLASH", url, normalized,
        ))

    parts = normalized.strip("/").split("/")

    if len(parts) < 3:
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "URL_TOO_SHORT", url, expected_fallback,
            f"Expected 3+ path segments, got {len(parts)}"
        ))
        return issues

    lang_in_url  = parts[0]
    prod_in_url  = parts[1]
    reported_errors = set()

    # Check lang prefix
    if lang_in_url != lang:
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "LANG_CODE_MISMATCH", url,
            f"/{lang}/{'/'.join(parts[1:])}/",
            f"URL has '/{lang_in_url}/' but file lang is '{lang}'"
        ))
        reported_errors.add("LANG_CODE_MISMATCH")

    # Detect date-based URL: /lang/YYYY/MM/DD/slug/
    if re.match(r"^\d{4}$", prod_in_url):
        date_slug = parts[-1] if parts[-1] else slug
        expected = f"/{lang}/{product}/{date_slug}/"
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "DATE_BASED_URL", url, expected,
            f"URL uses date-based format instead of /{lang}/{product}/slug/"
        ))
        reported_errors.add("DATE_BASED_URL")
    elif prod_in_url != product:
        # Check product segment (only if not already a date URL)
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "WRONG_PRODUCT", url,
            f"/{lang}/{product}/{'/'.join(parts[2:])}/",
            f"URL has '/{prod_in_url}/' but post is under '/{product}/'"
        ))
        reported_errors.add("WRONG_PRODUCT")

    # Check full match against English base URL
    if english_url:
        expected_translated = f"/{lang}{english_url}"
        if normalized != expected_translated:
            # Only report if not already explained by other errors above
            if not reported_errors:
                issues.append(make_issue(
                    product, post_folder, rel, lang,
                    "URL_MISMATCH_WITH_ENGLISH", url, expected_translated,
                    "Slug differs from English base URL"
                ))

    return issues


# ── Scanner ───────────────────────────────────────────────────────────────────
def scan_all() -> tuple[list, dict]:
    all_issues = []
    stats = {"products": 0, "posts": 0, "files": 0}

    product_dirs = sorted(
        d for d in CONTENT_DIR.iterdir()
        if d.is_dir() and not d.name.startswith("_")
    )
    stats["products"] = len(product_dirs)

    for product_dir in product_dirs:
        product = product_dir.name

        post_dirs = sorted(d for d in product_dir.iterdir() if d.is_dir())
        stats["posts"] += len(post_dirs)

        for post_dir in post_dirs:
            post_folder = post_dir.name
            english_file = post_dir / "index.md"
            english_url = None

            # ── English base ──────────────────────────────────────────────
            if english_file.exists():
                stats["files"] += 1
                issues, english_url = validate_english(english_file, product, post_folder)
                all_issues.extend(issues)

            # ── Translated files ──────────────────────────────────────────
            for md_file in sorted(post_dir.glob("index.*.md")):
                stats["files"] += 1
                # index.ar.md → "ar",  index.zh-hant.md → "zh-hant"
                lang = ".".join(md_file.stem.split(".")[1:])

                if not english_file.exists():
                    fm = parse_frontmatter(md_file)
                    all_issues.append(make_issue(
                        product, post_folder,
                        str(md_file.relative_to(REPO_ROOT)),
                        lang,
                        "NO_ENGLISH_BASE",
                        get_url(fm), "",
                        "No index.md found for this post"
                    ))

                all_issues.extend(
                    validate_translated(md_file, product, post_folder, lang, english_url)
                )

        # Progress
        print(f"  ✓ {product} ({len(post_dirs)} posts)", flush=True)

    return all_issues, stats


# ── Google Sheets ─────────────────────────────────────────────────────────────
HEADER_COLOR   = {"red": 0.157, "green": 0.306, "blue": 0.612}   # dark blue
HEADER_FG      = {"red": 1.0, "green": 1.0, "blue": 1.0}          # white text

ERROR_COLORS = {
    "MISSING_URL":               {"red": 0.96, "green": 0.26, "blue": 0.21},   # red
    "MISSING_TRAILING_SLASH":    {"red": 1.00, "green": 0.76, "blue": 0.03},   # yellow
    "WRONG_PRODUCT":             {"red": 1.00, "green": 0.60, "blue": 0.00},   # orange
    "LANG_CODE_MISMATCH":        {"red": 0.80, "green": 0.00, "blue": 0.80},   # purple
    "URL_MISMATCH_WITH_ENGLISH": {"red": 0.00, "green": 0.59, "blue": 0.53},   # teal
    "NO_ENGLISH_BASE":           {"red": 0.55, "green": 0.55, "blue": 0.55},   # grey
    "URL_TOO_SHORT":             {"red": 0.96, "green": 0.26, "blue": 0.21},   # red
    "DATE_BASED_URL":            {"red": 0.13, "green": 0.59, "blue": 0.95},   # blue
}


def write_to_sheets(issues: list, stats: dict):
    creds = Credentials.from_service_account_file(str(CREDENTIALS_FILE), scopes=SCOPES)
    gc = gspread.authorize(creds)
    spreadsheet = gc.open_by_key(SPREADSHEET_ID)

    today = date.today().strftime("%Y-%m-%d")
    tab_issues  = today
    tab_summary = f"{today} – Summary"

    # Remove existing tabs with same name (re-run safety)
    for tab_name in [tab_issues, tab_summary]:
        try:
            spreadsheet.del_worksheet(spreadsheet.worksheet(tab_name))
        except gspread.exceptions.WorksheetNotFound:
            pass

    # ── Tab 1: All Issues ─────────────────────────────────────────────────────
    print(f"\nCreating sheet '{tab_issues}'...", flush=True)
    ws = spreadsheet.add_worksheet(title=tab_issues, rows=len(issues) + 2, cols=8)

    headers = ["#", "Product", "Post Folder", "Language", "Error Type",
               "Current URL", "Expected URL", "Notes"]
    rows = [headers]
    for i, issue in enumerate(issues, 1):
        rows.append([
            i,
            issue["product"],
            issue["post_folder"],
            issue["lang"],
            issue["error_type"],
            issue["current_url"],
            issue["expected_url"],
            issue["notes"],
        ])

    ws.update(rows, "A1")

    # Header formatting
    ws.format("A1:H1", {
        "textFormat": {"bold": True, "foregroundColor": HEADER_FG},
        "backgroundColor": HEADER_COLOR,
    })

    # Freeze header row
    spreadsheet.batch_update({"requests": [{
        "updateSheetProperties": {
            "properties": {
                "sheetId": ws.id,
                "gridProperties": {"frozenRowCount": 1}
            },
            "fields": "gridProperties.frozenRowCount"
        }
    }]})

    # Color-code Error Type column (column E = index 4)
    color_requests = []
    for row_idx, issue in enumerate(issues, 2):   # row 2 onward (1-based)
        bg = ERROR_COLORS.get(issue["error_type"])
        if bg:
            color_requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": ws.id,
                        "startRowIndex": row_idx - 1,
                        "endRowIndex":   row_idx,
                        "startColumnIndex": 4,
                        "endColumnIndex":   5,
                    },
                    "cell": {"userEnteredFormat": {"backgroundColor": bg}},
                    "fields": "userEnteredFormat.backgroundColor",
                }
            })

    if color_requests:
        # Batch in chunks of 1000 to stay within API limits
        for i in range(0, len(color_requests), 1000):
            spreadsheet.batch_update({"requests": color_requests[i:i+1000]})

    # ── Tab 2: Summary ────────────────────────────────────────────────────────
    print(f"Creating sheet '{tab_summary}'...", flush=True)
    ws2 = spreadsheet.add_worksheet(title=tab_summary, rows=80, cols=4)

    error_counts   = Counter(i["error_type"] for i in issues)
    product_counts = Counter(i["product"] for i in issues)
    lang_counts    = Counter(i["lang"] for i in issues)

    summary_rows = [
        ["Run Date", today,          "", ""],
        ["Products scanned",  stats["products"],  "", ""],
        ["Posts scanned",     stats["posts"],      "", ""],
        ["Files scanned",     stats["files"],      "", ""],
        ["Total issues",      len(issues),          "", ""],
        ["", "", "", ""],
        ["Error Type", "Count", "", ""],
    ]
    for et, cnt in sorted(error_counts.items(), key=lambda x: -x[1]):
        summary_rows.append([et, cnt, "", ""])

    summary_rows += [
        ["", "", "", ""],
        ["Product", "Issue Count", "", ""],
    ]
    for prod, cnt in sorted(product_counts.items(), key=lambda x: -x[1]):
        summary_rows.append([prod, cnt, "", ""])

    summary_rows += [
        ["", "", "", ""],
        ["Language", "Issue Count", "", ""],
    ]
    for lang, cnt in sorted(lang_counts.items(), key=lambda x: -x[1])[:30]:
        summary_rows.append([lang, cnt, "", ""])

    ws2.update(summary_rows, "A1")

    # Bold section headers
    for bold_cell in ["A1", "A7", "A10", f"A{10 + len(error_counts) + 2}"]:
        try:
            ws2.format(bold_cell, {"textFormat": {"bold": True}})
        except Exception:
            pass

    ws2.format("A7:B7", {
        "textFormat": {"bold": True, "foregroundColor": HEADER_FG},
        "backgroundColor": HEADER_COLOR,
    })

    print(f"\nDone! Open spreadsheet:")
    print(f"  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    if not CREDENTIALS_FILE.exists():
        print("ERROR: credentials.json not found.")
        print(f"Expected at: {CREDENTIALS_FILE}")
        print()
        print("Setup steps:")
        print("  1. Go to https://console.cloud.google.com/")
        print("  2. Create a project → Enable 'Google Sheets API'")
        print("  3. IAM & Admin → Service Accounts → Create → Download JSON key")
        print("  4. Save the JSON key as credentials.json in this folder")
        print("  5. Share the spreadsheet with the service account email")
        sys.exit(1)

    print(f"Content dir : {CONTENT_DIR}")
    print(f"Spreadsheet : https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
    print(f"Output sheet: {date.today().strftime('%Y-%m-%d')}")
    print()
    print("Scanning posts...")

    issues, stats = scan_all()

    print()
    print(f"Scan complete:")
    print(f"  Products : {stats['products']}")
    print(f"  Posts    : {stats['posts']}")
    print(f"  Files    : {stats['files']}")
    print(f"  Issues   : {len(issues)}")

    if not issues:
        print("\nNo issues found!")
        return

    # Error type breakdown
    print()
    for et, cnt in sorted(Counter(i["error_type"] for i in issues).items(), key=lambda x: -x[1]):
        print(f"  {et:<35} {cnt}")

    print()
    write_to_sheets(issues, stats)


if __name__ == "__main__":
    main()
