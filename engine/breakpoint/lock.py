"""Serializes mutating investigation operations in this server process.

Breakpoint is intentionally single-tenant and local, so a queue is
unnecessary: a second concurrent action fails fast with a clear 409 instead
of corrupting the read-modify-write JSON store or overlapping test runs.
"""

from __future__ import annotations

import threading
from typing import Callable, TypeVar

from .errors import ConflictError

T = TypeVar("T")

_lock = threading.Lock()
_state_lock = threading.Lock()
_current_operation: str | None = None


def run_exclusive(operation: str, work: Callable[[], T]) -> T:
    """Runs ``work`` while holding the mutation lock; refuses to queue.

    Raises ConflictError when another action is already running.
    """
    global _current_operation
    with _state_lock:
        if _current_operation is not None:
            raise ConflictError(
                f"Another investigation action ({_current_operation}) is still running. "
                f"Wait for it to finish before starting {operation}."
            )
        _current_operation = operation
    try:
        with _lock:
            return work()
    finally:
        with _state_lock:
            _current_operation = None


def current_operation() -> str | None:
    """Name of the operation currently holding the lock, if any."""
    with _state_lock:
        return _current_operation
