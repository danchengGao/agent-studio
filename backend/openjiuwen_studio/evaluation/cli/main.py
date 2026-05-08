"""
agenteval — Command-line interface for the OpenJiuwen Evaluation System.

Usage:
    agenteval configure --api-url http://localhost:8000 --token <jwt> --space-id <id>
    agenteval suites
    agenteval run   --suite-id <id> [--workflow-id <id>] [--trials 3] [--wait]
    agenteval results --run-id <id>
    agenteval export  --run-id <id> --format json

Install entry-point: pip install -e backend/  (adds 'agenteval' to PATH)
"""

from __future__ import annotations

import csv
import dataclasses
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

import click
import requests

# ── Config helpers ─────────────────────────────────────────────────────────────

CONFIG_PATH = Path.home() / ".agenteval" / "config.json"


def _load_cfg() -> Dict[str, Any]:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def _save_cfg(cfg: Dict[str, Any]) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


def _require_cfg(ctx: click.Context) -> Dict[str, Any]:
    cfg = _load_cfg()
    missing = [k for k in ("api_url", "token", "space_id") if not cfg.get(k)]
    if missing:
        ctx.fail(
            f"Missing config keys: {missing}. Run `agenteval configure` first."
        )
    return cfg


# ── HTTP client ────────────────────────────────────────────────────────────────

class ApiClient:
    def __init__(self, api_url: str, token: str, space_id: str):
        self.base = api_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        self.space_id = space_id

    def get(self, path: str, params: Optional[Dict] = None) -> Any:
        r = requests.get(f"{self.base}{path}", headers=self.headers, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: Optional[Dict] = None) -> Any:
        r = requests.post(f"{self.base}{path}", headers=self.headers, json=body or {}, timeout=30)
        r.raise_for_status()
        return r.json()

    def delete(self, path: str) -> Any:
        r = requests.delete(f"{self.base}{path}", headers=self.headers, timeout=30)
        r.raise_for_status()
        return r.json()


def _client(ctx: click.Context) -> ApiClient:
    cfg = _require_cfg(ctx)
    return ApiClient(cfg["api_url"], cfg["token"], cfg["space_id"])


# ── Formatting helpers ─────────────────────────────────────────────────────────

def _pct(v: Optional[float]) -> str:
    if v is None:
        return "—"
    return f"{v * 100:.1f}%"


def _ms(v: Optional[float]) -> str:
    if v is None:
        return "—"
    return f"{v:.0f} ms"


def _status_label(s: str) -> str:
    return {"0": "pending", "1": "running", "2": "completed", "3": "failed"}.get(str(s), s)


# ── CLI root ───────────────────────────────────────────────────────────────────

@click.group()
@click.version_option("0.1.0", prog_name="agenteval")
def cli():
    """agenteval — manage and run AI evaluations from the terminal."""


# ── configure ─────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--api-url", default="http://localhost:8000", show_default=True, help="Base URL of the "
                                                                                    "Studio API.")
@click.option("--token", required=True, help="JWT bearer token (copy from browser DevTools → "
                                             "Application → localStorage).")
@click.option("--space-id", required=True, help="Space / workspace ID.")
def configure(api_url: str, token: str, space_id: str):
    """Save connection settings to ~/.agenteval/config.json."""
    cfg = _load_cfg()
    cfg.update({"api_url": api_url, "token": token, "space_id": space_id})
    _save_cfg(cfg)
    click.secho(f"Config saved to {CONFIG_PATH}", fg="green")


# ── suites ────────────────────────────────────────────────────────────────────

@cli.command()
@click.pass_context
def suites(ctx: click.Context):
    """List all evaluation suites in the configured space."""
    client = _client(ctx)
    data = client.get("/api/v1/evaluation/list", {"space_id": client.space_id, "page": 1, "size": 100})
    items = data.get("data", {}).get("list", [])
    if not items:
        click.echo("No evaluation suites found.")
        return
    click.secho(f"\n{'ID':<36}  {'Suite Name':<35}  Tasks", bold=True)
    click.echo("─" * 80)
    for s in items:
        task_count = len(s.get("tasks", []))
        click.echo(f"{s['evaluation_id']:<36}  {s['suite_name'][:35]:<35}  {task_count}")
    click.echo()


# ── runs ──────────────────────────────────────────────────────────────────────

@cli.command("runs")
@click.option("--suite-id", required=True, help="Evaluation suite ID.")
@click.pass_context
def list_runs(ctx: click.Context, suite_id: str):
    """List runs for a suite."""
    client = _client(ctx)
    data = client.get("/api/v1/evaluation/run/list", {
        "space_id": client.space_id,
        "evaluation_id": suite_id,
        "page": 1, "size": 50,
    })
    items = data.get("data", {}).get("list", [])
    if not items:
        click.echo("No runs found for this suite.")
        return
    click.secho(f"\n{'Run ID':<36}  {'Status':<12}  {'Success':<10}  {'Score':<8}  {'Latency'}", bold=True)
    click.echo("─" * 90)
    for r in items:
        m = r.get("metrics") or {}
        click.echo(
            f"{r['run_id']:<36}  {_status_label(r['status']):<12}  "
            f"{_pct(m.get('success_rate')):<10}  {_pct(m.get('avg_score')):<8}  "
            f"{_ms(m.get('avg_latency_ms'))}"
        )
    click.echo()


# ── run ───────────────────────────────────────────────────────────────────────

@dataclasses.dataclass
class _RunArgs:
    suite_id: str
    workflow_id: Optional[str]
    agent_id: Optional[str]
    parallel: bool
    wait: bool
    fail_threshold: Optional[float]


