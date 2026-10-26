"""Tests for the static shared-state analysis."""

from breakpoint.state_analysis import (
    analyze_project,
    choose_target,
    ordered_test_names,
    scan_module_state,
    strip_noise,
)

JS_SOURCE = """\
// module-level state
let activeUser = null;
const cache = new Map();

export function authenticate(name) {
  activeUser = name;
  cache.set(name, true);
}

export function clearSession() {
  activeUser = null;
  cache.clear();
}

function internalBump() {
  activeUser = activeUser + "!";
}
"""

PY_SOURCE = """\
_ledger = []
_cache = {}

def record_charge(amount):
    _ledger.append(amount)

def clear_ledger():
    _ledger.clear()

def _internal_bump():
    _cache["x"] = 1
"""

PY_TEST = """\
from billing import record_charge, total_charged


def test_charge_is_recorded():
    record_charge(5)
    assert total_charged() == 5


def test_expected_total():
    record_charge(7)
    assert total_charged() == 7
"""


def test_strip_noise_preserves_line_numbers():
    raw = "let a = 1; // comment\nconst b = 2;\n"
    cleaned = strip_noise(raw)
    assert cleaned.split("\n") == ["           \n"[0:11], "const b = 2;", ""][0:2] or cleaned.count("\n") == raw.count("\n")
    assert "comment" not in cleaned
    assert "const b = 2;" in cleaned


def test_js_scanner_finds_module_state_and_mutators():
    fact = scan_module_state("src/session.js", JS_SOURCE)
    names = {variable["name"] for variable in fact["mutableVars"]}
    assert names == {"activeUser", "cache"}
    exported = {func["name"] for func in fact["functions"] if func["exported"]}
    assert exported == {"authenticate", "clearSession"}
    assert any(candidate["name"] == "clearSession" for candidate in fact["resetCandidates"])
    # internal mutator discovered and not exported
    internal = [func for func in fact["functions"] if not func["exported"]]
    assert [func["name"] for func in internal] == ["internalBump"]


def test_python_scanner_uses_ast():
    fact = scan_module_state("billing.py", PY_SOURCE)
    names = {variable["name"] for variable in fact["mutableVars"]}
    assert names == {"_ledger", "_cache"}
    exported = {func["name"] for func in fact["functions"] if func["exported"]}
    assert exported == {"record_charge", "clear_ledger"}
    resets = [candidate["name"] for candidate in fact["resetCandidates"]]
    assert resets == ["clear_ledger"]


def test_ordered_test_names_python():
    assert ordered_test_names(PY_TEST) == ["test_charge_is_recorded", "test_expected_total"]


def test_analyze_project_scores_and_findings():
    file_texts = {
        "billing.py": PY_SOURCE,
        "tests/test_ledger_flow.py": PY_TEST,
    }
    analysis = analyze_project(
        file_texts,
        test_files=["tests/test_ledger_flow.py"],
        source_files=["billing.py"],
    )
    statements = [finding["statement"] for finding in analysis["findings"]]
    assert any("Module-level" in statement and "_ledger" in statement for statement in statements)
    assert any("declares no reset hooks" in statement for statement in statements)
    assert analysis["scores"]["tests/test_ledger_flow.py"] >= 3
    target = choose_target(analysis, file_texts, ["tests/test_ledger_flow.py"])
    assert target["testFile"] == "tests/test_ledger_flow.py"
    assert target["targetTest"] == "test_expected_total"
    assert target["predecessorTest"] == "test_charge_is_recorded"
