"""Executes fixed argument vectors with no shell.

argv only — this module never accepts shell strings. Every child gets a
scrubbed environment, a kill timer, and per-stream output caps so a chatty
test suite cannot exhaust server memory.
"""

from __future__ import annotations

import os
import subprocess
import time
from typing import TypedDict

from .errors import ValidationError

MAX_OUTPUT_BYTES = 64 * 1024
DEFAULT_TIMEOUT_MS = 10_000

TRUNCATION_NOTE = "\n[output truncated at 65536 bytes]"


class RunStatus(TypedDict):
    status: str
    exitCode: int | None
    stdout: str
    stderr: str
    durationMs: int


class ProcessResult(TypedDict):
    spec: dict
    result: RunStatus


def _scrubbed_environment(cwd: str, extra_env: dict[str, str] | None) -> dict[str, str]:
    """Minimal child environment: nothing secret, nothing noisy, TZ pinned."""
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": cwd,
        "TZ": "UTC",
        "LANG": "C",
        "NO_COLOR": "1",
        "CI": "1",
        "FORCE_TTY": "0",
        "NO_PROXY": "*",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONHASHSEED": "0",
        "NODE_ENV": "test",
        "NODE_OPTIONS": "--max-old-space-size=256",
    }
    if extra_env:
        env.update(extra_env)
    return env


def _cap(text: str) -> str:
    """Caps one output stream at MAX_OUTPUT_BYTES with an honest note."""
    encoded = text.encode("utf-8")
    if len(encoded) <= MAX_OUTPUT_BYTES:
        return text
    capped = encoded[:MAX_OUTPUT_BYTES].decode("utf-8", errors="ignore")
    return capped + TRUNCATION_NOTE


def run_process(
    argv: list[str],
    cwd: str,
    spec: dict | None = None,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
    extra_env: dict[str, str] | None = None,
    on_line: "callable | None" = None,
) -> ProcessResult:
    """Runs one argv and returns a persistence-ready result.

    ``on_line`` receives each streamed stdout line while the process runs so
    the API layer can broadcast live output to subscribers.
    """
    if not isinstance(argv, list) or not all(isinstance(part, str) for part in argv):
        raise ValidationError("Subprocess argv must be an array of strings.")
    if len(argv) == 0:
        raise ValidationError("Subprocess argv cannot be empty.")
    if not isinstance(cwd, str):
        raise ValidationError("Subprocess cwd must be a string.")

    echoed_spec = spec or {"label": "ad-hoc process", "argv": list(argv), "cwd": cwd}
    started = time.monotonic()
    timed_out = False

    try:
        process = subprocess.Popen(
            argv,
            cwd=cwd,
            shell=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_scrubbed_environment(cwd, extra_env),
            start_new_session=True,
        )
    except OSError as error:
        return {
            "spec": echoed_spec,
            "result": {
                "status": "infrastructure_error",
                "exitCode": None,
                "stdout": "",
                "stderr": str(error),
                "durationMs": int((time.monotonic() - started) * 1000),
            },
        }

    stdout_lines: list[str] = []
    stderr_lines: list[str] = []

    def _pump(stream, sink: list[str], broadcast) -> None:
        assert stream is not None
        try:
            for line in stream:
                sink.append(line)
                if broadcast is not None:
                    try:
                        broadcast(line.rstrip("\n"))
                    except Exception:
                        pass
        except (OSError, ValueError):
            pass  # stream closed by a timeout kill; keep what was drained

    import threading

    pump_out = threading.Thread(target=_pump, args=(process.stdout, stdout_lines, on_line), daemon=True)
    pump_err = threading.Thread(target=_pump, args=(process.stderr, stderr_lines, None), daemon=True)
    pump_out.start()
    pump_err.start()
    timed_out = False
    try:
        process.wait(timeout=timeout_ms / 1000)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            os.killpg(process.pid, 9)
        except (ProcessLookupError, PermissionError, OSError):
            process.kill()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    pump_out.join(timeout=2)
    pump_err.join(timeout=2)

    stdout_text = "".join(stdout_lines)
    stderr_text = "".join(stderr_lines)
    exit_code = process.returncode
    status = (
        "timeout"
        if timed_out
        else "passed" if exit_code == 0 else "failed"
    )
    return {
        "spec": echoed_spec,
        "result": {
            "status": status,
            "exitCode": exit_code,
            "stdout": _cap(stdout_text),
            "stderr": _cap(stderr_text or ""),
            "durationMs": int((time.monotonic() - started) * 1000),
        },
    }
