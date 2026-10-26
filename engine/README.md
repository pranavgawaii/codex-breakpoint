# Breakpoint engine

The standalone debugging engine for order-dependent and flaky tests.

- **Service**: `breakpoint serve` — a FastAPI app exposing the same JSON API
  the Breakpoint web UI consumes (`/api/projects`, `/api/investigations`).
- **CLI**: `breakpoint register|scan|run|patch|approve|revert|report` — the
  full workflow with no browser at all.
- **Engines supported**: pytest (native, junitxml), node:test (TAP), jest, vitest.

Every run is an argv-only subprocess (no shell), with a scrubbed environment,
hard timeout and capped output. Patches are draft-first and approval-gated,
applied only when every target file still matches its byte-exact baseline.

```bash
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,ai]"

breakpoint serve --port 8000            # API for the web UI
breakpoint run ../python-sample-project # full workflow, headless
pytest                                  # the engine's own tests
```
