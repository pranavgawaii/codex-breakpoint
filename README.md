<p align="center">
  <img src="public/brand/breakpoint-logo.svg" alt="Breakpoint Logo" width="320" />
</p>

<p align="center">
  <strong>Don't guess the bug. Prove it.</strong>
</p>

<p align="center">
  An evidence-first debugging workspace for inconsistent and order-dependent test failures.
</p>

---

## Quick Start (30 Seconds)

Breakpoint runs a fully functional local debugging workflow out of the box without requiring external API keys:

```bash
# 1. Clone and enter the repository
git clone https://github.com/pranavgawaii/codex-breakpoint.git
cd codex-breakpoint

# 2. Install dependencies (Node 20+ required)
npm install

# 3. Start the application
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the overview or [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to trigger the five-stage controlled investigation flow.

---

## The Problem

Every engineering team has encountered this scenario:

> A test passes reliably when run alone in isolation (`npm test -- test/session.test.js`), but fails unpredictably when executed as part of the full test suite (`npm test`).

Developers typically respond by:
1. Re-running the suite hoping it was a fluke.
2. Dumping pages of `console.log` statements into test files.
3. Guessing at race conditions or timing issues.
4. Asking an LLM to "fix the bug" without giving it execution context—often producing plausible-looking patches that fail when applied.

### Why this happens

In modern test suites, tests that share a process often share hidden state:
- **Module-level variables** mutated during authentication or caching.
- **Global mocks or singletons** that are not cleaned up in `afterEach` hooks.
- **Database or filesystem remnants** left behind by previous assertions.
- **Execution order dependencies** where Test B only passes if Test A ran beforehand, or fails if Test A ran first.

Reading static log dumps cannot prove causation because logs show what happened, not why the state diverged from the passing baseline.

---

## What Breakpoint Does

Breakpoint treats flaky test debugging like a forensic investigation rather than a guessing game:

1. **Executes Controlled Comparisons**: Runs the target test in isolation, the suspect test in isolation, the pair in original order, the pair in reversed order, and repeats the sequence.
2. **Collects Verifiable Evidence**: Parses machine-readable test events (TAP protocol) and binds findings to specific run identities (`run_xxx`).
3. **Labels Uncertainties Explicitly**: When application heap state was not captured, Breakpoint explicitly tags findings as `unknown` rather than hallucinating internal transitions.
4. **Constrains AI with Strict Evidence Citations**: When OpenAI review is enabled, the model can only formulate hypotheses by citing existing evidence IDs. If the model references an unobserved fact, the tool call is rejected by the server.
5. **Gates Fixes Behind Approval & Verification**: Generates a targeted cleanup patch, displays the exact diff, applies it only after human confirmation, and immediately re-runs the failing sequence to verify the fix.

---

## How It Works

Breakpoint follows a five-stage verification cycle:

```
┌─────────────┐     ┌───────────┐     ┌─────────────┐     ┌───────────┐     ┌──────────┐
│  Reproduce  │ ──► │  Compare  │ ──► │ Investigate │ ──► │  Propose  │ ──► │  Verify  │
└─────────────┘     └───────────┘     └─────────────┘     └───────────┘     └──────────┘
  Isolated vs         Differential       Evidence-Cited      Approval-Gated    Post-Patch
  Ordered Runs        Analysis           Hypotheses          Code Fix          Rerun
