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
- **Description:** Verifies service liveness, engine availability, version, and active subscriber queue count.
- **Response Status:** `200 OK`
- **Response Schema:**
  ```json
  {
    "ok": true,
    "engine": "breakpoint-python",
    "version": "0.1.0",
    "subscribers": 1
  }
  ```

### 2. Projects Collection
- **Method:** `GET`
- **Route:** `/api/projects`
- **Description:** Returns all registered test projects stored in local persistence.
- **Response Schema:**
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
- **Description:** Validates and registers a local project directory root.
- **Request Body:**
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `root` | `string` | Yes | Absolute directory path on local machine. Must be non-empty and non-system path. |
  | `trusted` | `boolean` | No | Explicit trust confirmation to allow process execution and patch generation (default: `false`). |
- **Response Status:** `201 Created`

### 3. Investigation Snapshot
- **Method:** `GET`
- **Route:** `/api/investigations`
- **Description:** Returns the complete state of the active investigation, including recorded runs, static analyses, evidence items, hypotheses, patches, and verifications.
- **Response Status:** `200 OK`

### 4. Investigation Action Dispatch
- **Method:** `POST`
- **Route:** `/api/investigations`
- **Description:** Dispatches an engine-owned investigation action in exclusive execution mode.
- **Request Body Fields:**
  | Field | Type | Description |
  | :--- | :--- | :--- |
  | `action` | `string` | Action identifier (see supported actions below). |
  | `projectId` | `string` | Target registered project ID (e.g., `project_demo`). |
  | `testFile` | `string` | Optional relative path to restrict triage or matrix execution. |
  | `targetTest` | `string` | Optional name pattern for specific failing test target. |
  | `patchId` | `string` | Target patch ID for `approve-patch` or `revert-patch`. |
  | `demoOnly` | `boolean` | Restrict action scope to built-in sample project. |

- **Supported Actions:**
  - `run-demo`: Executes the bundled session-state reproducer sequence.
  - `run-workflow`: Runs the full controlled matrix pipeline (triage, target resolution, isolation runs, comparison).
  - `scan-project`: Runs static AST shared-state analysis without test execution.
  - `start-investigation`: Initializes an active investigation context for a project.
  - `ai-review`: Synthesizes an evidence-bounded hypothesis and review notes.
  - `propose-patch`: Drafts a cleanup patch from recorded evidence.
  - `approve-patch`: Applies a proposed patch and reruns the failing probe for verification.
  - `revert-patch`: Restores baseline file content for an applied patch.

### 5. Live Telemetry Stream
- **Method:** `GET`
- **Route:** `/api/events`
- **Format:** `text/event-stream` (Server-Sent Events)
- **Description:** Streams live execution log lines, step completions, and runner status events to connected clients. Bounded to a maximum of 64 concurrent subscribers.

---

## Error Response Format

All error responses return structured JSON payloads adhering to standard HTTP status codes:

```json
{
  "error": "Human-readable diagnostic error message",
  "code": "error_code_identifier"
}
```

### Standard Error Codes
| HTTP Status | Code | Cause |
| :--- | :--- | :--- |
| `400 Bad Request` | `validation_error` | Missing required payload, invalid parameters, or malformed path. |
| `403 Forbidden` | `forbidden` | Execution attempted on untrusted project without explicit trust flag. |
| `404 Not Found` | `not_found` | Requested project, investigation, or patch does not exist. |
| `409 Conflict` | `conflict` | Another exclusive engine action is currently running. |
| `503 Service Unavailable` | `ai_unavailable` | External AI provider or model endpoint is unreachable. |
| `500 Internal Error` | `internal_error` | Unexpected runtime engine exception. |
