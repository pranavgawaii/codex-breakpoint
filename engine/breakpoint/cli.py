"""Breakpoint CLI — the full engine with no browser required.

Commands map one-to-one onto the orchestrator actions, so headless use and
the web UI behave identically.
"""

from __future__ import annotations

import sys
from pathlib import Path

import typer

from . import investigations
from .errors import AppError

app = typer.Typer(
    name="breakpoint",
    help="Evidence-first debugging for flaky and order-dependent tests.",
    no_args_is_help=True,
    add_completion=False,
)

run_app = typer.Typer(help="Run investigation actions against a project.")
app.add_typer(run_app, name="run")


def _fail(error: Exception) -> None:
    if isinstance(error, AppError):
        typer.secho(f"error [{error.code}]: {error}", fg=typer.colors.RED, err=True)
    else:
        typer.secho(f"error: {error}", fg=typer.colors.RED, err=True)
    raise SystemExit(1)


def _print_snapshot(snapshot: dict, heading: str) -> None:
    investigation = snapshot["investigation"]
    runs = snapshot["runs"]
    typer.secho(heading, fg=typer.colors.CYAN)
    typer.echo(f"  investigation {investigation['id']} ({investigation['status']})")
    target = investigation.get("target")
    if target:
        typer.echo(f"  target: {target['testFile']}" + (f" :: {target['targetTest']}" if target.get("targetTest") else ""))
        typer.echo(f"  reason: {target['reasoning']}")
    for run in runs:
        marker = "✓" if run["status"] == "passed" else "✖"
        typer.echo(f"  {marker} {run['label']}  [{run['status']}, exit {run['exitCode']}, {run['durationMs']}ms]")
    hypothesis = snapshot["hypotheses"][-1] if snapshot["hypotheses"] else None
    if hypothesis:
        typer.secho(f"  hypothesis ({hypothesis['confidence']}): {hypothesis['description']}", fg=typer.colors.YELLOW)
    verification = snapshot["verifications"][-1] if snapshot["verifications"] else None
    if verification:
        typer.secho(f"  verification: {verification['result']} — {verification['notes']}", fg=typer.colors.GREEN if verification["result"] == "verified" else typer.colors.RED)


@app.command()
def register(
    root: str = typer.Argument(..., help="Absolute path of the project directory."),
    trust: bool = typer.Option(False, "--trust", help="Confirm this directory may execute tests and receive approved patches."),
) -> None:
    """Registers a local project directory."""
    from .projects import register_project_action

    try:
        outcome = register_project_action(root, trust)
    except Exception as error:
        _fail(error)
    project = outcome["project"]
    discovery = outcome["discovery"]
    typer.secho(f"registered {project['name']} ({project['id']})", fg=typer.colors.GREEN)
    typer.echo(f"  root: {project['root']}")
    typer.echo(f"  framework: {discovery['framework']}  trusted: {project['trusted']}")
    typer.echo(f"  test files: {len(discovery['testFiles'])}" + (" (list truncated)" if discovery.get("truncated") else ""))


@app.command("scan")
def scan(project_id: str = typer.Argument(None, help="Project id; defaults to the active investigation's project.")) -> None:
    """Runs the static shared-state analysis only (no execution)."""
    try:
        outcome = investigations.scan_project(project_id)
    except Exception as error:
        _fail(error)
    typer.secho(outcome["summary"], fg=typer.colors.CYAN)


@app.command()
def workflow(
    project_id: str = typer.Option(None, "--project", help="Start on this project instead of the active investigation."),
    test_file: str = typer.Option(None, "--file", help="Restrict triage and the matrix to one test file."),
) -> None:
    """Full pipeline: triage -> target resolution -> matrix -> comparison -> hypothesis."""
    try:
        if project_id:
            investigations.start_investigation(project_id)
        snapshot = investigations.run_controlled_workflow(
            {"testFile": test_file},
            on_line=lambda line: typer.echo(f"    {line}", color=True) if line.strip() else None,
        )
    except Exception as error:
        _fail(error)
    _print_snapshot(snapshot, "controlled workflow complete")


@app.command("patch")
def propose_patch(demo: bool = typer.Option(False, "--demo", help="Act on the bundled trusted sample.")) -> None:
    """Drafts a cleanup patch from the recorded evidence (unapplied)."""
    try:
        snapshot = investigations.propose_patch(demo)
    except Exception as error:
        _fail(error)
    patch = snapshot["patches"][-1]
    typer.secho(f"drafted {patch['id']} ({patch['status']})", fg=typer.colors.CYAN)
    typer.echo(f"  {patch['description']}")
    typer.echo(patch["diff"])


@app.command("approve")
def approve(patch_id: str = typer.Argument(None, help="Patch id; defaults to the latest draft.")) -> None:
    """Applies the patch, reruns the failing probe, records verification."""
    try:
        snapshot = investigations.get_investigation()
        patches = snapshot["patches"]
        target_id = patch_id or (patches[-1]["id"] if patches else None)
        if not target_id:
            typer.secho("No patch exists to approve.", fg=typer.colors.RED, err=True)
            raise SystemExit(1)
        result = investigations.approve_and_verify_patch(target_id, on_line=lambda line: None)
    except SystemExit:
        raise
    except Exception as error:
        _fail(error)
    _print_snapshot(result, "approval complete")


@app.command("revert")
def revert(patch_id: str = typer.Argument(None, help="Patch id; defaults to the latest applied.")) -> None:
    """Restores every file a patch changed to its baseline."""
    try:
        snapshot = investigations.get_investigation()
        patches = snapshot["patches"]
        target_id = patch_id or (patches[-1]["id"] if patches else None)
        if not target_id:
            typer.secho("No patch exists to revert.", fg=typer.colors.RED, err=True)
            raise SystemExit(1)
        result = investigations.revert_patch_action(target_id)
    except SystemExit:
        raise
    except Exception as error:
        _fail(error)
    patch = result["patches"][-1]
    typer.secho(f"reverted {patch['id']} ({patch['status']})", fg=typer.colors.GREEN)


@app.command()
def report() -> None:
    """Prints the active investigation's full audit trail."""
    try:
        snapshot = investigations.get_investigation()
    except Exception as error:
        _fail(error)
    investigation = snapshot["investigation"]
    typer.secho(f"{investigation['title']} — {investigation['id']}", bold=True)
    typer.echo(f"  status: {investigation['status']}")
    typer.echo(f"  goal: {investigation['goal']}")
    analyses = snapshot["analyses"]
    if analyses:
        typer.secho("static findings:", fg=typer.colors.CYAN)
        for finding in analyses[:8]:
            typer.echo(f"  [{finding['kind']}] {finding['statement']}")
    _print_snapshot(snapshot, "record:")
    from .store import data_file_path
    typer.echo(f"  store: {data_file_path()}")


@app.command()
def serve(
    port: int = typer.Option(8000, "--port", help="Port for the API service."),
    host: str = typer.Option("127.0.0.1", "--host", help="Bind address."),
) -> None:
    """Starts the FastAPI service for the web UI."""
    import uvicorn

    typer.secho(f"breakpoint engine → http://{host}:{port}", fg=typer.colors.CYAN)
    uvicorn.run("breakpoint.api:app", host=host, port=port, log_level="info")


def main() -> None:  # pragma: no cover
    try:
        app()
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":  # pragma: no cover
    main()
