#!/usr/local/bin/python3
"""
URL Validator for blog post frontmatter across all 6 supported domains
Validates frontmatter URLs and reports issues to Google Sheets.

Setup:
  1. pip install -r requirements.txt
  2. Set GOOGLE_SERVICE_ACCOUNT_JSON in url-validator/.env (same key as the dashboard)
  3. Set URL_VALIDATOR_SHEET_ID_<DOMAIN> and URL_VALIDATOR_CONTENT_DIR_<DOMAIN> in url-validator/.env
  4. Run: python3 main.py --domain blog.aspose.com
"""

import argparse
import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import yaml
import gspread
from google.oauth2.service_account import Credentials

# ── Config ────────────────────────────────────────────────────────────────────
import os
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

SCRIPT_DIR      = Path(__file__).parent
REPO_ROOT       = SCRIPT_DIR.parent.parent

_content_override = os.environ.get("BLOG_CONTENT_DIR")
CONTENT_DIR     = Path(_content_override) if _content_override else REPO_ROOT / "aspose-blog" / "content" / "Aspose.Blog"

SPREADSHEET_ID   = os.environ.get("URL_VALIDATOR_SHEET_ID", "1LVr91XakURG1CMCGpO4aaloF4d5wLqnZkob8uBI6jOc")
CREDENTIALS_FILE = SCRIPT_DIR / "credentials.json"
SCOPES           = ["https://www.googleapis.com/auth/spreadsheets"]

# Consolidated spreadsheet: one sheet, one persistent tab per domain (overwritten each run,
# not a new dated tab), plus a shared History tab. Takes over from the legacy per-domain
# spreadsheet + dated-tabs flow whenever it's configured.
CONSOLIDATED_SPREADSHEET_ID = os.environ.get("URL_VALIDATOR_SPREADSHEET_ID", "")
HISTORY_TAB_NAME = "History"
HISTORY_HEADERS  = ["Run Date", "Domain", "Products", "Posts", "Files", "Total Issues", "Error Breakdown"]

# Supported domains and their content-dir defaults (relative to the checked-out content repo).
# Mirrors dashboard/lib/url-validator-config.ts's domainToEnvKey() so env var names line up
# across the CLI, the dashboard, and the GitHub Actions workflow.
SUPPORTED_DOMAINS = [
    "blog.aspose.com",
    "blog.aspose.cloud",
    "blog.groupdocs.com",
    "blog.groupdocs.cloud",
    "blog.conholdate.com",
    "blog.conholdate.cloud",
]


def domain_to_env_key(domain: str) -> str:
    """'blog.groupdocs.cloud' -> 'GROUPDOCS_CLOUD'. Mirrors the TS dashboard's domainToEnvKey()."""
    suffix = re.sub(r"^blog\.", "", domain)
    return re.sub(r"[.\-]", "_", suffix).upper()


def resolve_domain_config(domain: str) -> tuple[Path, str]:
    """Resolve (content_dir, spreadsheet_id) for one of the 6 supported domains."""
    key = domain_to_env_key(domain)

    # URL_VALIDATOR_CONTENT_DIR_OVERRIDE is for single-purpose process invocations only (e.g. one
    # GitHub Actions job, set fresh per matrix leg to the domain it's actually running) — never set
    # it in a long-lived local .env, since unlike the domain-keyed vars below it applies regardless
    # of --domain. BLOG_CONTENT_DIR is the older legacy override, scoped to blog.aspose.com only —
    # it must never fall back for other domains, or a stale value silently scans the wrong domain's
    # content while writing results to the right domain's sheet (happened once; don't repeat it).
    content_value = (
        os.environ.get("URL_VALIDATOR_CONTENT_DIR_OVERRIDE")
        or os.environ.get(f"URL_VALIDATOR_CONTENT_DIR_{key}")
    )
    if not content_value and domain == "blog.aspose.com":
        content_value = os.environ.get("BLOG_CONTENT_DIR")
    if content_value:
        content_dir = Path(content_value)
    elif domain == "blog.aspose.com":
        content_dir = REPO_ROOT / "aspose-blog" / "content" / "Aspose.Blog"
    else:
        print(f"ERROR: No content directory configured for {domain}.")
        print(f"  Set URL_VALIDATOR_CONTENT_DIR_{key} in url-validator/.env")
        sys.exit(1)

    # The legacy per-domain sheet ID is irrelevant once the consolidated spreadsheet is active —
    # don't require it to be set in that case.
    if CONSOLIDATED_SPREADSHEET_ID:
        return content_dir, ""

    sheet_id = os.environ.get(f"URL_VALIDATOR_SHEET_ID_{key}")
    if not sheet_id and domain == "blog.aspose.com":
        sheet_id = SPREADSHEET_ID  # legacy URL_VALIDATOR_SHEET_ID / hardcoded default
    if not sheet_id:
        print(f"ERROR: No spreadsheet configured for {domain}.")
        print(f"  Set URL_VALIDATOR_SHEET_ID_{key} in url-validator/.env")
        sys.exit(1)

    return content_dir, sheet_id


