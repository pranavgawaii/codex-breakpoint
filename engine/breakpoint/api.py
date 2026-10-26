"""FastAPI application exposing the Breakpoint engine.

Same JSON contract as the original engine so the existing web UI works:
- GET  /api/projects                    -> { projects: [...] }
- POST /api/projects                    -> { project, discovery } (201)
- GET  /api/investigations              -> active snapshot
- POST /api/investigations              -> action dispatch (8 actions)
- GET  /api/events                      -> SSE live run stream
- GET  /api/health                      -> liveness
"""

from __future__ import annotations

import queue

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import events, investigations
from .errors import AiUnavailableError, AppError
from .lock import run_exclusive

app = FastAPI(title="Breakpoint Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_response(error: Exception) -> JSONResponse:
    if isinstance(error, AppError):
        return JSONResponse({"error": str(error), "code": error.code}, status_code=error.status)
    if isinstance(error, AiUnavailableError):
        return JSONResponse({"error": str(error)}, status_code=503)
    return JSONResponse({"error": str(error) or "Unable to run investigation."}, status_code=500)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "engine": "breakpoint-python"}


@app.get("/api/projects")
def list_projects() -> dict:
    return {"projects": investigations.list_projects()}


@app.post("/api/projects")
async def register_project(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "A JSON body with a root path is required."}, status_code=400)
    root = body.get("root") if isinstance(body, dict) else None
    trusted = body.get("trusted") is True if isinstance(body, dict) else False
    if not isinstance(root, str):
        return JSONResponse({"error": "A root path string is required."}, status_code=400)

    def work():
        from .projects import register_project_action
        return register_project_action(root, trusted)

    try:
        outcome = run_exclusive("register-project", work)
        return JSONResponse(outcome, status_code=201)
    except Exception as error:
        return _error_response(error)


@app.get("/api/investigations")
def get_investigation() -> JSONResponse:
    try:
        return JSONResponse(investigations.get_investigation())
    except Exception as error:
        return _error_response(error)


@app.post("/api/investigations")
async def investigation_action(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    action = body.get("action")
    demo_only = body.get("demoOnly") is True
    project_id = body.get("projectId") if isinstance(body.get("projectId"), str) else None
    patch_id = body.get("patchId") if isinstance(body.get("patchId"), str) else None
    test_file = body.get("testFile") if isinstance(body.get("testFile"), str) else None
    target_test = body.get("targetTest") if isinstance(body.get("targetTest"), str) else None

    try:
        if action == "run-demo":
            return JSONResponse(run_exclusive("run-demo", lambda: investigations.run_demo_investigation()))
        if action == "run-workflow":
            filters = {"testFile": test_file, "targetTest": target_test, "demoOnly": demo_only}
            return JSONResponse(run_exclusive("run-workflow", lambda: investigations.run_controlled_workflow(
                filters, on_event=events.publish, on_line=lambda line: events.publish({"type": "run_line", "line": line}),
            )))
        if action == "scan-project":
            return JSONResponse(run_exclusive("scan-project", lambda: investigations.scan_project(project_id, on_event=events.publish)))
        if action == "start-investigation" and project_id:
            return JSONResponse(run_exclusive("start-investigation", lambda: investigations.start_investigation(project_id)))
        if action == "ai-review":
            return JSONResponse(run_exclusive("ai-review", lambda: investigations.run_ai_review(demo_only)))
        if action == "propose-patch":
            return JSONResponse(run_exclusive("propose-patch", lambda: investigations.propose_patch(demo_only)))
        if action == "approve-patch" and patch_id:
            return JSONResponse(run_exclusive("approve-patch", lambda: investigations.approve_and_verify_patch(
                patch_id, demo_only, on_event=events.publish,
                on_line=lambda line: events.publish({"type": "run_line", "line": line}),
            )))
        if action == "revert-patch" and patch_id:
            return JSONResponse(run_exclusive("revert-patch", lambda: investigations.revert_patch_action(patch_id, demo_only)))
        return JSONResponse({"error": "Unsupported investigation action."}, status_code=400)
    except Exception as error:
        return _error_response(error)


@app.get("/api/events")
async def event_stream() -> StreamingResponse:
    """Server-Sent-Events stream of live run output and lifecycle events."""
    stream = events.subscribe()

    def generator():
        try:
            yield ": breakpoint live stream\n\n"
            while True:
                try:
                    event = stream.get(timeout=15)
                except queue.Empty:
                    yield ": keep-alive\n\n"
                    continue
                import json as _json
                yield f"data: {_json.dumps(event)}\n\n"
        finally:
            events.unsubscribe(stream)

    return StreamingResponse(generator(), media_type="text/event-stream")
