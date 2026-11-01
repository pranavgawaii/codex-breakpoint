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
