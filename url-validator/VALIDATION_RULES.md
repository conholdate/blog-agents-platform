# URL Validation Rules

All rules applied by `main.py` when scanning blog post frontmatter.

---

## English Posts (`index.md`)

Expected URL structure: `/{product}/{slug}/`

| Rule | Error Code | Condition | Expected URL |
|---|---|---|---|
| URL missing | `MISSING_URL` | No `url` field in frontmatter | `/{product}/{slug}/` |
| No trailing slash | `MISSING_TRAILING_SLASH` | URL doesn't end with `/` | Same URL + `/` |
| URL too short | `URL_TOO_SHORT` | Fewer than 2 path segments | `/{product}/{slug}/` |
| Date-based URL | `DATE_BASED_URL` | URL starts with `/YYYY/` | `/{product}/{slug}/` |
| Wrong product | `WRONG_PRODUCT` | First segment ≠ post's product folder | `/{product}/{slug}/` |

---

## Translated Posts (`index.{lang}.md`)

Expected URL structure: `/{url-lang}/{product}/{slug}/`

| Rule | Error Code | Condition | Expected URL |
|---|---|---|---|
| URL missing | `MISSING_URL` | No `url` field in frontmatter | `/{url-lang}/{product}/{slug}/` |
| No trailing slash | `MISSING_TRAILING_SLASH` | URL doesn't end with `/` | Same URL + `/` |
| URL too short | `URL_TOO_SHORT` | Fewer than 3 path segments | `/{url-lang}/{product}/{slug}/` |
| Date-based URL | `DATE_BASED_URL` | Second segment matches `YYYY` | `/{url-lang}/{product}/{slug}/` |
| Wrong product | `WRONG_PRODUCT` | Second segment ≠ post's product folder | `/{url-lang}/{product}/{slug}/` |
| Wrong lang prefix | `LANG_CODE_MISMATCH` | First segment ≠ expected URL lang | `/{url-lang}/{product}/{slug}/` |
| Slug differs from English | `URL_MISMATCH_WITH_ENGLISH` | Normalized URL ≠ `/{url-lang}{english_url}` | `/{url-lang}{english_url}` |
| No English base | `NO_ENGLISH_BASE` | `index.md` missing for the post | _(no expected URL)_ |

`URL_MISMATCH_WITH_ENGLISH` is only reported when no other error already explains the mismatch.

> **Expected URL rule:** For all error types except `URL_MISMATCH_WITH_ENGLISH`, the expected URL is always built from the folder-derived slug — never from the current URL's path segments. This prevents malformed URLs (duplicate product names, extra path parts, wrong lang codes) from polluting the expected URL.

---

## Language Code Aliases

Some file lang codes differ from their URL prefix by convention:

| File extension | URL prefix |
|---|---|
| `zh-hant` | `zh-tw` |

Add more entries to `LANG_URL_ALIASES` in `main.py` as needed.

---

## Redirect Rule Generation

For every issue where both `current_url` and `expected_url` are known and differ, a redirect rule is generated in the sheet's **Redirect Rule** column, ready to paste into `Redirects.json`:

```
"current_url": "https://blog.aspose.com/expected_url/"
```

| Error Code | Redirect Generated? |
|---|---|
| `MISSING_TRAILING_SLASH` | Yes |
| `URL_TOO_SHORT` | Yes (if current URL exists) |
| `DATE_BASED_URL` | Yes |
| `WRONG_PRODUCT` | Yes |
| `LANG_CODE_MISMATCH` | Yes |
| `URL_MISMATCH_WITH_ENGLISH` | Yes |
| `MISSING_URL` | No — no current URL to redirect from |
| `NO_ENGLISH_BASE` | No — no expected URL to redirect to |

---

## Common Issues Found in Practice

Patterns observed during real scans of blog.aspose.com.

### 1. Date-based URLs (high volume)
Old posts used `/YYYY/MM/DD/slug/` format before the product-based URL structure was adopted. These are the most common issue and always need a redirect.

```
/2021/06/18/create-excel-in-android/  →  /cells/create-excel-in-android/
```

### 2. Missing trailing slash
Very common in translated posts. URLs were entered without a trailing slash, which causes inconsistent behaviour.

```
/ar/words/merge-word-documents  →  /ar/words/merge-word-documents/
```

### 3. Wrong product segment
URL has a different product folder than where the file actually lives. Often caused by copy-pasting a URL from another product and not updating the product segment.

```
/ar/email/convert-latex-to-png-in-java/  →  /ar/tex/convert-latex-to-png-in-java/
```

### 4. Malformed translated lang + product (multi-error)
Some translated posts have both a wrong lang code AND a wrong product, producing structurally broken URLs like `/zh/taiwan/tex/slug/`. These generate both `LANG_CODE_MISMATCH` and `WRONG_PRODUCT` errors. The expected URL for both is the clean `/{url-lang}/{product}/{slug}/`.

```
/zh/taiwan/tex/convert-latex-to-png-in-java/  →  /zh-tw/tex/convert-latex-to-png-in-java/
```

### 5. zh-hant files with zh-tw URLs
Traditional Chinese posts use `.zh-hant.md` as the file extension but `/zh-tw/` as the URL prefix. This is intentional and not flagged as a `LANG_CODE_MISMATCH` — `zh-hant` → `zh-tw` is registered as a known alias.

### 6. URL slug differs from English base
Translated post's URL slug doesn't match the English post's URL slug. Usually caused by the translator entering a localised slug instead of mirroring the English URL.

```
English:  /words/merge-word-documents-using-csharp/
Arabic:   /ar/words/ادغام-مستندات-ورد/           ← wrong
Expected: /ar/words/merge-word-documents-using-csharp/
```

### 7. No English base file
A translated file (`index.ar.md`) exists but there is no corresponding `index.md` in the same post folder. The English post may have been deleted or never created.

---

## Processing Notes

- **Validation stops early** on `MISSING_URL` and `URL_TOO_SHORT` — further checks require a parseable URL.
- **English `URL_TOO_SHORT`** returns `None` as the English URL so translated files fall back to `/{url-lang}/{product}/{slug}/` rather than inheriting the malformed English URL.
- **Multiple errors per post** are possible — e.g. wrong lang code AND wrong product are reported as two separate rows.
- **Sheet output** is sorted by Error Code so all issues of the same type are grouped together.
- **Slug derivation** always uses the post folder name (strips `YYYY-MM-DD-` prefix). It is never taken from the current URL's path segments.
