"""Run specs, output parsers (TAP/jest/junitxml) and the focused run matrix."""

from __future__ import annotations

import os
import re
import time
import uuid
from pathlib import Path

from .discovery import build_run_command
from .errors import ValidationError
from .spawn_safe import run_process

TIMEOUT_MS = 15_000
MAX_PARSED_TESTS = 200


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _sanitized_name(value: str) -> str:
    """Strips control characters so names cannot be spoofed into JSON."""
    cleaned = re.sub(r"[^\x20-\x7e]", "", value)
    return cleaned[:200].strip()


def parse_tap(output: str) -> list[dict]:
    """Parses TAP output (node --test, vitest --reporter=tap).

    Handles spec lines (`✔ name (12.34ms)`), classic TAP (`ok 1 - name` with
    YAML diagnostics) and `# Subtest:` announcement comments.
    """
    results: list[dict] = []
    lines = output.split("\n")

    for index, line in enumerate(lines):
        spec_match = re.match(r"^([✔✖])\s+(.+?)\s*\(([\d.]+)ms\)", line)
        if spec_match:
            results.append({
                "name": _sanitized_name(spec_match.group(2)),
                "status": "passed" if spec_match.group(1) == "✔" else "failed",
                "durationMs": float(spec_match.group(3)),
            })
            if len(results) >= MAX_PARSED_TESTS:
                return results
            continue

        tap_match = re.match(r"^(not ok|ok)\s+\d+\s*(?:-\s*)?(.*)$", line)
        if tap_match:
            tail = tap_match.group(2)
            is_skipped = bool(re.search(r"#\s*(SKIP|TODO)", tail))
            name = _sanitized_name(re.sub(r"#\s*(SKIP|TODO).*$", "", tail).strip())
            if name:
                context = "\n".join(lines[index + 1:index + 26])
                duration = re.search(r"^\s+duration_ms:\s*([\d.]+)", context, re.MULTILINE)
                error = re.search(r"^\s+error:\s*['\"]?([^\n'\"]+)", context, re.MULTILINE)
                results.append({
                    "name": name,
                    "status": "skipped" if is_skipped else ("passed" if tap_match.group(1) == "ok" else "failed"),
                    "durationMs": float(duration.group(1)) if duration else None,
                    "error": error.group(1).strip() if error else None,
                })
                if len(results) >= MAX_PARSED_TESTS:
                    return results
            continue

        subtest_match = re.match(r"^# Subtest: (.*)$", line)
        if subtest_match:
            name = _sanitized_name(subtest_match.group(1))
            if name and not any(result["name"] == name for result in results):
                results.append({"name": name, "status": "unknown"})
                if len(results) >= MAX_PARSED_TESTS:
                    return results
    return results


def parse_jest_style(output: str) -> list[dict]:
    """Weak but explicit jest-style reporter parsing."""
    results: list[dict] = []
    for line in output.split("\n"):
        match = re.match(r"^\s*(?:✓|√)\s+(.*)$|^\s*(?:✕|×)\s+(.*)$", line)
        if not match:
            continue
        failed = bool(re.match(r"^\s*(?:✕|×)", line))
        name = _sanitized_name((match.group(2) if failed else match.group(1)) or "")
        if not name:
            continue
        results.append({"name": name, "status": "failed" if failed else "passed"})
        if len(results) >= MAX_PARSED_TESTS:
            return results
    return results


def parse_junitxml(text: str) -> list[dict]:
    """Parses pytest's junitxml output into per-test records.

    Every ``<testcase>`` becomes one record; ``<failure>``/``<error>`` children
    mark failures, ``<skipped>`` marks skips, everything else passed.
    """
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []

    def local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    results: list[dict] = []
    containers = [root] if local_name(root.tag) == "testcase" else []
    stack = list(root.iter())
    for element in stack:
        if local_name(element.tag) == "testcase":
            containers.append(element)
    for case in containers:
        name = case.get("name") or ""
        # Bare test name: pytest's junitxml also carries classname, but the
        # engine's targets, node ids and ordered names all use bare names.
        display_name = _sanitized_name(name)
        duration = float(case.get("time") or 0) * 1000
        children = [local_name(child.tag) for child in case]
        if "failure" in children or "error" in children:
            failure = next((child for child in case if local_name(child.tag) in ("failure", "error")), None)
            message = (failure.get("message") if failure is not None else "") or ""
            first_line = (failure.text or "").strip().split("\n")[0] if failure is not None and failure.text else ""
            results.append({
                "name": display_name,
                "status": "failed",
                "durationMs": duration,
                "error": _sanitized_name(message or first_line) or None,
            })
        elif "skipped" in children:
            results.append({"name": display_name, "status": "skipped", "durationMs": duration})
        else:
            results.append({"name": display_name, "status": "passed", "durationMs": duration})
        if len(results) >= MAX_PARSED_TESTS:
            break
    return results


def _dedupe_tests(tests: list[dict]) -> list[dict]:
    seen: set[str] = set()
    kept: list[dict] = []
    for test in tests:
        key = f"{test['name']}::{test['status']}"
        if key in seen:
            continue
        seen.add(key)
        kept.append(test)
    return kept


