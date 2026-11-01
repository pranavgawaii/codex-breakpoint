# Breakpoint Memory Isolation & Deterministic Replay Model

Breakpoint guarantees that every test execution probe, bisection replay, and patch verification runs under strict deterministic boundaries. This document specifies the memory isolation lifecycle and execution model enforced by the Breakpoint Engine.

---

## 1. Threat & Flakiness Taxonomy

Order-dependent test failures arise from state leakage across test boundaries. Breakpoint targets three primary root cause vectors:

1. **Global/Singleton State Mutation**:
   - Tests mutate module-level variables or runtime globals (`global.__STORE__`, Python module-level dicts/lists).
   - Subsequent test cases fail because they execute against tainted memory.

2. **Unflushed Microtask & Async Handle Leaks**:
   - Unawaited Promises, unclosed TCP sockets, or active timers remain open after a test exits.
   - Leaked handles intercept callbacks or exhaust resource pools during subsequent suite runs.

3. **Disk & Shared Environment Bleed**:
   - Writes to shared cache files, local configuration directories, or environment variables without guaranteed teardown.

---

## 2. The 4-Phase Isolation Lifecycle

```
[Phase 1: Static AST Scan]
          │  Parse module-level assignments & mutation functions (no execution)
          ▼
[Phase 2: Triage Isolation]
          │  Execute suspected test suites in scrubbed subprocesses
          ▼
[Phase 3: Order Bisection Matrix]
          │  Probe target in isolation vs sequential predecessor order
          ▼
[Phase 4: Atomic Patch Replay]
             Apply non-destructive patch, rerun failing probe, verify exit 0
```

### Phase 1: Static Shared-State Scan
- Python: Analyzed with stdlib `ast` parser, identifying module-level mutable collections (`list`, `dict`, `set`) and functions that invoke mutating methods (`.append()`, `.clear()`, `.pop()`).
- JavaScript/TypeScript: Scanned via AST-level noise-stripping regex parsing for module-scoped variables and mutation calls (`push`, `splice`, `Map.set`).

### Phase 2: Triage Isolation
- Tests are executed within clean child processes using strict argument isolation (`node --test --test-concurrency=1` or `python -m pytest -p no:cacheprovider`).
- Output buffers are strictly capped to prevent Denial of Service from runaway logging loops.

### Phase 3: Order Bisection Matrix
- Breakpoint establishes mathematical proof of order dependence by executing:
  1. `Target Test` in strict isolation -> Proves the test passes in a clean environment.
  2. `Predecessor Test` in isolation -> Captures baseline behavior of the predecessor.
  3. `Predecessor + Target Test` sequentially -> Reproduces the failure deterministically.
  4. `Target Test` repeated -> Confirms whether failure reproduces across iterations.

### Phase 4: Atomic Patch Replay
- When a patch is approved, the engine atomically rewrites the target file, immediately reruns the isolated probe, and verifies that the failure condition is resolved before writing the permanent record.

---

## 3. Subprocess Sandboxing Rules

1. **Scrubbed Environment**: Child processes inherit only a sanitized subset of host environment variables; secrets, tokens, and arbitrary environment variables are never propagated.
2. **Deterministic Timeouts**: Every execution is bound by hard wall-clock timeouts.
3. **Owner-Only File Permissions**: Stored run records and junit telemetry XML descriptors are created with `0o600` permissions (readable and writable only by the process owner).
4. **Zero Remote Exfiltration**: All AST scans, execution captures, and audit trails remain strictly on the host machine.