def _load_credentials() -> Credentials:
    """Load service account credentials from env var, falling back to credentials.json."""
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        return Credentials.from_service_account_info(json.loads(sa_json), scopes=SCOPES)
    return Credentials.from_service_account_file(str(CREDENTIALS_FILE), scopes=SCOPES)

# Intentionally empty: content migrated from a /zh-tw/ URL prefix for zh-hant files to
# /zh-hant/ directly (no alias). Don't add a zh-hant->zh-tw mapping back here without
# re-checking real content first -- see test_main.py's zh-hant test comments.
LANG_URL_ALIASES: dict[str, str] = {}

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
    redirect = ""
    if current_url and expected_url and current_url != expected_url:
        redirect = f'"{current_url}": "https://blog.aspose.com{expected_url}"'
    return {
        "product":       product,
        "post_folder":   post_folder,
        "file":          rel_path,
        "lang":          lang,
        "error_type":    error_type,
        "current_url":   current_url,
        "expected_url":  expected_url,
        "notes":         notes,
        "redirect_rule": redirect,
    }


def validate_english(file_path: Path, product: str, post_folder: str) -> tuple[list, str]:
    """
    Returns (issues, normalized_english_url).
    normalized_english_url is None if url is missing.
    """
    fm = parse_frontmatter(file_path)
    rel = str(file_path.relative_to(CONTENT_DIR))
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
        return issues, None

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
        expected = f"/{product}/{slug}/"
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
    rel = str(file_path.relative_to(CONTENT_DIR))
    url = get_url(fm)
    issues = []
    slug = slug_from_folder(post_folder)
    url_lang = LANG_URL_ALIASES.get(lang, lang)  # URL prefix may differ from file lang

    expected_fallback = (
        f"/{url_lang}{english_url}" if english_url
        else f"/{url_lang}/{product}/{slug}/"
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
    if lang_in_url != url_lang:
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "LANG_CODE_MISMATCH", url,
            f"/{url_lang}/{product}/{slug}/",
            f"URL has '/{lang_in_url}/' but expected '/{url_lang}/'"
        ))
        reported_errors.add("LANG_CODE_MISMATCH")

    # Detect date-based URL: /lang/YYYY/MM/DD/slug/
    if re.match(r"^\d{4}$", prod_in_url):
        date_slug = parts[-1] if parts[-1] else slug
        expected = f"/{url_lang}/{product}/{date_slug}/"
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "DATE_BASED_URL", url, expected,
            f"URL uses date-based format instead of /{url_lang}/{product}/slug/"
        ))
        reported_errors.add("DATE_BASED_URL")
    elif prod_in_url != product:
        # Check product segment (only if not already a date URL)
        issues.append(make_issue(
            product, post_folder, rel, lang,
            "WRONG_PRODUCT", url,
            f"/{url_lang}/{product}/{slug}/",
            f"URL has '/{prod_in_url}/' but post is under '/{product}/'"
        ))
        reported_errors.add("WRONG_PRODUCT")

    # Check full match against English base URL
    if english_url:
        expected_translated = f"/{url_lang}{english_url}"
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
                        str(md_file.relative_to(CONTENT_DIR)),
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


def _autosize_columns(spreadsheet, sheet_id: int, num_cols: int):
    """Auto-resize the first num_cols columns to fit their content, so no cell is truncated."""
    spreadsheet.batch_update({"requests": [{
        "autoResizeDimensions": {
            "dimensions": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": 0,
                "endIndex": num_cols,
            }
        }
    }]})


