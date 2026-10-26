"""In-process pub/sub for live investigation events (SSE).

The runner publishes run lines and lifecycle events; the API layer exposes
``/api/events`` as a Server-Sent-Events stream so any client can watch runs
execute in real time.
"""

from __future__ import annotations

import queue
import threading
from datetime import datetime, timezone

_subscribers: list[queue.Queue] = []
_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def subscribe() -> queue.Queue:
    """Registers a new subscriber queue and returns it."""
    stream: queue.Queue = queue.Queue(maxsize=500)
    with _lock:
        _subscribers.append(stream)
    return stream


def unsubscribe(stream: queue.Queue) -> None:
    with _lock:
        if stream in _subscribers:
            _subscribers.remove(stream)


def publish(event: dict) -> None:
    """Fans an event out to every subscriber; slow subscribers drop events."""
    envelope = {"at": _now_iso(), **event}
    with _lock:
        targets = list(_subscribers)
    for target in targets:
        try:
            target.put_nowait(envelope)
        except queue.Full:
            pass