```

### Flow Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (Browser)
    participant UI as Next.js Workspace (/dashboard)
    participant API as Route Handler (/api/investigations)
    participant Runner as Test Runner (lib/test-runner.ts)
    participant Cmp as Diff Engine (lib/comparison.ts)
    participant Store as JSON Store (lib/store.ts)
    participant AI as OpenAI Adapter (lib/openai-provider.ts)
    participant Patch as Patch Engine (lib/patch-review.ts)

    Dev->>UI: Click "Run controlled workflow"
    UI->>API: POST /api/investigations { action: "run-workflow" }
    
    rect rgb(240, 244, 255)
        note over API,Runner: Stage 1: Reproduce
        API->>Runner: runApprovedDemo("isolated")
        Runner-->>API: TestRun (exitCode: 0, passed)
        API->>Runner: runApprovedDemo("auth")
        Runner-->>API: TestRun (exitCode: 0, passed)
        API->>Runner: runApprovedDemo("pair")
        Runner-->>API: TestRun (exitCode: 1, failed)
        API->>Runner: runApprovedDemo("reverse")
        Runner-->>API: TestRun (exitCode: 0, passed)
        API->>Runner: runApprovedDemo("pair")
        Runner-->>API: TestRun (exitCode: 1, failed)
    end

    rect rgb(245, 245, 245)
        note over API,Cmp: Stage 2: Compare
        API->>Cmp: compareRuns(failingRun, passingReverseRun)
        Cmp-->>API: Findings [status, order, exitCode, unknown state]
        API->>Store: Persist runs, comparisons, evidence IDs
    end

    rect rgb(255, 250, 240)
        note over API,AI: Stage 3: Investigate
        Dev->>UI: Click "Run AI evidence review" (Optional)
        UI->>API: POST /api/investigations { action: "ai-review" }
        API->>AI: evaluateEvidence(snapshot)
        AI-->>API: Function Call record_hypothesis(citedEvidenceIds)
        API->>Store: Persist hypothesis (needs_review)
    end

    rect rgb(240, 255, 245)
        note over API,Patch: Stage 4 & 5: Propose & Verify
        Dev->>UI: Click "Propose cleanup fix"
        UI->>API: POST /api/investigations { action: "propose-patch" }
        API->>Patch: createDemoCleanupPatch()
        Patch-->>API: ProposedPatch (draft)
        
        Dev->>UI: Click "Approve & verify fix"
        UI->>API: POST /api/investigations { action: "approve-patch", patchId }
        API->>Patch: applyDemoPatch() (checks disk baseline)
        API->>Runner: runApprovedDemo("pair")
        Runner-->>API: TestRun (exitCode: 0, passed)
        API->>Patch: verifyRun() -> "verified"
        API->>Store: Update investigation status: "verified"
    end

    API-->>UI: Complete Investigation Snapshot
    UI-->>Dev: Render verified evidence audit report
```

---

## Key Features (Verified in Code)

- **Allowlisted Process Execution (`lib/test-runner.ts`)**: Executes real Node.js test runs using `child_process.spawn` with an unalterable argument allowlist (`isolated`, `auth`, `pair`, `reverse`, `suite`). The browser cannot supply arbitrary shell commands, working directories, or execution parameters.
- **Process Safety Controls (`lib/test-runner.ts`)**: Enforces a strict 10-second execution timeout via `SIGKILL`, 64 KB stdout/stderr buffer truncation, memory bounds via `--max-old-space-size=128`, and runs without shell interpretation (`shell: false`).
- **Differential TAP Output Parser (`lib/test-runner.ts`)**: Ingests standard TAP output from Node's native test runner (`node --test`), extracting individual subtest names, run durations, exit codes, and failure assertion messages.
- **Differential Run Comparison Engine (`lib/comparison.ts`)**: Contrasts failing and passing runs across status, exit codes, execution sequence, and assertion errors. Explicitly creates records with `certainty: "unknown"` for uncaptured runtime memory state.
- **Single-Tenant Operation Serialization (`lib/lock.ts`)**: Mutating actions (`run-workflow`, `ai-review`, `approve-patch`) are protected by an in-memory lock that returns HTTP 409 Conflict if a concurrent mutation is initiated.
- **Local-First Atomic Store (`lib/store.ts`)**: Persists runs, evidence, comparisons, and patches to `.breakpoint/investigations.json` using atomic temporary file creation (`mode 0o600`) and renaming, protecting against partial writes.
- **Constrained AI Function Calling (`lib/openai-provider.ts`)**: Integrates with OpenAI's Responses API using strict function definitions (`record_hypothesis`). Server-side validation requires that all cited supporting and contradicting evidence IDs exist in the active investigation; hallucinatory citations result in immediate rejection.
- **Approval-Gated Safe Patching (`lib/patch-review.ts`)**: Patches are generated as immutable drafts. Before writing to disk, Breakpoint verifies that the target file matches the recorded baseline hash. An approval click is required to apply the patch, and a subsequent rerun must pass before marking the issue "verified".
- **One-Click Patch Rollback (`lib/patch-review.ts`)**: Restores original baseline file contents cleanly with a single click (`action: "revert-patch"`).

