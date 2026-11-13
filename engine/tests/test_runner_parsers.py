"""Tests for output parsers and the unified diff engine."""

from breakpoint.patch_review import make_unified_diff
from breakpoint.runner import build_matrix_specs, escape_test_name_pattern, parse_jest_style, parse_junitxml, parse_tap

TAP_OUTPUT = """\
TAP version 13
# Subtest: test charge is recorded
ok 1 - test charge is recorded
  ---
  duration_ms: 12.34
  ...
# Subtest: test expected total
not ok 2 - test expected total
  ---
  duration_ms: 3.21
  error: 'expected 12 to equal 7'
  ...
1..2
"""

JUNIT_OUTPUT = """\
<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testsuite name="pytest" errors="0" failures="1" tests="2">
    <testcase classname="tests.test_ledger_flow" name="test_charge_is_recorded" time="0.001"/>
    <testcase classname="tests.test_ledger_flow" name="test_expected_total" time="0.002">
      <failure message="assert 12.0 == 7">assert (5+7) == 7</failure>
    </testcase>
  </testsuite>
</testsuites>
"""


def test_parse_tap_spec_and_classic():
    mixed = "✔ test a (1.5ms)\n✖ test b (2.0ms)\n" + TAP_OUTPUT
    tests = parse_tap(mixed)
    by_name = {test["name"]: test["status"] for test in tests}
    assert by_name["test a"] == "passed"
    assert by_name["test b"] == "failed"
    assert by_name["test charge is recorded"] == "passed"
    assert by_name["test expected total"] == "failed"


def test_parse_junitxml():
    tests = parse_junitxml(JUNIT_OUTPUT)
    assert tests[0]["name"] == "test_charge_is_recorded"
    assert tests[0]["status"] == "passed"
    assert tests[1]["status"] == "failed"
    assert "12.0" in (tests[1].get("error") or "")
    assert tests[1]["durationMs"] == 2.0


def test_parse_jest_style():
    tests = parse_jest_style("✓ passing test\n✕ broken test\n")
    assert tests == [
        {"name": "passing test", "status": "passed"},
        {"name": "broken test", "status": "failed"},
    ]


def test_escape_test_name_pattern():
    escaped = escape_test_name_pattern("fails (sometimes)")
    assert escaped == r"fails\ \(sometimes\)" or escaped == r"fails \(sometimes\)"


def test_matrix_specs_pytest_uses_node_ids(py_sample):
    py_sample["testFiles"] = ["tests/test_ledger_flow.py"]
    shape = {"testFile": "tests/test_ledger_flow.py", "targetTest": "test_expected_total", "predecessorTest": "test_charge_is_recorded"}
    specs = build_matrix_specs(py_sample, shape)
    labels = [spec["label"] for spec in specs]
    assert labels == [
        "target test in isolation — test_expected_total",
        "predecessor test in isolation — test_charge_is_recorded",
        "file in declared order — tests/test_ledger_flow.py",
        "file again (reproducibility probe) — tests/test_ledger_flow.py",
    ]
    assert "tests/test_ledger_flow.py::test_expected_total" in specs[0]["argv"]
    assert specs[0]["parser"] == "junit"


def test_make_unified_diff_hunks():
    before = "a\nb\nc\n"
    after = "a\nB\nc\n"
    diff = make_unified_diff(before, after, "file.txt")
    assert diff.startswith("--- a/file.txt\n+++ b/file.txt\n")
    assert "-b" in diff and "+B" in diff


def test_parse_junitxml_single_root_testcase():
    single = '<testcase name="standalone_probe" time="0.005"/>'
    tests = parse_junitxml(single)
    assert len(tests) == 1
    assert tests[0]["name"] == "standalone_probe"
    assert tests[0]["status"] == "passed"


def test_discover_files_ignores_lockfiles(tmp_path):
    from breakpoint.discovery import discover_files
    (tmp_path / "yarn.lock").write_text("yarn lock content", encoding="utf-8")
    (tmp_path / "bun.lockb").write_text("bun lock content", encoding="utf-8")
    (tmp_path / "package-lock.json").write_text("{}", encoding="utf-8")
    (tmp_path / "test_sample.py").write_text("def test_ok(): pass", encoding="utf-8")
    result = discover_files(str(tmp_path))
    assert "test_sample.py" in result["testFiles"]
    assert "yarn.lock" not in result["files"]
    assert "bun.lockb" not in result["files"]
    assert "package-lock.json" not in result["files"]


def test_module_stem_resolution():
    from breakpoint.patch_review import _module_stem
    assert _module_stem("src/billing.py") == "billing"
    assert _module_stem("pkg/__init__.py") == "pkg"
    assert _module_stem("nested/subpkg/__init__.py") == "subpkg"
    assert _module_stem("__init__.py") == "__init__"


def test_make_unified_diff_multiline_hunks():
    before = "line1\nline2\nline3\nline4\n"
    after = "line1\nline2_modified\nline3\nline4\n"
    diff = make_unified_diff(before, after, "example.py")
    assert "@@ -1,5 +1,5 @@" in diff
    assert "-line2\n+line2_modified" in diff


def test_dedupe_tests_prefers_failure():
    from breakpoint.runner import _dedupe_tests
    raw = [
        {"name": "test_cache", "status": "passed", "durationMs": 10},
        {"name": "test_cache", "status": "failed", "durationMs": 12, "error": "timeout"},
        {"name": "test_login", "status": "passed", "durationMs": 5},
    ]
    deduped = _dedupe_tests(raw)
    assert len(deduped) == 2
    cache_test = next(t for t in deduped if t["name"] == "test_cache")
    assert cache_test["status"] == "failed"
    assert cache_test["error"] == "timeout"


def test_make_unified_diff_identical_text():
    diff = make_unified_diff("hello\nworld\n", "hello\nworld\n", "test.txt")
    assert diff == ""
