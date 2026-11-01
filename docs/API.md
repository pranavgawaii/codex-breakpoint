# Breakpoint Engine API Specification

The Breakpoint Engine exposes a local-first REST and Server-Sent Events (SSE) interface powered by FastAPI. Headless command-line runs via `breakpoint` and the web UI communicate over this contract.

## Base URL & Configuration

- Default Engine Endpoint: `http://127.0.0.1:8000`
- Environment Variables:
  - `BREAKPOINT_ENGINE_URL`: Base URL when the engine service runs on a non-default host or port.
  - `BREAKPOINT_DATA_DIR`: Directory for local JSON store persistence (defaults to `.breakpoint/`).
  - `BREAKPOINT_TIMEOUT_MS`: Proxy timeout threshold in milliseconds (default: `12000`).

---

## Endpoints

### 1. Health Probe
- **Method:** `GET`
- **Route:** `/api/health`
- **Response:**
  ```json
  {
    "ok": true,
    "engine": "breakpoint-python"
  }
  ```

### 2. Projects Collection
- **Method:** `GET`
- **Route:** `/api/projects`
- **Description:** Returns all registered test projects.
- **Response:**
  ```json
  {
    "projects": [
      {
        "id": "project_demo",
        "name": "Trusted session-state demo",
        "root": "/path/to/project",
        "trusted": true,
        "framework": "node",
        "testFiles": ["test/session-flow.test.js"],
        "createdAt": "2026-10-31T18:00:00.000Z"
      }
    ]
  }
  ```

- **Method:** `POST`
- **Route:** `/api/projects`
- **Description:** Registers a project root directory on the local machine.
- **Request Body:**
  ```json
  {
    "root": "/absolute/path/to/project",
    "trusted": true
  }
  ```
- **Response Status:** `201 Created`

### 3. Investigation Snapshot
- **Method:** `GET`
- **Route:** `/api/investigations`
- **Description:** Returns the complete state of the active investigation, including recorded runs, static analyses, evidence items, hypotheses, patches, and verifications.

### 4. Investigation Action Dispatch
- **Method:** `POST`
- **Route:** `/api/investigations`
- **Description:** Dispatches an engine-owned investigation action.
- **Supported Actions:**
  - `run-demo`: Executes the bundled session-state reproducer sequence.
  - `run-workflow`: Runs the full controlled matrix pipeline (triage, target resolution, isolation runs, comparison).
  - `scan-project`: Runs static AST shared-state analysis without test execution.
  - `start-investigation`: Initializes an active investigation context for a project.
  - `ai-review`: Synthesizes an evidence-bounded hypothesis and review notes.
  - `propose-patch`: Drafts a cleanup patch from recorded evidence.
  - `approve-patch`: Applies a proposed patch and reruns the failing probe for verification.
  - `revert-patch`: Restores baseline file content for an applied patch.
- **Request Body Example:**
  ```json
  {
    "action": "run-workflow",
    "projectId": "project_demo",
    "testFile": "test/session-flow.test.js"
  }
  ```

### 5. Live Telemetry Stream
- **Method:** `GET`
- **Route:** `/api/events`
- **Format:** `text/event-stream` (Server-Sent Events)
- **Description:** Streams live execution log lines, step completions, and runner status events to connected clients.