---

## Example Debugging Scenario

Breakpoint includes a real, reproduction-ready sample project in `sample-project/`.

### The Bug

In `sample-project/src/session.js`:

```javascript
let activeUser = null;

export function authenticate(user) { activeUser = user; }
export function currentUser() { return activeUser; }
export function clearSession() { activeUser = null; }
```

In `sample-project/test/session-flow.test.js`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, currentUser } from "../src/session.js";

test("authentication establishes the demo user", () => {
  authenticate("demo-user-1");
  assert.equal(currentUser(), "demo-user-1");
});

test("session starts without a user", () => {
  assert.equal(currentUser(), null, "session should be empty at test setup");
});
```

### The Failure Sequence

1. **Isolation Run**: Running only `session starts without a user` succeeds:
   ```bash
   node --test --test-name-pattern "session starts without a user" test/session-flow.test.js
   # Result: ✔ session starts without a user (exit code: 0)
   ```
2. **Sequential Suite Run**: Running the full test file fails:
   ```bash
   node --test test/session-flow.test.js
   # 1. authenticate establishes the demo user -> PASS (mutates activeUser to "demo-user-1")
   # 2. session starts without a user -> FAIL (assertion error: 'demo-user-1' !== null)
   ```
3. **Reversed Sequence Run**: Running in reverse order in `test/reverse-flow.test.js` succeeds:
   ```bash
   node --test test/reverse-flow.test.js
   # 1. session starts without a user -> PASS (activeUser was null)
   # 2. authenticate establishes the demo user -> PASS
   ```

### How Breakpoint Proves It

- Runs all three variations back-to-back and records stdout/stderr, durations, and TAP events.
- Compares Run 3 (failing ordered run) against Run 4 (passing reversed run).
- Discovers that the test failure is strictly order-dependent, linking the finding to evidence IDs `ev_xxx`.
- Proposes a cleanup patch to reset state between runs:
  ```diff
  + test.beforeEach(() => clearSession());
  ```
- Applies the patch, reruns the failing ordered pair, confirms exit code 0, and archives the investigation as **Verified**.

---

## Technology Stack

Derived directly from `package.json` and active code:

| Component | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 15.5.28 (App Router) | Server-rendered UI, dynamic route handlers (`/api/investigations`), and static report generation. |
| **Frontend Library** | React 19.1.10 | Client components for real-time investigation stepper, diff view, and tabbed run inspection. |
| **Language & Types** | TypeScript 5.x | Strict type safety across investigation models, runner configurations, and API payloads. |
| **Test Runner** | Node.js Native Runner (`node --test`) | Native TAP-compliant runner executed via subprocesses without external testing framework dependencies. |
| **AI Integration** | OpenAI Node SDK (`^6.16.0`) | Structured hypothesis evaluation using the OpenAI Responses API with function tool constraints. |
| **Styling** | Vanilla CSS | Bespoke design system based on warm paper aesthetic, Outfit and Redaction 35 typography, and hairline borders. |
| **Persistence** | Node.js `fs/promises` | Atomic local file writes to `.breakpoint/investigations.json`. |

---

## Getting Started

### Prerequisites

- **Node.js**: v20.0.0 or higher (required for native `node --test` runner).
- **npm**: v10.0.0 or higher.
- **Git**

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/pranavgawaii/codex-breakpoint.git
   cd codex-breakpoint
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` to enable optional AI hypothesis review:
   ```bash
   # Required only if you want AI-assisted evidence review
   OPENAI_API_KEY=your_openai_api_key_here

   # Optional: Model override (defaults to gpt-5.4)
   OPENAI_MODEL=gpt-5.4

   # Optional: Override investigation store directory (defaults to .breakpoint/)
   # BREAKPOINT_DATA_DIR=/path/to/custom/dir
   ```

   > **Note**: An OpenAI API key is **not required** to use Breakpoint. The full five-step controlled workflow, differential comparison engine, deterministic hypothesis generation, patch proposal, and fix verification operate 100% locally and deterministically.