def _do_run(ctx: click.Context, args: _RunArgs) -> None:
    """Execute run logic."""
    if not args.workflow_id and not args.agent_id:
        ctx.fail("Provide --workflow-id or --agent-id.")

    client = _client(ctx)
    body: Dict[str, Any] = {
        "evaluation_id": args.suite_id,
        "space_id": client.space_id,
        "parallel": args.parallel,
    }
    if args.workflow_id:
        body["workflow_id"] = args.workflow_id
    if args.agent_id:
        body["agent_id"] = args.agent_id

    resp = client.post("/api/v1/evaluation/run/start", body)
    run_id: str = resp.get("data", {}).get("run_id", "")
    click.secho(f"Run started: {run_id}", fg="cyan")

    if not args.wait and args.fail_threshold is None:
        return

    # Poll until complete
    click.echo("Waiting for completion", nl=False)
    while True:
        time.sleep(4)
        status_resp = client.get(f"/api/v1/evaluation/run/{run_id}", {"space_id": client.space_id})
        run_data = status_resp.get("data", {})
        status = str(run_data.get("status", ""))
        click.echo(".", nl=False)
        if status in ("2", "3"):
            break

    click.echo()
    m = run_data.get("metrics") or {}
    success_rate = m.get("success_rate")
    click.secho(
        f"\nStatus: {_status_label(status)}  |  "
        f"Success: {_pct(success_rate)}  |  "
        f"Score: {_pct(m.get('avg_score'))}  |  "
        f"Latency: {_ms(m.get('avg_latency_ms'))}",
        fg="green" if status == "2" else "red",
    )

    # Regression alerts
    alerts = m.get("alerts", [])
    if alerts:
        click.secho("\n⚠️  Regression alerts:", fg="yellow")
        for a in alerts:
            click.echo(f"  • {a.get('message', a)}")

    if args.fail_threshold is not None and (success_rate is None or success_rate < args.fail_threshold):
        click.secho(
            f"\n✗ FAILED: success rate {_pct(success_rate)} < threshold {_pct(args.fail_threshold)}",
            fg="red", err=True,
        )
        ctx.exit(1)


@cli.command()
@click.option("--suite-id", required=True, help="Evaluation suite ID.")
@click.option("--workflow-id", default=None, help="Workflow ID to evaluate.")
@click.option("--agent-id", default=None, help="Agent ID to evaluate.")
@click.option("--parallel/--sequential", default=False, show_default=True, help="Run tasks in parallel.")
@click.option("--wait/--no-wait", default=False, show_default=True, help="Block until run completes.")
@click.option("--fail-threshold", default=None, type=float, help="Exit code 1 if success_rate < "
                                                                 "threshold (0-1).")
@click.pass_context
def run(ctx: click.Context, **kwargs):
    """Start an evaluation run."""
    _do_run(ctx, _RunArgs(
        suite_id=kwargs["suite_id"],
        workflow_id=kwargs.get("workflow_id"),
        agent_id=kwargs.get("agent_id"),
        parallel=kwargs.get("parallel", False),
        wait=kwargs.get("wait", False),
        fail_threshold=kwargs.get("fail_threshold"),
    ))


# ── results ───────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--run-id", required=True, help="Run ID.")
@click.option("--verbose", "-v", is_flag=True, help="Show per-task breakdown.")
@click.pass_context
def results(ctx: click.Context, run_id: str, verbose: bool):
    """Show results for a completed run."""
    client = _client(ctx)
    resp = client.get(f"/api/v1/evaluation/run/{run_id}", {"space_id": client.space_id})
    run_data = resp.get("data", {})
    m = run_data.get("metrics") or {}

    click.secho(f"\nRun: {run_id}", bold=True)
    click.echo(f"Status : {_status_label(run_data.get('status', ''))}")
    click.echo(f"Success: {_pct(m.get('success_rate'))}")
    click.echo(f"Score  : {_pct(m.get('avg_score'))}")
    click.echo(f"Latency: {_ms(m.get('avg_latency_ms'))}")

    if verbose:
        task_results = run_data.get("task_results", [])
        if task_results:
            click.secho(f"\n{'Task':<30}  {'Pass':<6}  {'Score':<8}  {'Latency'}", bold=True)
            click.echo("─" * 65)
            for t in task_results:
                passed = "✓" if t.get("passed") else "✗"
                click.echo(
                    f"{str(t.get('task_id', ''))[:30]:<30}  {passed:<6}  "
                    f"{_pct(t.get('score')):<8}  {_ms(t.get('latency_ms'))}"
                )

    # Custom metrics
    custom = m.get("custom_metrics", {})
    if custom:
        click.secho("\nCustom metrics:", bold=True)
        for name, value in custom.items():
            click.echo(f"  {name}: {value:.4f}" if isinstance(value, float) else f"  {name}: {value}")

    click.echo()


# ── export ────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--run-id", required=True, help="Run ID.")
@click.option("--format", "fmt", type=click.Choice(["json", "csv"]), default="json", show_default=True)
@click.option("--output", "-o", default=None, help="Output file path (defaults to stdout).")
@click.pass_context
def export(ctx: click.Context, run_id: str, fmt: str, output: Optional[str]):
    """Export run results as JSON or CSV."""
    client = _client(ctx)
    resp = client.get(f"/api/v1/evaluation/run/{run_id}", {"space_id": client.space_id})
    run_data = resp.get("data", {})

    if fmt == "json":
        content = json.dumps(run_data, indent=2, default=str)
    else:
        # CSV: one row per task_result
        rows = run_data.get("task_results", [])
        import io
        buf = io.StringIO()
        if rows:
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        content = buf.getvalue()

    if output:
        Path(output).write_text(content, encoding="utf-8")
        click.secho(f"Exported to {output}", fg="green")
    else:
        click.echo(content)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli()
