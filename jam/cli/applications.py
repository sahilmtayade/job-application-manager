"""CLI commands for application management"""

from datetime import date
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table

from jam.core.enums import ApplicationStatus, WorkLocation
from jam.core.models import ApplicationCreate, ApplicationUpdate
from jam.core.services.application_service import ApplicationService
from jam.core.services.config_service import ConfigService

console = Console()
app = typer.Typer()


def format_status(status: ApplicationStatus) -> str:
    """Format status with color"""
    colors = {
        ApplicationStatus.APPLIED: "blue",
        ApplicationStatus.SCREENING: "cyan",
        ApplicationStatus.INTERVIEWING: "yellow",
        ApplicationStatus.OFFER: "green",
        ApplicationStatus.ACCEPTED: "bold green",
        ApplicationStatus.REJECTED: "red",
        ApplicationStatus.WITHDRAWN: "dim",
        ApplicationStatus.GHOSTED: "dim red",
    }
    color = colors.get(status, "white")
    return f"[{color}]{status.value}[/{color}]"


@app.command("add")
def add(
    company: Optional[str] = typer.Option(None, "--company", "-c", help="Company name"),
    position: Optional[str] = typer.Option(None, "--position", "-p", help="Position title"),
    applied_at: Optional[str] = typer.Option(None, "--date", "-d", help="Application date (YYYY-MM-DD)"),
    source: Optional[str] = typer.Option(None, "--source", "-s", help="Source (LinkedIn, Indeed, etc.)"),
    url: Optional[str] = typer.Option(None, "--url", "-u", help="Job posting URL"),
    notes: Optional[str] = typer.Option(None, "--notes", "-n", help="Notes"),
    work_location: Optional[str] = typer.Option(None, "--work-location", "-w", help="Work location (remote/onsite/hybrid)"),
    status: Optional[str] = typer.Option(None, "--status", help="Initial status"),
):
    """Add a new job application"""
    service = ApplicationService()
    config_service = ConfigService()

    # Apply config defaults
    if not source:
        default_source = config_service.get("default_source")
        if default_source:
            source = default_source
            console.print(f"[dim]Using default source: {source}[/dim]")

    if not work_location:
        default_work_location = config_service.get("default_work_location")
        if default_work_location:
            try:
                app_work_location = WorkLocation(default_work_location.lower())
                work_location = default_work_location
                console.print(f"[dim]Using default work location: {work_location}[/dim]")
            except ValueError:
                pass  # Invalid default, ignore

    # Interactive prompts for required fields
    if not company:
        company = Prompt.ask("Company name")

    if not position:
        position = Prompt.ask("Position")

    # Check for similar companies
    similar = service.find_similar_companies(company)
    selected_company_id = None

    if similar:
        console.print("\n[yellow]Similar companies found:[/yellow]")
        for i, match in enumerate(similar, 1):
            comp = match["company"]
            count = match["application_count"]
            console.print(f"  {i}. {comp.name} ({count} previous application{'s' if count != 1 else ''})")

        console.print(f"  {len(similar) + 1}. Create new company: \"{company}\"")

        choice = Prompt.ask(
            "\nSelect company",
            default="1" if similar else str(len(similar) + 1),
        )

        try:
            choice_idx = int(choice) - 1
            if 0 <= choice_idx < len(similar):
                selected_company_id = similar[choice_idx]["company"].id
                console.print(f"[dim]Using existing company: {similar[choice_idx]['company'].name}[/dim]")
        except ValueError:
            pass

    # Parse date
    if applied_at:
        try:
            app_date = date.fromisoformat(applied_at)
        except ValueError:
            console.print(f"[red]Invalid date format: {applied_at}. Using today.[/red]")
            app_date = date.today()
    else:
        app_date = date.today()

    # Parse status
    app_status = ApplicationStatus.APPLIED
    if status:
        try:
            app_status = ApplicationStatus(status.lower())
        except ValueError:
            console.print(f"[red]Invalid status: {status}. Using 'applied'.[/red]")

    # Parse work location
    app_work_location = None
    if work_location:
        try:
            app_work_location = WorkLocation(work_location.lower())
        except ValueError:
            console.print(f"[red]Invalid work location: {work_location}. Valid options: remote, onsite, hybrid.[/red]")

    # Check for previous applications to this company
    if selected_company_id:
        previous = service.find_previous_applications(selected_company_id, position)
        if previous:
            console.print(f"\n[yellow]⚠ You have {len(previous)} previous application(s) to this company:[/yellow]")
            for prev in previous[:3]:  # Show up to 3
                status_val = prev.current_status.value if prev.current_status else "unknown"
                console.print(f"  • {prev.position} - {status_val} ({prev.applied_at})")

            if not Confirm.ask("\nContinue with new application?", default=True):
                raise typer.Abort()

    # Create application
    data = ApplicationCreate(
        company_name=company,
        position=position,
        applied_at=app_date,
        source=source,
        url=url,
        notes=notes,
        work_location=app_work_location,
        initial_status=app_status,
    )

    application = service.create(data, selected_company_id=selected_company_id)

    console.print(f"\n[green]✓ Application #{application.id} created[/green]")
    console.print(f"  Company: {company}")
    console.print(f"  Position: {position}")
    if application.current_status:
        console.print(f"  Status: {format_status(application.current_status)}")
    console.print(f"  Date: {app_date}")
    if application.work_location:
        console.print(f"  Location: {application.work_location.value}")