4. Start the development server:
   ```bash
   npm run dev
   ```

   Navigate to [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
codex-breakpoint/
├── app/                                 # Next.js App Router
│   ├── api/investigations/route.ts      # REST API: run-workflow, ai-review, patches
│   ├── app/page.tsx                     # Project selector and onboarding flow
│   ├── components/                      # Reusable UI components
│   │   ├── brand-mark.tsx               # SVG brand marks and glyphs
│   │   ├── diff-view.tsx                # Patch diff inspector
│   │   ├── investigation-window.tsx     # Embedded interactive demo window
│   │   ├── product-chrome.tsx           # Global navigation and status indicators
│   │   └── site-footer.tsx              # Clean editorial footer
│   ├── dashboard/                       # Interactive investigation workspace
│   │   ├── dashboard.css                # Workspace-specific stylesheets
│   │   ├── page.tsx                     # Dashboard route entry point
│   │   └── workspace.tsx                # 5-stage stepper, run tabs, patch reviewer
│   ├── investigations/
│   │   └── inv_session_state/
│   │       ├── page.tsx                 # Redirect helper
│   │       └── summary/page.tsx         # Comprehensive forensic audit report
│   ├── layout.tsx                       # Root layout and font declarations
│   ├── not-found.tsx                    # 404 error page
│   ├── page.tsx                         # Landing page with interactive live demo
│   ├── runtime.css                      # Utility and layout styling
│   └── styles.css                       # Design system tokens and typography
├── lib/                                 # Core backend & business logic
│   ├── agent.ts                         # Deterministic hypothesis builder
│   ├── comparison.ts                    # Differential run comparison engine
│   ├── errors.ts                        # Typed application errors (Conflict, AiUnavailable)
│   ├── investigations.ts                # Orchestrator for workflows, runs, and store
│   ├── lock.ts                          # Single-tenant in-memory operation lock
│   ├── models.ts                        # TypeScript interfaces (TestRun, Evidence, Patch)
│   ├── openai-provider.ts               # OpenAI Responses API function-calling adapter
│   ├── patch-review.ts                  # Baseline hash checker, patch applier, and reverter
│   ├── store.ts                         # Atomic JSON persistence (.breakpoint/investigations.json)
│   └── test-runner.ts                   # Process execution harness (spawn, TAP parser, limits)
├── sample-project/                      # Trusted local reproduction target
│   ├── src/
│   │   └── session.js                   # Source with shared module-level state
│   └── test/
│       ├── reverse-flow.test.js         # Passing reversed test pair
│       └── session-flow.test.js         # Failing ordered test pair
├── public/brand/                        # SVG and PNG brand marks
├── package.json                         # Dependencies and build scripts
└── tsconfig.json                        # TypeScript configuration
```

---

## Available Scripts

All scripts have been verified and tested:

```bash
# Start local development server with Turbopack support
npm run dev

# Check linting rules across all TypeScript and React files
npm run lint

# Verify TypeScript type correctness without emitting code
npm run typecheck

# Build optimized production bundle
npm run build

# Start production server
npm run start

# Run the sample project's tests directly in Node.js
node --test sample-project/test/session-flow.test.js
```

---

## Architecture and Security

### Subprocess Execution Model

Breakpoint runs test commands using `node:child_process.spawn`:
- **Shell-free execution**: `shell: false` ensures input strings are not parsed or expanded by bash/sh, eliminating shell injection vulnerabilities.
- **Fixed allowlist**: The server strictly maps command identifiers (`"isolated"`, `"pair"`, `"reverse"`) to predefined argument arrays. The client cannot specify arbitrary arguments or executables.
- **Predefined working directory**: Execution is locked to `path.join(process.cwd(), "sample-project")`.
- **Sanitized environment**: Subprocesses receive a minimal environment (`NODE_ENV: "test"`, `NODE_OPTIONS: "--max-old-space-size=128"`).

### Important Security Boundary Disclosures

> **Warning: This prototype runs Node.js subprocesses on the host machine.**
> 
> Ordinary child process execution with restricted parameters is a **harness boundary**, not a **virtualized sandbox**. Subprocesses running on the host retain filesystem access permitted by user permissions. 
> 
> Do not point Breakpoint at untrusted third-party repositories or execute unknown scripts outside a hardened virtual container (e.g., Docker, Firecracker, or gVisor).

### AI Security & Prompt Injection Mitigation

1. **Schema-enforced function calling**: OpenAI is strictly invoked using structured tool parameters (`record_hypothesis`). Free-form text output is ignored in favor of validated tool arguments.
2. **Evidence ID validation**: The server verifies that every ID passed in `supportingEvidenceIds` and `contradictingEvidenceIds` exists in `.breakpoint/investigations.json`. Hallucinated IDs cause immediate rejection.
3. **Prompt boundary enforcement**: Test outputs and repository contents are provided as structured data values, never as prompt instructions.
4. **Zero execution privileges for AI**: The AI model has no tool access to run commands, edit files, or mark investigations as verified. Only human user actions can approve patches or trigger runs.

---

## Current Status & Limitations

### Working Today
- Native Node.js test execution with TAP output parsing.
- 5-step reproduction workflow (isolated, predecessor, ordered, reversed, repeat).
- Differential run comparison with explicit "unknown" markers.
- Deterministic hypothesis formulation.
- Optional OpenAI Responses API integration with verified evidence citation.
- Baseline-checked, approval-gated patch proposal, application, and reversion.
- Post-fix rerun and verification recording.
- Comprehensive UI workspace and forensic summary report.

### Current Limitations
- **Subprocess Isolation**: Runs locally on the host; not containerized in Docker.
- **Language Scope**: Currently preconfigured for Node.js (`node --test`). Python (`pytest`), Go (`go test`), and Rust (`cargo test`) are planned.
- **Project Selection**: Hardcoded to the bundled `sample-project/` demonstration target. Dynamic directory selection is not yet enabled.

---

## Roadmap

- [ ] **Docker / MicroVM Sandboxing**: Execute test commands inside ephemeral containers to safely analyze untrusted repositories.
- [ ] **Multi-Language Runner Adapters**:
  - Python (`pytest --junitxml`)
  - Go (`go test -json`)
  - Rust (`cargo test -- --format=json`)
- [ ] **Automated Bisecting for Order Dependencies**: Automatically execute permutations of test sequences to isolate the exact predecessor test that causes state corruption.
- [ ] **GitHub Actions / CI Bot**: Run Breakpoint automatically when a flaky test failure is detected in CI, attaching a full investigation snapshot to the pull request.

---

## Hackathon Context

Breakpoint was created for the **DevDay Exchange Community Metro Hackathon: Pune** (Codex-powered build sprint).

- **Track**: Developer Tools / Software Reliability
- **Core Premise**: Moving beyond generative "code assistants" that guess bug fixes, toward structured developer tools that gather forensic evidence, reproduce failure conditions, and verify code fixes with actual test runs.
- **Pitch Deck**: [View Breakpoint Pitch Deck (6 slides, PDF)](docs/breakpoint-pitch-deck.pdf)

---

## License

Private project developed for hackathon demonstration.

Font assets in `public/fonts/` (Outfit, Redaction 35) are licensed under the [SIL Open Font License 1.1](public/fonts/LICENSE-OFL-1.1.txt). See [`public/fonts/FONT-LICENSES.md`](public/fonts/FONT-LICENSES.md) for full attribution.
