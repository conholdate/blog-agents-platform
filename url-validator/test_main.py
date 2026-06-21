"""
Tests for url-validator/main.py

Run:
    python3 -m pytest test_main.py -v
    # or without pytest:
    python3 -m unittest test_main -v
"""

import tempfile
import unittest
from pathlib import Path
from typing import Optional
from unittest.mock import patch

import main


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_file(directory: Path, filename: str, url: Optional[str]) -> Path:
    p = directory / filename
    frontmatter = f"url: {url}" if url is not None else ""
    p.write_text(f"---\n{frontmatter}\n---\nBody", encoding="utf-8")
    return p

def error_types(issues: list) -> list:
    return [i["error_type"] for i in issues]

def issue_of(issues: list, error_type: str) -> dict:
    return next((i for i in issues if i["error_type"] == error_type), None)


# ── normalize_url ─────────────────────────────────────────────────────────────

class TestNormalizeUrl(unittest.TestCase):
    def test_already_has_slash(self):
        self.assertEqual(main.normalize_url("/words/convert-doc/"), "/words/convert-doc/")

    def test_adds_trailing_slash(self):
        self.assertEqual(main.normalize_url("/words/convert-doc"), "/words/convert-doc/")

    def test_root_slash(self):
        self.assertEqual(main.normalize_url("/"), "/")

    def test_empty_string(self):
        self.assertEqual(main.normalize_url(""), "/")


# ── slug_from_folder ──────────────────────────────────────────────────────────

class TestSlugFromFolder(unittest.TestCase):
    def test_strips_date_prefix(self):
        self.assertEqual(main.slug_from_folder("2024-03-15-convert-doc-to-pdf"), "convert-doc-to-pdf")

    def test_no_date_prefix(self):
        self.assertEqual(main.slug_from_folder("convert-doc-to-pdf"), "convert-doc-to-pdf")

    def test_partial_date_not_stripped(self):
        self.assertEqual(main.slug_from_folder("2024-convert-doc"), "2024-convert-doc")

    def test_only_first_date_stripped(self):
        self.assertEqual(main.slug_from_folder("2024-03-15-2023-01-01-slug"), "2023-01-01-slug")


# ── get_url ───────────────────────────────────────────────────────────────────

class TestGetUrl(unittest.TestCase):
    def test_returns_url(self):
        self.assertEqual(main.get_url({"url": "/words/slug/"}), "/words/slug/")

    def test_strips_whitespace(self):
        self.assertEqual(main.get_url({"url": "  /words/slug/  "}), "/words/slug/")

    def test_missing_key(self):
        self.assertEqual(main.get_url({}), "")

    def test_none_value(self):
        self.assertEqual(main.get_url({"url": None}), "")

    def test_integer_cast(self):
        self.assertEqual(main.get_url({"url": 123}), "123")


# ── parse_frontmatter ─────────────────────────────────────────────────────────

class TestParseFrontmatter(unittest.TestCase):
    def _write(self, content: str) -> Path:
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8")
        f.write(content)
        f.close()
        return Path(f.name)

    def test_valid_frontmatter(self):
        p = self._write("---\ntitle: Hello\nurl: /words/slug/\n---\nBody")
        result = main.parse_frontmatter(p)
        self.assertEqual(result["url"], "/words/slug/")

    def test_no_frontmatter(self):
        p = self._write("Just content")
        self.assertEqual(main.parse_frontmatter(p), {})

    def test_empty_file(self):
        p = self._write("")
        self.assertEqual(main.parse_frontmatter(p), {})

    def test_missing_file(self):
        self.assertEqual(main.parse_frontmatter(Path("/nonexistent/file.md")), {})


# ── make_issue / redirect_rule ────────────────────────────────────────────────

