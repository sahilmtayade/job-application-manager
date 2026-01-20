"""CLI commands for data export"""

import csv
from datetime import date
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console

from jam.core.enums import ApplicationStatus
from jam.core.services.application_service import ApplicationService
from jam.core.services.stats_service import StatsService

console = Console()


def export(
    output: Path = typer.Argument(..., help="Output CSV file path"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status (comma-separated)"),
    company: Optional[str] = typer.Option(None, "--company", "-c", help="Filter by company name"),
    since: Optional[str] = typer.Option(None, "--since", help="Filter by date (YYYY-MM-DD or 30d, 2w)"),
    active: bool = typer.Option(False, "--active", help="Only active (non-terminal) applications"),
):
    """Export applications to CSV"""
    app_service = ApplicationService()
    stats_service = StatsService()

    # Parse status filter
    status_filter = None
    if status:
        try:
            status_filter = [ApplicationStatus(s.strip().lower()) for s in status.split(",")]
        except ValueError as e:
            console.print(f"[red]Invalid status: {e}[/red]")
            raise typer.Exit(1)

    # Active filter overrides status
    if active:
        status_filter = ApplicationStatus.active_statuses()

    # Parse since filter
    since_date = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            try:
                since_date = stats_service.parse_time_window(since)
            except ValueError as e:
                console.print(f"[red]{e}[/red]")
                raise typer.Exit(1)

    # Get company ID if filtering by company
    company_id = None
    if company:
        from jam.core.services.company_service import CompanyService
        company_service = CompanyService()
        companies = company_service.search(company)
        if companies:
            company_id = companies[0].id
        else:
            console.print(f"[yellow]No company found matching '{company}'[/yellow]")

    # Get applications
    applications = app_service.list(
        include_deleted=all,
        status=status_filter,
        company_id=company_id,
        since=since_date,
    )

    if not applications:
        console.print("[yellow]No applications match the filters[/yellow]")
        raise typer.Exit(1)

    # Write CSV
    fieldnames = [
        "id",
        "company",
        "company_raw",
        "position",
        "status",
        "applied_at",
        "source",
        "url",
        "notes",
        "is_deleted",
        "deleted_at",
        "created_at",
        "updated_at",
    ]

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for app in applications:
            writer.writerow({
                "id": app.id,
                "company": app.company_name or app.company_name_raw,
                "company_raw": app.company_name_raw,
                "position": app.position,
                "status": app.current_status.value if app.current_status else "unknown",
                "applied_at": app.applied_at,
                "source": app.source or "",
                "url": app.url or "",
                "notes": app.notes or "",
                "is_deleted": app.is_deleted,
                "deleted_at": app.deleted_at or "",
                "created_at": app.created_at,
                "updated_at": app.updated_at,
            })

    console.print(f"[green]✓ Exported {len(applications)} applications to {output}[/green]")