@app.command("list")
def list_applications(
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications"),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status (comma-separated)"),
    company: Optional[str] = typer.Option(None, "--company", "-c", help="Filter by company name"),
    since: Optional[str] = typer.Option(None, "--since", help="Filter by date (YYYY-MM-DD or 30d, 2w)"),
    limit: Optional[int] = typer.Option(None, "--limit", "-n", help="Limit number of results"),
):
    """List job applications"""
    service = ApplicationService()
    from jam.core.services.stats_service import StatsService
    stats_service = StatsService()

    # Parse status filter
    status_filter = None
    if status:
        try:
            status_filter = [ApplicationStatus(s.strip().lower()) for s in status.split(",")]
        except ValueError as e:
            console.print(f"[red]Invalid status: {e}[/red]")
            raise typer.Exit(1)

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

    applications = service.list(
        include_deleted=all,
        status=status_filter,
        company_id=company_id,
        since=since_date,
        limit=limit,
    )

    if not applications:
        console.print("[dim]No applications found[/dim]")
        return

    table = Table(title="Job Applications")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Company", style="bold")
    table.add_column("Position")
    table.add_column("Status")
    table.add_column("Applied", style="dim")
    table.add_column("Location", style="dim")
    table.add_column("Source", style="dim")

    for app in applications:
        deleted_marker = " [dim](deleted)[/dim]" if app.is_deleted else ""
        table.add_row(
            str(app.id),
            (app.company_name or app.company_name_raw) + deleted_marker,
            app.position,
            format_status(app.current_status) if app.current_status else "unknown",
            str(app.applied_at),
            app.work_location.value if app.work_location else "",
            app.source or "",
        )

    console.print(table)
    console.print(f"\n[dim]Total: {len(applications)} application(s)[/dim]")