class TestMakeIssue(unittest.TestCase):
    def test_redirect_generated_when_urls_differ(self):
        issue = main.make_issue(
            "words", "2024-01-01-slug", "words/slug/index.md", "en",
            "WRONG_PRODUCT", "/cells/slug/", "/words/slug/"
        )
        self.assertEqual(
            issue["redirect_rule"],
            '"/cells/slug/": "https://blog.aspose.com/words/slug/"'
        )

    def test_no_redirect_when_current_url_empty(self):
        issue = main.make_issue(
            "words", "2024-01-01-slug", "words/slug/index.md", "en",
            "MISSING_URL", "", "/words/slug/"
        )
        self.assertEqual(issue["redirect_rule"], "")

    def test_no_redirect_when_expected_url_empty(self):
        issue = main.make_issue(
            "words", "2024-01-01-slug", "words/slug/index.md", "ar",
            "NO_ENGLISH_BASE", "/ar/words/slug/", ""
        )
        self.assertEqual(issue["redirect_rule"], "")

    def test_no_redirect_when_urls_are_equal(self):
        issue = main.make_issue(
            "words", "2024-01-01-slug", "words/slug/index.md", "en",
            "MISSING_TRAILING_SLASH", "/words/slug/", "/words/slug/"
        )
        self.assertEqual(issue["redirect_rule"], "")

    def test_redirect_uses_full_domain(self):
        issue = main.make_issue(
            "words", "2024-01-01-slug", "words/slug/index.md", "ar",
            "LANG_CODE_MISMATCH", "/zh/words/slug/", "/zh-tw/words/slug/"
        )
        self.assertIn("https://blog.aspose.com", issue["redirect_rule"])

    def test_all_fields_present(self):
        issue = main.make_issue("words", "folder", "rel/path", "en", "MISSING_URL", "", "/words/slug/")
        for key in ["product", "post_folder", "file", "lang", "error_type",
                    "current_url", "expected_url", "notes", "redirect_rule"]:
            self.assertIn(key, issue)


# ── validate_english ──────────────────────────────────────────────────────────

