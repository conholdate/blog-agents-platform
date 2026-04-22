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


# ── Utility functions ─────────────────────────────────────────────────────────

class TestNormalizeUrl(unittest.TestCase):
    def test_adds_trailing_slash(self):
        self.assertEqual(main.normalize_url("/aspose-words/convert-doc/"), "/aspose-words/convert-doc/")

    def test_missing_trailing_slash(self):
        self.assertEqual(main.normalize_url("/aspose-words/convert-doc"), "/aspose-words/convert-doc/")

    def test_root_slash(self):
        self.assertEqual(main.normalize_url("/"), "/")

    def test_empty_string(self):
        self.assertEqual(main.normalize_url(""), "/")


class TestSlugFromFolder(unittest.TestCase):
    def test_strips_date_prefix(self):
        self.assertEqual(main.slug_from_folder("2024-03-15-convert-doc-to-pdf"), "convert-doc-to-pdf")

    def test_no_date_prefix(self):
        self.assertEqual(main.slug_from_folder("convert-doc-to-pdf"), "convert-doc-to-pdf")

    def test_partial_date_not_stripped(self):
        # Only full YYYY-MM-DD- prefix should be stripped
        self.assertEqual(main.slug_from_folder("2024-convert-doc"), "2024-convert-doc")

    def test_multiple_date_prefixes_strips_first_only(self):
        self.assertEqual(main.slug_from_folder("2024-03-15-2023-01-01-slug"), "2023-01-01-slug")


class TestGetUrl(unittest.TestCase):
    def test_returns_url_from_frontmatter(self):
        self.assertEqual(main.get_url({"url": "/aspose-words/slug/"}), "/aspose-words/slug/")

    def test_strips_whitespace(self):
        self.assertEqual(main.get_url({"url": "  /aspose-words/slug/  "}), "/aspose-words/slug/")

    def test_missing_key_returns_empty(self):
        self.assertEqual(main.get_url({}), "")

    def test_none_value_returns_empty(self):
        self.assertEqual(main.get_url({"url": None}), "")

    def test_integer_value_cast_to_string(self):
        self.assertEqual(main.get_url({"url": 123}), "123")


# ── parse_frontmatter ─────────────────────────────────────────────────────────

class TestParseFrontmatter(unittest.TestCase):
    def _write(self, content: str) -> Path:
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8")
        f.write(content)
        f.close()
        return Path(f.name)

    def test_parses_valid_frontmatter(self):
        p = self._write("---\ntitle: Hello\nurl: /aspose/slug/\n---\nBody text")
        result = main.parse_frontmatter(p)
        self.assertEqual(result["title"], "Hello")
        self.assertEqual(result["url"], "/aspose/slug/")

    def test_returns_empty_dict_for_no_frontmatter(self):
        p = self._write("Just plain content, no frontmatter")
        self.assertEqual(main.parse_frontmatter(p), {})

    def test_returns_empty_dict_for_empty_file(self):
        p = self._write("")
        self.assertEqual(main.parse_frontmatter(p), {})

    def test_handles_missing_file_gracefully(self):
        result = main.parse_frontmatter(Path("/nonexistent/path/file.md"))
        self.assertEqual(result, {})


# ── validate_english ──────────────────────────────────────────────────────────

