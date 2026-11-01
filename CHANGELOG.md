# Changelog

All notable changes to the Breakpoint project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **Diff View Statistics & Copy Action**: Integrated addition/deletion line counters (`+N / -M`) and one-click clipboard copying with transient visual feedback in `DiffView`.
- **Keyboard Navigation & ARIA Support**: Elevated `InteractiveReproducer` with full `role="tablist"` / `role="tab"` semantics and arrow-key scenario cycling.
- **Investigation Run Presets**: Introduced profile switcher in the run plan configurator (`Standard Matrix`, `Fast Triage`, and `Exhaustive Matrix`).
- **Audit Certificate Export & Print Optimization**: Added one-click audit trail summary copy action and clean print CSS rules (`@media print`) for certification reports.
- **Expanded Test Discovery**: Added discovery support for `vitest.workspace.*` configurations and exclusions for `poetry.lock` and `Pipfile.lock`.
- **Comprehensive Test Suites**: Created `test_cli.py` and `test_store.py`, expanding the automated pytest suite to 30 passing tests.
- **API Documentation**: Documented all engine REST endpoints and Server-Sent Events (SSE) schemas in `docs/API.md`.

### Changed
- **Atomic Store Writes & Concurrency**: Refactored `engine/breakpoint/store.py` with re-entrant locking (`RLock`) and automatic temporary file cleanup to guarantee data integrity.
- **Engine Client Resilience**: Configured request abort timeouts and rich diagnostic error payloads on 502 responses in `app/api/engine-client.js`.
- **Navigation Accessibility**: Added escape-key listener and scroll-lock management to the mobile navigation drawer in `ModernNav`.
- **Root Layout Metadata**: Enhanced `RootLayout` with OpenGraph specifications, Twitter cards, and dark theme-color viewport tokens.

### Fixed
- **API Route Fallbacks**: Provided seamless sample data fallbacks for `/api/projects` and `/api/investigations` when the Python backend is offline.
- **AST Exception Handling**: Guarded Python AST parsing in `state_analysis.py` against recursion errors and malformed inputs.