def _write_issue_tab(spreadsheet, ws, issues: list):
    """Write the issue rows + standard formatting (headers, freeze, color-code, autosize)
    into an issues worksheet. Shared by the legacy dated-tab flow and the consolidated
    persistent-tab flow."""
    headers = ["#", "Product", "Post Folder", "Language", "Error Type",
               "Current URL", "Expected URL", "Notes", "Redirect Rule"]
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
            issue["redirect_rule"],
        ])

    ws.update(rows, "A1")

    # Header formatting
    ws.format("A1:H1", {
        "textFormat": {"bold": True, "foregroundColor": HEADER_FG},
        "backgroundColor": HEADER_COLOR,
    })
    ws.format("I1", {
        "textFormat": {"bold": True, "foregroundColor": {"red": 0.4, "green": 0.3, "blue": 0.0}},
        "backgroundColor": {"red": 1.0, "green": 0.95, "blue": 0.7},
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

    # Auto-resize all columns to fit content
    _autosize_columns(spreadsheet, ws.id, 9)


def _append_history_row(spreadsheet, domain: str, stats: dict, issues: list):
    """Append one summary row to the shared History tab, creating it (with headers) if missing."""
    today = date.today().strftime("%Y-%m-%d")
    error_counts = Counter(i["error_type"] for i in issues)
    breakdown = ", ".join(f"{et}:{cnt}" for et, cnt in sorted(error_counts.items(), key=lambda x: -x[1])) or "none"

    try:
        ws = spreadsheet.worksheet(HISTORY_TAB_NAME)
    except gspread.exceptions.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=HISTORY_TAB_NAME, rows=2, cols=len(HISTORY_HEADERS))
        ws.update([HISTORY_HEADERS], "A1")
        ws.format("A1:G1", {
            "textFormat": {"bold": True, "foregroundColor": HEADER_FG},
            "backgroundColor": HEADER_COLOR,
        })
        spreadsheet.batch_update({"requests": [{
            "updateSheetProperties": {
                "properties": {"sheetId": ws.id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount",
            }
        }]})

    ws.append_row(
        [today, domain, stats["products"], stats["posts"], stats["files"], len(issues), breakdown],
        value_input_option="USER_ENTERED",
    )
    _autosize_columns(spreadsheet, ws.id, len(HISTORY_HEADERS))


def _with_retry(fn, *args, max_attempts=3, base_delay_s=2.0, **kwargs):
    """Retry a Sheets write with exponential backoff on transient API errors.
    Safe to retry whole-function here since the write paths are find-or-create /
    clear-and-rewrite -- re-running after a partial failure converges to the same result."""
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            last_exc = exc
            if attempt == max_attempts:
                break
            delay = base_delay_s * (2 ** (attempt - 1))
            print(f"  Sheets write failed (attempt {attempt}/{max_attempts}): {exc}. Retrying in {delay:.0f}s...")
            time.sleep(delay)
    raise last_exc


def write_to_consolidated_sheet(issues: list, stats: dict, domain: str):
    """Write into the single consolidated spreadsheet: one persistent tab per domain
    (overwritten in place each run, never a new dated tab) + a shared History row."""
    creds = _load_credentials()
    gc = gspread.authorize(creds)
    spreadsheet = gc.open_by_key(CONSOLIDATED_SPREADSHEET_ID)

    issues = sorted(issues, key=lambda x: x["error_type"])

    try:
        ws = spreadsheet.worksheet(domain)
        ws.clear()
        ws.resize(rows=max(len(issues) + 5, 2), cols=9)
    except gspread.exceptions.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=domain, rows=len(issues) + 5, cols=9)

    print(f"\nUpdating tab '{domain}'...", flush=True)
    _write_issue_tab(spreadsheet, ws, issues)
    _append_history_row(spreadsheet, domain, stats, issues)

    print(f"\nDone! Open spreadsheet:")
    print(f"  https://docs.google.com/spreadsheets/d/{CONSOLIDATED_SPREADSHEET_ID}#gid={ws.id}")


def prepare_consolidated_sheet():
    """Idempotent setup: ensure the consolidated spreadsheet has all 6 domain tabs and a
    History tab, creating only what's missing. Never deletes or overwrites existing tabs."""
    if not CONSOLIDATED_SPREADSHEET_ID:
        print("ERROR: URL_VALIDATOR_SPREADSHEET_ID is not set in url-validator/.env")
        sys.exit(1)

    creds = _load_credentials()
    gc = gspread.authorize(creds)
    spreadsheet = gc.open_by_key(CONSOLIDATED_SPREADSHEET_ID)
    existing = {ws.title for ws in spreadsheet.worksheets()}

    for domain in SUPPORTED_DOMAINS:
        if domain in existing:
            print(f"  = {domain} (already exists, left as-is)")
            continue
        ws = spreadsheet.add_worksheet(title=domain, rows=10, cols=9)
        _write_issue_tab(spreadsheet, ws, [])
        print(f"  + {domain} (created)")

    if HISTORY_TAB_NAME in existing:
        print(f"  = {HISTORY_TAB_NAME} (already exists, left as-is)")
    else:
        ws = spreadsheet.add_worksheet(title=HISTORY_TAB_NAME, rows=10, cols=len(HISTORY_HEADERS))
        ws.update([HISTORY_HEADERS], "A1")
        ws.format("A1:G1", {
            "textFormat": {"bold": True, "foregroundColor": HEADER_FG},
            "backgroundColor": HEADER_COLOR,
        })
        spreadsheet.batch_update({"requests": [{
            "updateSheetProperties": {
                "properties": {"sheetId": ws.id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount",
            }
        }]})
        _autosize_columns(spreadsheet, ws.id, len(HISTORY_HEADERS))
        print(f"  + {HISTORY_TAB_NAME} (created)")

    print(f"\nReady: https://docs.google.com/spreadsheets/d/{CONSOLIDATED_SPREADSHEET_ID}")


def write_to_sheets(issues: list, stats: dict):
    creds = _load_credentials()
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
    issues = sorted(issues, key=lambda x: x["error_type"])
    print(f"\nCreating sheet '{tab_issues}'...", flush=True)
    ws = spreadsheet.add_worksheet(title=tab_issues, rows=len(issues) + 2, cols=9, index=0)
    _write_issue_tab(spreadsheet, ws, issues)

    # ── Tab 2: Summary ────────────────────────────────────────────────────────
    print(f"Creating sheet '{tab_summary}'...", flush=True)
    ws2 = spreadsheet.add_worksheet(title=tab_summary, rows=80, cols=4, index=0)

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

    _autosize_columns(spreadsheet, ws2.id, 4)

    print(f"\nDone! Open spreadsheet:")
    print(f"  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="URL Validator for blog post frontmatter")
    parser.add_argument(
        "--domain",
        choices=SUPPORTED_DOMAINS,
        default=os.environ.get("BLOG_DOMAIN", "blog.aspose.com"),
        help="Which of the 6 supported domains to validate (default: blog.aspose.com)",
    )
    parser.add_argument(
        "--prepare-sheet",
        action="store_true",
        help="Create/verify the consolidated spreadsheet's 6 domain tabs + History tab (no scan), then exit.",
    )
    args = parser.parse_args()

    if args.prepare_sheet:
        prepare_consolidated_sheet()
        return

    global CONTENT_DIR, SPREADSHEET_ID
    CONTENT_DIR, SPREADSHEET_ID = resolve_domain_config(args.domain)

    if not os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") and not CREDENTIALS_FILE.exists():
        print("ERROR: Google service account credentials not found.")
        print()
        print("Option A (recommended) — set env var in url-validator/.env:")
        print("  GOOGLE_SERVICE_ACCOUNT_JSON=<paste full JSON on one line>")
        print()
        print("Option B — place credentials file:")
        print(f"  Save the JSON key as: {CREDENTIALS_FILE}")
        print()
        print("Share the spreadsheet with the service account email and set:")
        print(f"  URL_VALIDATOR_SHEET_ID_{domain_to_env_key(args.domain)}=<sheet id>")
        sys.exit(1)

    using_consolidated = bool(CONSOLIDATED_SPREADSHEET_ID)

    print(f"Domain      : {args.domain}")
    print(f"Content dir : {CONTENT_DIR}")
    if using_consolidated:
        print(f"Spreadsheet : https://docs.google.com/spreadsheets/d/{CONSOLIDATED_SPREADSHEET_ID}  (tab: {args.domain})")
    else:
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
        if using_consolidated:
            _with_retry(write_to_consolidated_sheet, [], stats, args.domain)
        return

    # Error type breakdown
    print()
    for et, cnt in sorted(Counter(i["error_type"] for i in issues).items(), key=lambda x: -x[1]):
        print(f"  {et:<35} {cnt}")

    print()
    if using_consolidated:
        _with_retry(write_to_consolidated_sheet, issues, stats, args.domain)
    else:
        _with_retry(write_to_sheets, issues, stats)


if __name__ == "__main__":
    main()
