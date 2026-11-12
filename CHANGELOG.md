# Changelog

All notable changes to the Breakpoint project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.4] - 2026-11-12

### Added
- **CLI JSON Audit Export**: Added `--json` flag to `breakpoint report` command to output raw investigation snapshot payloads directly for automated tooling.
- **Enriched Engine Health Telemetry**: Enhanced `/api/health` in FastAPI engine to report running version and active SSE subscriber metrics.
- **API Health Schema Documentation**: Updated `docs/API.md` with enriched health probe response schema.

## [2.5.3] - 2026-11-08

### Fixed
- **Runner Test Deduplication Priority**: Prioritized explicit failure test statuses over passing or skipped duplicates in `_dedupe_tests` within `runner.py`, preventing masked failure reporting on retried runs.
- **Test Runner Executable Resolution**: Added fallback lookup against system `PATH` via `shutil.which` in `discovery.py` when framework binaries (`jest`, `vitest`) are not installed directly under local `node_modules/.bin`.

## [2.5.2] - 2026-11-06

### Fixed
- **Patch Apply and Revert Verification**: Enforced target file existence and accessibility checks in `patch_review.py` before applying or reverting file patches to prevent silent failures on deleted files.
- **Deterministic Suspicion Ranking**: Added deterministic tie-breaking in `choose_target` in `state_analysis.py` to preserve stable target selection across identical test suspicion scores.
- **Audit Certificate Formatting**: Gracefully formatted target test strings in summary audit certificate exports when reasoning metadata is omitted.

### Performance
- **Run Evidence Mapping**: Precomputed reverse lookup maps in `compare_run_matrix` in `comparison.py` to eliminate redundant linear scans across recorded evidence.

## [2.5.1] - 2026-11-03

### Fixed
- **Patch Review Module Stem Resolution**: Fixed `_module_stem` in `patch_review.py` to properly resolve `path.parent.name` when inspecting `__init__.py` module paths, and removed redundant duplicate hash helper.
- **Runner Descriptor Cleanup**: Added `finally` cleanup in `runner.py` to unlink temporary JUnitXML descriptor files from `/tmp` upon run completion.
- **Process Timeout Diagnostics**: Enhanced `spawn_safe.py` to append structured timeout notes to `stderr` when subprocess execution exceeds allocated timeout thresholds.
- **Discovery Deduplication**: Deduplicated discovered test and source files in `discovery.py` while preserving deterministic ordering and forward-slash path separators.
- **Project Registration Validation**: Enforced strict validation in `projects.py` to reject whitespace-only project roots and verify directory accessibility before registration.
- **SSE Stream Subscriber Capacity**: Bounded in-memory event queues in `events.py` with a 64-subscriber ceiling, evicting stale queues to prevent memory leakage.
- **Workspace Target Fallback**: Added defensive fallback rendering in `Workspace` for investigations missing explicit target reasoning strings.
- **Decorative SVG Semantics**: Added `aria-hidden="true"` and `focusable="false"` to interactive reproducer cockpit icons for accessibility compliance.

### Performance
- **Optimized Snapshot ID Resolution**: Refactored `snapshot()` in `investigations.py` to resolve runs, evidence, comparisons, hypotheses, patches, and verifications via dictionary indexes rather than repeated linear scans.

### Added
- **CLI Quiet Mode**: Added `-q` / `--quiet` options to `breakpoint version` and `breakpoint scan` for headless and CI scripting integration.
- **Duration Precision Formatting**: Formatted run execution durations with compact millisecond/second scaling in the workspace dashboard.
- **API Documentation**: Expanded `docs/API.md` with complete query parameters, action payloads, error schemas, and HTTP status codes.
- **Comprehensive Unit Tests**: Added unit tests for module stem resolution, unified diff hunks, and CLI quiet flag outputs, bringing the test suite to 33 passing tests.

## [2.5.0] - 2026-11-02

### Added
- **Engine Health Endpoint & Latency Tracking**: Added `/api/health` Next.js route providing engine connectivity verification, mode tracking (`online` vs `simulation`), and latency instrumentation.
- **Dynamic Kernel Status in Navigation**: Integrated live engine health status into `ModernNav` header with color-coded status badges.
- **CLI Workflow Dry-Run**: Implemented `--dry-run` flag in `breakpoint workflow` to preview the resolved execution plan without spawning child runner processes.
- **CLI Dry-Run Test Coverage**: Added automated unit test in `test_cli.py` verifying `--dry-run` output formatting.
- **JSON Investigation Snapshot Export**: Added one-click "Export JSON" action in the investigation summary audit view to download raw state snapshots.
- **Keyboard Shortcuts Helper Modal**: Added global `HotkeyGuide` component (`?` trigger) with modal dialog documenting navigation and execution hotkeys.
- **Memory Isolation Model Specification**: Added comprehensive architecture documentation in `docs/ISOLATION_MODEL.md` specifying the 4-phase isolation lifecycle.

### Changed
- **High-Contrast Focus Indicators**: Enforced WCAG 2.1 AAA compliant focus rings (`:focus-visible`) across all interactive buttons, tabs, and input elements.
- **CI Workflow Optimization**: Streamlined `.github/workflows/ci.yml` steps to execute root `npm test` and verbose pytest checks.

## [2.4.2] - 2026-11-01

### Added
- **Engine CLI Subcommands**: Added `breakpoint version` and `breakpoint projects` to inspect registered test directories, frameworks, and trust statuses without starting the browser.
- **Diff View Statistics & Copy Action**: Integrated addition/deletion line counters (`+N / -M`) and one-click clipboard copying with transient visual feedback in `DiffView``.
- **Keyboard Navigation & ARIA Support**: Elevated `InteractiveReproducer` with full `role="tablist"` / `role="tab"` semantics and arrow-key scenario cycling.
- **Investigation Run Presets**: Introduced profile switcher in the run plan configurator (`Standard Matrix`, `Fast Triage`, and `Exhaustive Matrix`).
- **Audit Certificate Export & Print Optimization**: Added one-click audit trail summary copy action and clean print CSS rules (`@media print`) for certification reports.
- **Expanded Test Discovery**: Added discovery support for `vitest.workspace.*` configurations and exclusions for `poetry.lock` and `Pipfile.lock`.
- **Comprehensive Test Suites**: Created `test_cli.py` and `test_store.py`, expanding the automated pytest suite to 30 passing tests.
- **API Documentation**: Documented all engine REST endpoints and Server-Sent Events (SSE) schemas in `docs/API.md`.

### Changed
- **Atomic Store Writes & Concurrency**: Refactored `engine/breakpoint/store.py` with re-entrant locking (`RLock`) and automatic temporary file cleanup to guarantee data integrity.
- **Engine Client Resilience**: Configured request abort timeouts and rich diagnostic error payloads on 502 responses in `app/api/engine-client.js`.
- **Navigation Accessibility**: Added escape-key listener and scroll-lock management to the mobile navigation drawer in `ModernNav``.
- **Root Layout Metadata**: Enhanced `RootLayout` with OpenGraph specifications, Twitter cards, and dark theme-color viewport tokens.

### Fixed
- **API Route Fallbacks**: Provided seamless sample data fallbacks for `/api/projects` and `/api/investigations` when the Python backend is offline.
- **AST Exception Handling**: Guarded Python AST parsing in `state_analysis.py` against recursion errors and malformed inputs.
