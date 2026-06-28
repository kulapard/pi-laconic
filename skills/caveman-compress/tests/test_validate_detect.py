"""Deterministic tests for validate.py and detect.py.

Covers the verbatim-preservation guarantees: a doctored "compression" that
drops a code line, a URL, or an inline code must be flagged. Also covers the
file-type classifier and the should_compress gate.
"""

from pathlib import Path

import pytest

from scripts import detect, validate
from scripts.validate import (
    ValidationResult,
    extract_code_blocks,
    extract_inline_codes,
    extract_urls,
)


# ---------- ValidationResult ----------


def test_validation_result_starts_valid():
    result = ValidationResult()
    assert result.is_valid is True
    assert result.errors == []
    assert result.warnings == []


def test_add_error_marks_invalid():
    result = ValidationResult()
    result.add_error("boom")
    assert result.is_valid is False
    assert result.errors == ["boom"]


def test_add_warning_keeps_valid():
    result = ValidationResult()
    result.add_warning("heads up")
    assert result.is_valid is True
    assert result.warnings == ["heads up"]


# ---------- Extractors ----------


def test_extract_code_blocks_roundtrip():
    text = "intro\n\n```python\nprint('hi')\nx = 1\n```\n\noutro"
    blocks = extract_code_blocks(text)
    assert blocks == ["```python\nprint('hi')\nx = 1\n```"]


def test_extract_urls_finds_all():
    text = "see https://example.com/a and http://foo.test/b)"
    assert extract_urls(text) == {"https://example.com/a", "http://foo.test/b"}


def test_extract_inline_codes_ignores_fenced():
    text = "use `foo` here\n\n```\n`not-inline`\n```\n\nand `bar`"
    codes = extract_inline_codes(text)
    assert "foo" in codes
    assert "bar" in codes
    assert "not-inline" not in codes


# ---------- Validators flag doctored compressions ----------


def _make_files(tmp_path: Path, original: str, compressed: str):
    orig = tmp_path / "orig.md"
    comp = tmp_path / "comp.md"
    orig.write_text(original)
    comp.write_text(compressed)
    return orig, comp


def test_validate_flags_dropped_code_line(tmp_path):
    original = "# Doc\n\n```python\nprint('hi')\nx = 1\n```\n"
    # Compression silently dropped `x = 1` from inside the code block.
    doctored = "# Doc\n\n```python\nprint('hi')\n```\n"
    orig, comp = _make_files(tmp_path, original, doctored)

    result = validate.validate(orig, comp)

    assert result.is_valid is False
    assert any("Code blocks not preserved" in e for e in result.errors)


def test_validate_flags_dropped_url(tmp_path):
    original = "# Doc\n\nVisit https://example.com/keep for details.\n"
    doctored = "# Doc\n\nVisit for details.\n"
    orig, comp = _make_files(tmp_path, original, doctored)

    result = validate.validate(orig, comp)

    assert result.is_valid is False
    assert any("URL mismatch" in e for e in result.errors)
    assert any("https://example.com/keep" in e for e in result.errors)


def test_validate_flags_dropped_inline_code(tmp_path):
    original = "# Doc\n\nRun the `deploy.sh` script then `cleanup`.\n"
    # Dropped the `cleanup` inline code.
    doctored = "# Doc\n\nRun the `deploy.sh` script.\n"
    orig, comp = _make_files(tmp_path, original, doctored)

    result = validate.validate(orig, comp)

    assert result.is_valid is False
    assert any("Inline code lost" in e for e in result.errors)


def test_validate_passes_identical_content(tmp_path):
    text = "# Doc\n\nUse `x` see https://a.test/p\n\n```\ncode\n```\n"
    orig, comp = _make_files(tmp_path, text, text)

    result = validate.validate(orig, comp)

    assert result.is_valid is True
    assert result.errors == []


def test_validate_heading_count_mismatch_is_error(tmp_path):
    original = "# One\n\ntext\n\n## Two\n\nmore\n"
    doctored = "# One\n\ntext more\n"
    orig, comp = _make_files(tmp_path, original, doctored)

    result = validate.validate(orig, comp)

    assert result.is_valid is False
    assert any("Heading count mismatch" in e for e in result.errors)


# ---------- detect.detect_file_type ----------


@pytest.mark.parametrize(
    "name,expected",
    [
        ("notes.md", "natural_language"),
        ("README.markdown", "natural_language"),
        ("doc.txt", "natural_language"),
        ("main.py", "code"),
        ("app.ts", "code"),
        ("config.json", "config"),
        ("settings.yaml", "config"),
        (".env", "config"),
        ("data.bin", "unknown"),
    ],
)
def test_detect_file_type_by_extension(tmp_path, name, expected):
    p = tmp_path / name
    p.write_text("placeholder\n")
    assert detect.detect_file_type(p) == expected


def test_detect_extensionless_natural_language(tmp_path):
    p = tmp_path / "TODO"
    p.write_text("Remember to water the plants and call the bank tomorrow.\n")
    assert detect.detect_file_type(p) == "natural_language"


def test_detect_extensionless_code(tmp_path):
    p = tmp_path / "snippet"
    p.write_text(
        "import os\n"
        "from sys import argv\n"
        "def main():\n"
        "    return argv\n"
        "class Foo:\n"
        "    pass\n"
    )
    assert detect.detect_file_type(p) == "code"


def test_detect_extensionless_json_config(tmp_path):
    p = tmp_path / "manifest"
    p.write_text('{"a": 1, "b": [2, 3]}')
    assert detect.detect_file_type(p) == "config"


# ---------- detect.should_compress ----------


def test_should_compress_true_for_markdown(tmp_path):
    p = tmp_path / "notes.md"
    p.write_text("Just some prose here.\n")
    assert detect.should_compress(p) is True


def test_should_compress_false_for_code(tmp_path):
    p = tmp_path / "main.py"
    p.write_text("print('hi')\n")
    assert detect.should_compress(p) is False


def test_should_compress_false_for_backup(tmp_path):
    p = tmp_path / "notes.original.md"
    p.write_text("prose\n")
    assert detect.should_compress(p) is False


def test_should_compress_false_for_missing_file(tmp_path):
    p = tmp_path / "does-not-exist.md"
    assert detect.should_compress(p) is False
