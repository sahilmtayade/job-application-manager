"""CLI commands for statistics"""

from datetime import date
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from jam.core.enums import ApplicationStatus
from jam.core.services.stats_service import StatsService

console = Console()
app = typer.Typer(invoke_without_command=True)


@app.callback(invoke_without_command=True)
def stats_callback(
    ctx: typer.Context,
    since: Optional[str] = typer.Option(None, "--since", "-s", help="Time window (30d, 2w, 3m, 1y) or date"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
):
    """Show application statistics summary"""
    if ctx.invoked_subcommand is not None:
        return

    service = StatsService()

    # Parse since
    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    summary = service.get_summary(since=since_date, include_deleted=all)

    # Header
    period_str = f"since {since_date}" if since_date else "all time"
    console.print(f"\n[bold]Application Statistics[/bold] ({period_str})\n")

    # Overview
    console.print(f"  [bold]Total Applications:[/bold] {summary['total']}")
    console.print(f"  [bold]Active Applications:[/bold] {summary['active']}")
    console.print(f"  [bold]Companies Applied To:[/bold] {summary['companies']}")
    console.print(f"  [bold]Response Rate:[/bold] {summary['response_rate']}%")

    # Status breakdown
    if summary["by_status"]:
        console.print(f"\n[bold]By Status:[/bold]")
        for status_val, count in sorted(summary["by_status"].items()):
            try:
                status = ApplicationStatus(status_val)
                color = {
                    ApplicationStatus.APPLIED: "blue",
                    ApplicationStatus.SCREENING: "cyan",
                    ApplicationStatus.INTERVIEWING: "yellow",
                    ApplicationStatus.OFFER: "green",
                    ApplicationStatus.ACCEPTED: "bold green",
                    ApplicationStatus.REJECTED: "red",
                    ApplicationStatus.WITHDRAWN: "dim",
                    ApplicationStatus.GHOSTED: "dim red",
                }.get(status, "white")
                console.print(f"  [{color}]{status_val:15}[/{color}] {count}")
            except ValueError:
                console.print(f"  {status_val:15} {count}")

    # Top companies
    top_companies = service.get_top_companies(limit=5, since=since_date, include_deleted=all)
    if top_companies:
        console.print(f"\n[bold]Most Applied Companies:[/bold]")
        for item in top_companies:
            console.print(f"  {item['company']:30} {item['count']}")

    console.print()


@app.command("trends")
def trends(
    since: Optional[str] = typer.Option(None, "--since", "-s", help="Time window (30d, 2w, 3m, 1y) or date"),
    weekly: bool = typer.Option(False, "--weekly", "-w", help="Group by week"),
    daily: bool = typer.Option(False, "--daily", "-d", help="Group by day (default)"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
):
    """Show application trends over time"""
    service = StatsService()

    # Parse since
    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    group_by = "week" if weekly else "day"

    trends_data = service.get_trends(since=since_date, group_by=group_by, include_deleted=all)

    if not trends_data:
        console.print("[dim]No application data found for the specified period[/dim]")
        return

    # Header
    period_str = f"since {since_date}" if since_date else "all time"
    console.print(f"\n[bold]Application Trends[/bold] ({period_str}, by {group_by})\n")

    # Table
    table = Table()
    table.add_column("Period", style="cyan")
    table.add_column("Total", justify="right")
    table.add_column("Applied", justify="right", style="blue")
    table.add_column("Screening", justify="right", style="cyan")
    table.add_column("Interview", justify="right", style="yellow")
    table.add_column("Other", justify="right", style="dim")

    for item in trends_data:
        by_status = item["by_status"]
        applied = by_status.get("applied", 0)
        screening = by_status.get("screening", 0)
        interviewing = by_status.get("interviewing", 0)
        other = item["count"] - applied - screening - interviewing

        table.add_row(
            str(item["period"]),
            str(item["count"]),
            str(applied) if applied else "-",
            str(screening) if screening else "-",
            str(interviewing) if interviewing else "-",
            str(other) if other else "-",
        )

    console.print(table)

    # Summary
    total = sum(item["count"] for item in trends_data)
    avg = total / len(trends_data) if trends_data else 0
    console.print(f"\n[dim]Total: {total} | Average per {group_by}: {avg:.1f}[/dim]")


@app.command("transitions")
def transitions(
    since: Optional[str] = typer.Option(None, "--since", "-s", help="Time window"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
):
    """Show average time between status transitions"""
    service = StatsService()

    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    transitions_data = service.get_status_transitions(since=since_date, include_deleted=all)

    if not transitions_data:
        console.print("[dim]No transition data found[/dim]")
        return

    console.print(f"\n[bold]Average Time Between Transitions[/bold]\n")

    for transition, days in sorted(transitions_data.items()):
        console.print(f"  {transition:35} {days:.1f} days")


@app.command("funnel")
def funnel(
    since: Optional[str] = typer.Option(None, "--since", "-s", help="Time window"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
):
    """Show application funnel with conversion rates"""
    service = StatsService()

    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    funnel_data = service.get_funnel(since=since_date, include_deleted=all)

    if not funnel_data:
        console.print("[dim]No funnel data found[/dim]")
        return

    period_str = f"since {since_date}" if since_date else "all time"
    console.print(f"\n[bold]Application Funnel[/bold] ({period_str})\n")

    table = Table(show_header=True)
    table.add_column("Stage", style="cyan")
    table.add_column("Count", justify="right")
    table.add_column("Conversion Rate", justify="right", style="green")

    for stage, data in funnel_data.items():
        table.add_row(
            stage.capitalize(),
            str(data["count"]),
            f"{data['rate']:.1f}%"
        )

    console.print(table)


@app.command("sources")
def sources(
    since: Optional[str] = typer.Option(None, "--since", "-s", help="Time window"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
):
    """Show success rate by application source"""
    service = StatsService()

    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    sources_data = service.get_success_rate_by_source(since=since_date, include_deleted=all)

    if not sources_data:
        console.print("[dim]No source data found[/dim]")
        return

    period_str = f"since {since_date}" if since_date else "all time"
    console.print(f"\n[bold]Success Rate by Source[/bold] ({period_str})\n")

    table = Table(show_header=True)
    table.add_column("Source", style="cyan")
    table.add_column("Total", justify="right")
    table.add_column("Success", justify="right", style="green")
    table.add_column("Success Rate", justify="right", style="green")

    for data in sources_data:
        table.add_row(
            data["source"],
            str(data["total"]),
            str(data["success_count"]),
            f"{data['success_rate']:.1f}%"
        )

    console.print(table)

    # Also show source breakdown
    console.print(f"\n[bold]Application Volume by Source[/bold]\n")
    breakdown = service.get_source_breakdown(since=since_date, include_deleted=all)

    for source, data in sorted(breakdown.items(), key=lambda x: x[1]["count"], reverse=True):
        console.print(f"  {source:20} {data['count']:>4} ({data['percentage']:>5.1f}%)")


@app.command("location")
def location(
    since: Optional[str] = typer.Option(None, "--since", "-s", help="Time window"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
):
    """Show breakdown by work location preference"""
    service = StatsService()

    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    location_data = service.get_work_location_breakdown(since=since_date, include_deleted=all)

    if not location_data:
        console.print("[dim]No location data found[/dim]")
        return

    period_str = f"since {since_date}" if since_date else "all time"
    console.print(f"\n[bold]Applications by Work Location[/bold] ({period_str})\n")

    table = Table(show_header=True)
    table.add_column("Location", style="cyan")
    table.add_column("Count", justify="right")
    table.add_column("Percentage", justify="right", style="green")

    for location, data in sorted(location_data.items(), key=lambda x: x[1]["count"], reverse=True):
        table.add_row(
            location.capitalize() if location != "(not set)" else location,
            str(data["count"]),
            f"{data['percentage']:.1f}%"
        )

    console.print(table)

