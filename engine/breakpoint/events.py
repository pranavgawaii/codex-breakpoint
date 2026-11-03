"""In-process pub/sub for live investigation events (SSE).

The runner publishes run lines and lifecycle events; the API layer exposes
``/api/events`` as a Server-Sent-Events stream so any client can watch runs
execute in real time.
"""

from __future__ import annotations

import queue
import threading
from datetime import datetime, timezone

MAX_SUBSCRIBERS = 64
_subscribers: list[queue.Queue] = []
_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def subscriber_count() -> int:
    """Returns the number of active subscriber queues."""
    with _lock:
        return len(_subscribers)


def subscribe() -> queue.Queue:
    """Registers a new subscriber queue and returns it."""
    stream: queue.Queue = queue.Queue(maxsize=500)
    with _lock:
        if len(_subscribers) >= MAX_SUBSCRIBERS:
            # Drop the oldest inactive subscriber queue to bound memory
            oldest = _subscribers.pop(0)
            try:
                oldest.put_nowait({"at": _now_iso(), "type": "disconnect", "reason": "capacity_limit"})
            except queue.Full:
                pass
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