class TestValidateEnglish(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        # Patch REPO_ROOT so relative_to() works
        self.patcher = patch.object(main, "REPO_ROOT", self.root)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmpdir.cleanup()

    def _make_file(self, url: Optional[str]) -> Path:
        p = self.root / "index.md"
        frontmatter = f"url: {url}" if url is not None else ""
        p.write_text(f"---\n{frontmatter}\n---\nBody", encoding="utf-8")
        return p

    def test_valid_url_no_issues(self):
        p = self._make_file("/aspose-words/convert-doc-to-pdf/")
        issues, english_url = main.validate_english(p, "aspose-words", "2024-01-01-convert-doc-to-pdf")
        self.assertEqual(issues, [])
        self.assertEqual(english_url, "/aspose-words/convert-doc-to-pdf/")

    def test_missing_trailing_slash(self):
        p = self._make_file("/aspose-words/convert-doc-to-pdf")
        issues, _ = main.validate_english(p, "aspose-words", "2024-01-01-convert-doc-to-pdf")
        error_types = [i["error_type"] for i in issues]
        self.assertIn("MISSING_TRAILING_SLASH", error_types)

    def test_missing_url_field(self):
        p = self._make_file(None)
        issues, english_url = main.validate_english(p, "aspose-words", "2024-01-01-convert-doc-to-pdf")
        error_types = [i["error_type"] for i in issues]
        self.assertIn("MISSING_URL", error_types)
        self.assertIsNone(english_url)

    def test_date_based_url(self):
        p = self._make_file("/2024/01/01/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "aspose-words", "2024-01-01-convert-doc-to-pdf")
        error_types = [i["error_type"] for i in issues]
        self.assertIn("DATE_BASED_URL", error_types)

    def test_wrong_product(self):
        p = self._make_file("/aspose-cells/convert-doc-to-pdf/")
        issues, _ = main.validate_english(p, "aspose-words", "2024-01-01-convert-doc-to-pdf")
        error_types = [i["error_type"] for i in issues]
        self.assertIn("WRONG_PRODUCT", error_types)

    def test_expected_url_in_issue(self):
        p = self._make_file(None)
        issues, _ = main.validate_english(p, "aspose-words", "2024-01-01-convert-doc-to-pdf")
        self.assertEqual(issues[0]["expected_url"], "/aspose-words/convert-doc-to-pdf/")


# ── validate_translated ───────────────────────────────────────────────────────

class TestValidateTranslated(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.patcher = patch.object(main, "REPO_ROOT", self.root)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmpdir.cleanup()

    def _make_file(self, url: Optional[str]) -> Path:
        p = self.root / "index.ar.md"
        frontmatter = f"url: {url}" if url is not None else ""
        p.write_text(f"---\n{frontmatter}\n---\nBody", encoding="utf-8")
        return p

    def test_valid_translated_url_no_issues(self):
        p = self._make_file("/ar/aspose-words/convert-doc-to-pdf/")
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        self.assertEqual(issues, [])

    def test_missing_url(self):
        p = self._make_file(None)
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        error_types = [i["error_type"] for i in issues]
        self.assertIn("MISSING_URL", error_types)

    def test_wrong_lang_prefix(self):
        p = self._make_file("/zh/aspose-words/convert-doc-to-pdf/")
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        error_types = [i["error_type"] for i in issues]
        self.assertIn("LANG_CODE_MISMATCH", error_types)

    def test_wrong_product_in_translated(self):
        p = self._make_file("/ar/aspose-cells/convert-doc-to-pdf/")
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        error_types = [i["error_type"] for i in issues]
        self.assertIn("WRONG_PRODUCT", error_types)

    def test_date_based_translated_url(self):
        p = self._make_file("/ar/2024/01/01/convert-doc-to-pdf/")
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        error_types = [i["error_type"] for i in issues]
        self.assertIn("DATE_BASED_URL", error_types)

    def test_slug_mismatch_with_english(self):
        p = self._make_file("/ar/aspose-words/different-slug/")
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        error_types = [i["error_type"] for i in issues]
        self.assertIn("URL_MISMATCH_WITH_ENGLISH", error_types)

    def test_missing_trailing_slash_translated(self):
        p = self._make_file("/ar/aspose-words/convert-doc-to-pdf")
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", "/aspose-words/convert-doc-to-pdf/"
        )
        error_types = [i["error_type"] for i in issues]
        self.assertIn("MISSING_TRAILING_SLASH", error_types)

    def test_no_english_base_uses_fallback_expected(self):
        p = self._make_file(None)
        issues = main.validate_translated(
            p, "aspose-words", "2024-01-01-convert-doc-to-pdf",
            "ar", None  # no English base
        )
        self.assertTrue(any(i["expected_url"].startswith("/ar/") for i in issues))


if __name__ == "__main__":
    unittest.main()