@app.command("show")
def show(
    app_id: int = typer.Argument(..., help="Application ID"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted"),
):
    """Show details of an application"""
    service = ApplicationService()

    application = service.get(app_id, include_deleted=all)

    if not application:
        console.print(f"[red]Application #{app_id} not found[/red]")
        raise typer.Exit(1)

    # Build details panel
    details = []
    details.append(f"[bold]ID:[/bold] {application.id}")
    details.append(f"[bold]Company:[/bold] {application.company_name or application.company_name_raw}")
    if application.company_name and application.company_name != application.company_name_raw:
        details.append(f"[dim]  (entered as: {application.company_name_raw})[/dim]")
    details.append(f"[bold]Position:[/bold] {application.position}")
    if application.current_status:
        details.append(f"[bold]Status:[/bold] {format_status(application.current_status)}")
    details.append(f"[bold]Applied:[/bold] {application.applied_at}")

    if application.work_location:
        details.append(f"[bold]Location:[/bold] {application.work_location.value}")
    if application.source:
        details.append(f"[bold]Source:[/bold] {application.source}")
    if application.url:
        details.append(f"[bold]URL:[/bold] {application.url}")
    if application.notes:
        details.append(f"[bold]Notes:[/bold] {application.notes}")

    if application.is_deleted:
        details.append(f"\n[red]DELETED[/red] at {application.deleted_at}")

    details.append(f"\n[dim]Created: {application.created_at}[/dim]")
    details.append(f"[dim]Updated: {application.updated_at}[/dim]")

    console.print(Panel("\n".join(details), title=f"Application #{app_id}"))

    # Show status history
    events = service.get_events(app_id)
    if events:
        console.print("\n[bold]Status History:[/bold]")
        for event in events:
            if event.from_status:
                console.print(
                    f"  {event.timestamp.strftime('%Y-%m-%d %H:%M')} - "
                    f"{event.from_status.value} → {event.to_status.value}"
                )
            else:
                console.print(
                    f"  {event.timestamp.strftime('%Y-%m-%d %H:%M')} - Created as {event.to_status.value}"
                )


@app.command("update")
def update(
    app_id: int = typer.Argument(..., help="Application ID"),
    position: Optional[str] = typer.Option(None, "--position", "-p", help="New position title"),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="New status"),
    source: Optional[str] = typer.Option(None, "--source", help="New source"),
    url: Optional[str] = typer.Option(None, "--url", "-u", help="New URL"),
    notes: Optional[str] = typer.Option(None, "--notes", "-n", help="New notes"),
    work_location: Optional[str] = typer.Option(None, "--work-location", "-w", help="Work location (remote/onsite/hybrid)"),
):
    """Update an application"""
    service = ApplicationService()

    # Verify application exists
    existing = service.get(app_id)
    if not existing:
        console.print(f"[red]Application #{app_id} not found[/red]")
        raise typer.Exit(1)

    # Parse status
    new_status = None
    if status:
        try:
            new_status = ApplicationStatus(status.lower())
        except ValueError:
            console.print(f"[red]Invalid status: {status}[/red]")
            console.print(f"Valid statuses: {', '.join(s.value for s in ApplicationStatus)}")
            raise typer.Exit(1)

    # Parse work location
    new_work_location = None
    if work_location:
        try:
            new_work_location = WorkLocation(work_location.lower())
        except ValueError:
            console.print(f"[red]Invalid work location: {work_location}[/red]")
            console.print(f"Valid options: {', '.join(w.value for w in WorkLocation)}")
            raise typer.Exit(1)

    # Check if any updates provided
    if not any([position, new_status, source, url, notes, new_work_location]):
        console.print("[yellow]No updates provided. Use --help to see options.[/yellow]")
        raise typer.Exit(1)

    # Handle status update separately (uses event system now)
    if new_status:
        from jam.core.models import StatusChange
        try:
            status_change = StatusChange(new_status=new_status)
            updated = service.change_status(app_id, status_change)
            console.print(f"[green]✓ Application #{app_id} status updated[/green]")
            if existing.current_status:
                console.print(f"  Status: {format_status(existing.current_status)} → {format_status(new_status)}")
        except ValueError as e:
            console.print(f"[red]Failed to update status: {e}[/red]")
            # Continue with other updates if any

    # Handle other updates
    if any([position, source, url, notes, new_work_location]):
        data = ApplicationUpdate(
            position=position,
            source=source,
            url=url,
            notes=notes,
            work_location=new_work_location,
        )

        updated = service.update(app_id, data)

        if updated:
            console.print(f"[green]✓ Application #{app_id} metadata updated[/green]")
        else:
            console.print(f"[red]Failed to update application #{app_id}[/red]")


@app.command("delete")
def delete(
    app_id: int = typer.Argument(..., help="Application ID"),
    hard: bool = typer.Option(False, "--hard", help="Permanently delete (cannot be undone)"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an application (soft delete by default)"""
    service = ApplicationService()

    # Verify application exists
    existing = service.get(app_id, include_deleted=True)
    if not existing:
        console.print(f"[red]Application #{app_id} not found[/red]")
        raise typer.Exit(1)

    if hard:
        if not force:
            console.print(f"[red]⚠ HARD DELETE - This will permanently remove the application![/red]")
            console.print(f"  Company: {existing.company_name or existing.company_name_raw}")
            console.print(f"  Position: {existing.position}")
            if not Confirm.ask("Are you sure?", default=False):
                raise typer.Abort()

        if service.delete(app_id, hard=True):
            console.print(f"[red]Application #{app_id} permanently deleted[/red]")
        else:
            console.print(f"[red]Failed to delete application #{app_id}[/red]")
    else:
        if existing.is_deleted:
            console.print(f"[yellow]Application #{app_id} is already deleted[/yellow]")
            return

        if service.delete(app_id, hard=False):
            console.print(f"[green]✓ Application #{app_id} deleted[/green]")
            console.print("[dim]Use --hard to permanently remove, or restore later[/dim]")
        else:
            console.print(f"[red]Failed to delete application #{app_id}[/red]")


@app.command("restore")
def restore(
    app_id: int = typer.Argument(..., help="Application ID to restore"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Restore a soft-deleted application"""
    service = ApplicationService()

    # Verify application exists and is deleted
    existing = service.get(app_id, include_deleted=True)
    if not existing:
        console.print(f"[red]Application #{app_id} not found[/red]")
        raise typer.Exit(1)

    if not existing.is_deleted:
        console.print(f"[yellow]Application #{app_id} is not deleted[/yellow]")
        return

    if not force:
        console.print(f"Restore application:")
        console.print(f"  Company: {existing.company_name or existing.company_name_raw}")
        console.print(f"  Position: {existing.position}")
        if existing.current_status:
            console.print(f"  Status: {format_status(existing.current_status)}")
        if not Confirm.ask("Restore this application?", default=True):
            raise typer.Abort()

    if service.restore(app_id):
        console.print(f"[green]✓ Application #{app_id} restored[/green]")
    else:
        console.print(f"[red]Failed to restore application #{app_id}[/red]")

