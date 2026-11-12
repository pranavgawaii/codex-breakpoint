from typer.testing import CliRunner
from breakpoint.cli import app

runner = CliRunner()


def test_cli_version():
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "breakpoint engine v0.1.0" in result.stdout


def test_cli_projects():
    result = runner.invoke(app, ["projects"])
    assert result.exit_code == 0
    assert "registered projects" in result.stdout


def test_cli_report():
    result = runner.invoke(app, ["report"])
    assert result.exit_code == 0
    assert "investigation" in result.stdout.lower() or "store" in result.stdout.lower()


def test_cli_scan():
    result = runner.invoke(app, ["scan"])
    assert result.exit_code == 0
    assert "static finding" in result.stdout.lower() or "analysis" in result.stdout.lower() or "finding" in result.stdout.lower()


def test_cli_workflow_dry_run():
    result = runner.invoke(app, ["workflow", "--dry-run"])
    assert result.exit_code == 0
    assert "dry run execution plan" in result.stdout.lower()
    assert "static shared-state" in result.stdout.lower()


def test_cli_version_quiet():
    result = runner.invoke(app, ["version", "--quiet"])
    assert result.exit_code == 0
    assert result.stdout.strip() == "0.1.0"


def test_cli_scan_quiet():
    result = runner.invoke(app, ["scan", "-q"])
    assert result.exit_code == 0
    assert result.stdout.strip().isdigit()


def test_cli_report_json():
    import json
    result = runner.invoke(app, ["report", "--json"])
    assert result.exit_code == 0
    data = json.loads(result.stdout)
    assert "investigation" in data
    assert "runs" in data