class TestValidateEnglish(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.patcher = patch.object(main, "CONTENT_DIR", self.root)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmpdir.cleanup()

    def _file(self, url):
        return make_file(self.root, "index.md", url)

    # ── Happy path ────────────────────────────────────────────────────────────

    def test_valid_url_no_issues(self):
        p = self._file("/words/convert-doc-to-pdf/")
        issues, english_url = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertEqual(issues, [])
        self.assertEqual(english_url, "/words/convert-doc-to-pdf/")

    def test_returns_normalized_url(self):
        p = self._file("/words/convert-doc-to-pdf")
        _, english_url = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertEqual(english_url, "/words/convert-doc-to-pdf/")

    # ── MISSING_URL ───────────────────────────────────────────────────────────

    def test_missing_url_detected(self):
        p = self._file(None)
        issues, english_url = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertIn("MISSING_URL", error_types(issues))
        self.assertIsNone(english_url)

    def test_missing_url_expected_uses_folder_slug(self):
        p = self._file(None)
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertEqual(issue_of(issues, "MISSING_URL")["expected_url"], "/words/convert-doc-to-pdf/")

    # ── MISSING_TRAILING_SLASH ────────────────────────────────────────────────

    def test_missing_trailing_slash(self):
        p = self._file("/words/convert-doc-to-pdf")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertIn("MISSING_TRAILING_SLASH", error_types(issues))

    def test_missing_trailing_slash_expected_adds_slash(self):
        p = self._file("/words/convert-doc-to-pdf")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        i = issue_of(issues, "MISSING_TRAILING_SLASH")
        self.assertEqual(i["expected_url"], "/words/convert-doc-to-pdf/")

    # ── URL_TOO_SHORT ─────────────────────────────────────────────────────────

    def test_url_too_short_detected(self):
        p = self._file("/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertIn("URL_TOO_SHORT", error_types(issues))

    def test_url_too_short_returns_none_not_malformed_url(self):
        # Critical: must return None so translated files don't inherit bad URL
        p = self._file("/convert-doc-to-pdf/")
        _, english_url = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertIsNone(english_url)

    def test_url_too_short_expected_uses_folder_slug(self):
        p = self._file("/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertEqual(issue_of(issues, "URL_TOO_SHORT")["expected_url"], "/words/convert-doc-to-pdf/")

    # ── DATE_BASED_URL ────────────────────────────────────────────────────────

    def test_date_based_url_detected(self):
        p = self._file("/2024/01/01/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertIn("DATE_BASED_URL", error_types(issues))

    def test_date_based_url_expected_uses_product_and_slug(self):
        p = self._file("/2024/01/01/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        i = issue_of(issues, "DATE_BASED_URL")
        self.assertEqual(i["expected_url"], "/words/convert-doc-to-pdf/")

    # ── WRONG_PRODUCT ─────────────────────────────────────────────────────────

    def test_wrong_product_detected(self):
        p = self._file("/cells/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        self.assertIn("WRONG_PRODUCT", error_types(issues))

    def test_wrong_product_expected_uses_folder_slug_not_url_parts(self):
        # Guards against duplicate product: /words/cells/slug/ → /words/slug/ not /words/cells/slug/
        p = self._file("/cells/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        i = issue_of(issues, "WRONG_PRODUCT")
        self.assertEqual(i["expected_url"], "/words/convert-doc-to-pdf/")
        self.assertNotIn("cells", i["expected_url"])

    def test_wrong_product_expected_never_duplicates_product(self):
        # URL has extra segment that matches product: /cells/words/slug/
        p = self._file("/cells/words/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "words", "2024-01-01-convert-doc-to-pdf")
        i = issue_of(issues, "WRONG_PRODUCT")
        self.assertEqual(i["expected_url"].count("words"), 1)


# ── validate_translated ───────────────────────────────────────────────────────

class TestValidateTranslated(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.patcher = patch.object(main, "CONTENT_DIR", self.root)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmpdir.cleanup()

    def _file(self, lang: str, url: Optional[str]) -> Path:
        return make_file(self.root, f"index.{lang}.md", url)

    def _validate(self, url, lang="ar", product="words",
                  folder="2024-01-01-convert-doc-to-pdf",
                  english_url="/words/convert-doc-to-pdf/"):
        p = self._file(lang, url)
        return main.validate_translated(p, product, folder, lang, english_url)

    # ── Happy path ────────────────────────────────────────────────────────────

    def test_valid_url_no_issues(self):
        issues = self._validate("/ar/words/convert-doc-to-pdf/")
        self.assertEqual(issues, [])

    # ── MISSING_URL ───────────────────────────────────────────────────────────

    def test_missing_url_detected(self):
        issues = self._validate(None)
        self.assertIn("MISSING_URL", error_types(issues))

    def test_missing_url_expected_uses_english_url(self):
        issues = self._validate(None, english_url="/words/convert-doc-to-pdf/")
        i = issue_of(issues, "MISSING_URL")
        self.assertEqual(i["expected_url"], "/ar/words/convert-doc-to-pdf/")

    def test_missing_url_expected_fallback_when_no_english(self):
        issues = self._validate(None, english_url=None)
        i = issue_of(issues, "MISSING_URL")
        self.assertEqual(i["expected_url"], "/ar/words/convert-doc-to-pdf/")

    # ── MISSING_TRAILING_SLASH ────────────────────────────────────────────────

    def test_missing_trailing_slash(self):
        issues = self._validate("/ar/words/convert-doc-to-pdf")
        self.assertIn("MISSING_TRAILING_SLASH", error_types(issues))

    # ── URL_TOO_SHORT ─────────────────────────────────────────────────────────

    def test_url_too_short_detected(self):
        issues = self._validate("/ar/convert-doc-to-pdf/")
        self.assertIn("URL_TOO_SHORT", error_types(issues))

    def test_url_too_short_expected_uses_product_not_bad_english_url(self):
        # If English URL is also malformed (too short), translated must not inherit it
        issues = self._validate(
            "/ar/convert-doc-to-pdf/",
            english_url=None  # simulates English URL_TOO_SHORT returning None
        )
        i = issue_of(issues, "URL_TOO_SHORT")
        self.assertIn("/words/", i["expected_url"])
        self.assertNotEqual(i["expected_url"], i["current_url"])

    def test_url_too_short_expected_not_same_as_current(self):
        # Regression: expected used to equal current when English URL was also bad
        issues = self._validate("/ar/convert-doc-to-pdf/", english_url=None)
        i = issue_of(issues, "URL_TOO_SHORT")
        self.assertNotEqual(i["expected_url"], "/ar/convert-doc-to-pdf/")

    # ── DATE_BASED_URL ────────────────────────────────────────────────────────

    def test_date_based_url_detected(self):
        issues = self._validate("/ar/2024/01/01/convert-doc-to-pdf/")
        self.assertIn("DATE_BASED_URL", error_types(issues))

    def test_date_based_url_expected(self):
        issues = self._validate("/ar/2024/01/01/convert-doc-to-pdf/")
        i = issue_of(issues, "DATE_BASED_URL")
        self.assertEqual(i["expected_url"], "/ar/words/convert-doc-to-pdf/")

    # ── WRONG_PRODUCT ─────────────────────────────────────────────────────────

    def test_wrong_product_detected(self):
        issues = self._validate("/ar/cells/convert-doc-to-pdf/")
        self.assertIn("WRONG_PRODUCT", error_types(issues))

    def test_wrong_product_expected_uses_folder_slug(self):
        issues = self._validate("/ar/cells/convert-doc-to-pdf/")
        i = issue_of(issues, "WRONG_PRODUCT")
        self.assertEqual(i["expected_url"], "/ar/words/convert-doc-to-pdf/")

    def test_wrong_product_no_duplicate_product_in_expected(self):
        # Regression: /zh/taiwan/tex/slug/ was producing /zh-tw/tex/tex/slug/
        p = self._file("zh-hant", "/zh/taiwan/tex/convert-latex-to-png/")
        issues = main.validate_translated(
            p, "tex", "2025-01-01-convert-latex-to-png", "zh-hant",
            "/tex/convert-latex-to-png/"
        )
        wrong = issue_of(issues, "WRONG_PRODUCT")
        if wrong:
            # Expected must be /{url_lang}/{product}/{slug}/ — product segment appears exactly once
            parts = wrong["expected_url"].strip("/").split("/")
            self.assertNotEqual(parts[1], parts[2], "Product segment must not be duplicated")

    def test_wrong_product_expected_never_has_url_lang_code_twice(self):
        issues = self._validate("/ar/cells/convert-doc-to-pdf/")
        i = issue_of(issues, "WRONG_PRODUCT")
        self.assertEqual(i["expected_url"].count("/ar/"), 1)

    # ── LANG_CODE_MISMATCH ────────────────────────────────────────────────────

    def test_lang_code_mismatch_detected(self):
        issues = self._validate("/zh/words/convert-doc-to-pdf/", lang="ar")
        self.assertIn("LANG_CODE_MISMATCH", error_types(issues))

    def test_lang_code_mismatch_expected_uses_folder_slug(self):
        issues = self._validate("/zh/words/convert-doc-to-pdf/", lang="ar")
        i = issue_of(issues, "LANG_CODE_MISMATCH")
        self.assertEqual(i["expected_url"], "/ar/words/convert-doc-to-pdf/")

    # ── zh-hant URL prefix ──────────────────────────────────────────────────
    # Real content was migrated from a /zh-tw/ URL prefix to /zh-hant/ (matching the
    # lang code directly, no alias). Verified against production content: 2,166/2,356
    # zh-hant files now use /zh-hant/, the remaining 168 still on /zh-tw/ are exactly
    # the kind of drift this validator exists to catch.

    def test_zh_hant_with_zh_hant_url_is_valid(self):
        # zh-hant files use the zh-hant URL prefix directly — must NOT trigger LANG_CODE_MISMATCH
        issues = self._validate("/zh-hant/words/convert-doc-to-pdf/", lang="zh-hant")
        self.assertNotIn("LANG_CODE_MISMATCH", error_types(issues))

    def test_zh_hant_with_zh_tw_url_triggers_mismatch(self):
        # Legacy /zh-tw/ prefix is no longer correct for zh-hant files — should be flagged
        issues = self._validate("/zh-tw/words/convert-doc-to-pdf/", lang="zh-hant")
        self.assertIn("LANG_CODE_MISMATCH", error_types(issues))

    def test_zh_hant_mismatch_expected_uses_zh_hant(self):
        issues = self._validate("/zh-tw/words/convert-doc-to-pdf/", lang="zh-hant")
        i = issue_of(issues, "LANG_CODE_MISMATCH")
        self.assertIn("/zh-hant/", i["expected_url"])

    def test_zh_hant_wrong_url_prefix_triggers_mismatch(self):
        # /zh/ prefix instead of /zh-hant/ should also be flagged for zh-hant files
        issues = self._validate("/zh/words/convert-doc-to-pdf/", lang="zh-hant")
        self.assertIn("LANG_CODE_MISMATCH", error_types(issues))

    # ── URL_MISMATCH_WITH_ENGLISH ─────────────────────────────────────────────

    def test_slug_mismatch_with_english_detected(self):
        issues = self._validate("/ar/words/different-slug/")
        self.assertIn("URL_MISMATCH_WITH_ENGLISH", error_types(issues))

    def test_slug_mismatch_expected_mirrors_english(self):
        issues = self._validate("/ar/words/different-slug/")
        i = issue_of(issues, "URL_MISMATCH_WITH_ENGLISH")
        self.assertEqual(i["expected_url"], "/ar/words/convert-doc-to-pdf/")

    def test_slug_mismatch_not_reported_when_wrong_product_explains_it(self):
        # If product is wrong, URL_MISMATCH_WITH_ENGLISH should not also fire
        issues = self._validate("/ar/cells/convert-doc-to-pdf/")
        self.assertNotIn("URL_MISMATCH_WITH_ENGLISH", error_types(issues))

    def test_slug_mismatch_not_reported_without_english_base(self):
        issues = self._validate("/ar/words/different-slug/", english_url=None)
        self.assertNotIn("URL_MISMATCH_WITH_ENGLISH", error_types(issues))

    # ── Multi-error cases ─────────────────────────────────────────────────────

    def test_wrong_lang_and_wrong_product_both_reported(self):
        # Regression: /zh/taiwan/tex/slug/ — both lang and product are wrong
        p = self._file("zh-hant", "/zh/taiwan/tex/convert-latex-to-png/")
        issues = main.validate_translated(
            p, "tex", "2025-01-01-convert-latex-to-png", "zh-hant",
            "/tex/convert-latex-to-png/"
        )
        types = error_types(issues)
        self.assertIn("LANG_CODE_MISMATCH", types)
        self.assertIn("WRONG_PRODUCT", types)

    def test_missing_trailing_slash_does_not_prevent_other_checks(self):
        # MISSING_TRAILING_SLASH is non-terminal — other errors should still be found
        issues = self._validate("/ar/cells/different-slug")
        types = error_types(issues)
        self.assertIn("MISSING_TRAILING_SLASH", types)
        self.assertIn("WRONG_PRODUCT", types)


# ── scan_all (filesystem integration) ────────────────────────────────────────

class TestScanAll(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.content = Path(self.tmpdir.name)
        self.patcher = patch.object(main, "CONTENT_DIR", self.content)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmpdir.cleanup()

    def _post(self, product: str, folder: str, files: dict):
        """Create a post directory with given files. files = {filename: url or None}"""
        post_dir = self.content / product / folder
        post_dir.mkdir(parents=True, exist_ok=True)
        for filename, url in files.items():
            make_file(post_dir, filename, url)
        return post_dir

    def test_clean_post_no_issues(self):
        self._post("words", "2024-01-01-convert-doc", {
            "index.md": "/words/convert-doc/",
            "index.ar.md": "/ar/words/convert-doc/",
        })
        issues, stats = main.scan_all()
        self.assertEqual(issues, [])
        self.assertEqual(stats["products"], 1)
        self.assertEqual(stats["posts"], 1)
        self.assertEqual(stats["files"], 2)

    def test_no_english_base_detected(self):
        self._post("words", "2024-01-01-convert-doc", {
            "index.ar.md": "/ar/words/convert-doc/",
        })
        issues, _ = main.scan_all()
        self.assertIn("NO_ENGLISH_BASE", error_types(issues))

    def test_missing_url_english(self):
        self._post("cells", "2024-03-01-create-excel", {
            "index.md": None,
        })
        issues, _ = main.scan_all()
        self.assertIn("MISSING_URL", error_types(issues))

    def test_multiple_products_scanned(self):
        self._post("words", "2024-01-01-post-a", {"index.md": "/words/post-a/"})
        self._post("cells", "2024-01-01-post-b", {"index.md": "/cells/post-b/"})
        _, stats = main.scan_all()
        self.assertEqual(stats["products"], 2)

    def test_stats_count_files_correctly(self):
        self._post("words", "2024-01-01-post-a", {
            "index.md": "/words/post-a/",
            "index.ar.md": "/ar/words/post-a/",
            "index.fr.md": "/fr/words/post-a/",
        })
        _, stats = main.scan_all()
        self.assertEqual(stats["files"], 3)

    def test_underscore_dirs_skipped(self):
        # Dirs starting with _ (like _index) should be ignored
        (self.content / "_drafts").mkdir(parents=True)
        self._post("words", "2024-01-01-post", {"index.md": "/words/post/"})
        _, stats = main.scan_all()
        self.assertEqual(stats["products"], 1)

    def test_lang_code_parsed_from_filename(self):
        self._post("words", "2024-01-01-post", {
            "index.md": "/words/post/",
            "index.zh-hant.md": "/zh-hant/words/post/",
        })
        issues, _ = main.scan_all()
        zh_issues = [i for i in issues if i["lang"] == "zh-hant"]
        self.assertEqual(zh_issues, [])  # zh-hant URL is valid for zh-hant lang


if __name__ == "__main__":
    unittest.main()