def parse_output(parser: str, stdout: str, stderr: str, junit_text: str | None = None) -> list[dict]:
    if parser == "tap":
        return parse_tap(stdout)
    if parser == "jest":
        return parse_jest_style(f"{stdout}\n{stderr}")
    if parser == "junit":
        return parse_junitxml(junit_text or "")
    return []


def build_test_run(
    run_id: str,
    project_id: str,
    investigation_id: str,
    spec: dict,
    status: str,
    exit_code: int | None,
    stdout: str,
    stderr: str,
    duration_ms: int,
    parser: str,
    junit_text: str | None = None,
) -> dict:
    """Builds the persisted TestRun record from a raw process result."""
    raw_tests = parse_output(parser, stdout, stderr, junit_text)
    finished = time.time()
    started = finished - duration_ms / 1000
    from datetime import datetime, timezone

    iso = lambda seconds: datetime.fromtimestamp(seconds, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"  # noqa: E731
    return {
        "id": run_id,
        "projectId": project_id,
        "investigationId": investigation_id,
        "label": spec["label"],
        "status": status,
        "command": spec["argv"],
        "workingDirectory": spec["cwd"],
        "startedAt": iso(started),
        "finishedAt": iso(finished),
        "durationMs": duration_ms,
        "exitCode": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "tests": _dedupe_tests(raw_tests),
        "environment": {
            "engine": "breakpoint-python",
            "platform": os.name,
            "cwd": spec["cwd"],
            "parser": parser,
        },
        "spec": {"label": spec["label"], "argv": spec["argv"], "cwd": spec["cwd"]},
    }


def execute_run_spec(project: dict, investigation_id: str, spec: dict, timeout_ms: int = TIMEOUT_MS, on_line=None) -> dict:
    """Executes one run spec against a project and returns a persistence-ready run."""
    if not spec.get("argv"):
        raise ValidationError("Run spec is missing argv.")
    if spec.get("parser") is None:
        raise ValidationError("Run spec is missing a parser designation.")
    outcome = run_process(
        argv=spec["argv"],
        cwd=spec["cwd"],
        spec={"label": spec["label"], "argv": spec["argv"], "cwd": spec["cwd"]},
        timeout_ms=timeout_ms,
        on_line=on_line,
    )
    result = outcome["result"]
    junit_text = None
    if spec["parser"] == "junit" and spec.get("junitPath"):
        try:
            junit_text = Path(spec["junitPath"]).read_text(encoding="utf-8")
        except OSError:
            junit_text = None
    return build_test_run(
        run_id=_new_id("run"),
        project_id=project["id"],
        investigation_id=investigation_id,
        spec=spec,
        status=result["status"],
        exit_code=result["exitCode"],
        stdout=result["stdout"],
        stderr=result["stderr"],
        duration_ms=result["durationMs"],
        parser=spec["parser"],
        junit_text=junit_text,
    )


def escape_test_name_pattern(name: str) -> str:
    """Escapes a test name for regex-based selectors (--test-name-pattern)."""
    return re.sub(r"[.*+?^${}()|[\]\\]", r"\\\g<0>", name)


def build_matrix_specs(project: dict, shape: dict) -> list[dict]:
    """Builds the focused matrix for a resolved target test.

    pytest narrows with ``file::test`` node ids; node/jest use name patterns.
    """
    test_file = shape["testFile"]
    target_test = shape.get("targetTest")
    predecessor_test = shape.get("predecessorTest")
    is_pytest = project["framework"] == "pytest"
    specs: list[dict] = []

    def solo(label: str, test_name: str) -> None:
        if is_pytest:
            argv_spec = build_run_command(project["root"], "pytest", test_files=[f"{test_file}::{test_name}"])
        else:
            argv_spec = build_run_command(project["root"], project["framework"], test_files=[test_file], test_name_pattern=escape_test_name_pattern(test_name))
        specs.append({"label": label, "argv": argv_spec["argv"], "cwd": project["root"], "parser": argv_spec["parser"]})

    if target_test:
        solo(f"target test in isolation — {target_test}", target_test)
    if predecessor_test:
        solo(f"predecessor test in isolation — {predecessor_test}", predecessor_test)

    whole = build_run_command(project["root"], project["framework"], test_files=[test_file])
    specs.append({"label": f"file in declared order — {test_file}", "argv": whole["argv"], "cwd": project["root"], "parser": whole["parser"]})
    specs.append({"label": f"file again (reproducibility probe) — {test_file}", "argv": whole["argv"], "cwd": project["root"], "parser": whole["parser"]})
    return specs


def rerun_recorded_spec(project: dict, investigation_id: str, previous: dict, label: str, on_line=None) -> dict:
    """Re-executes a recorded run spec verbatim (post-patch verification)."""
    return execute_run_spec(
        project,
        investigation_id,
        {
            "label": label,
            "argv": previous["spec"]["argv"],
            "cwd": previous["spec"]["cwd"],
            "parser": previous.get("environment", {}).get("parser") or "tap",
        },
        on_line=on_line,
    )
