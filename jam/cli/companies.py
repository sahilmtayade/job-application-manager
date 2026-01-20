"""CLI commands for company management"""

from typing import Optional

import typer
from rich.console import Console
from rich.prompt import Confirm
from rich.table import Table

from jam.core.services.company_service import CompanyService

console = Console()
app = typer.Typer()


@app.command("list")
def list_companies(
    search: Optional[str] = typer.Option(None, "--search", "-s", help="Search by name"),
    all: bool = typer.Option(False, "--all", "-a", help="Include soft-deleted applications in counts"),
):
    """List all companies"""
    service = CompanyService()

    if search:
        companies = service.search(search)
    else:
        companies = service.list()

    if not companies:
        console.print("[dim]No companies found[/dim]")
        return

    table = Table(title="Companies")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Name", style="bold")
    table.add_column("Applications", justify="right")
    table.add_column("Aliases", style="dim")

    for company in companies:
        count = service.get_application_count(company.id, include_deleted=all)
        aliases = service.get_aliases(company.id)
        alias_str = ", ".join(a.alias for a in aliases) if aliases else ""

        table.add_row(
            str(company.id),
            company.name,
            str(count),
            alias_str,
        )

    console.print(table)


@app.command("merge")
def merge(
    from_id: int = typer.Argument(..., help="Source company ID (will be deleted)"),
    to_id: int = typer.Argument(..., help="Target company ID (will receive applications)"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Merge one company into another"""
    service = CompanyService()

    from_company = service.get(from_id)
    to_company = service.get(to_id)

    if not from_company:
        console.print(f"[red]Source company #{from_id} not found[/red]")
        raise typer.Exit(1)

    if not to_company:
        console.print(f"[red]Target company #{to_id} not found[/red]")
        raise typer.Exit(1)

    from_count = service.get_application_count(from_id)
    to_count = service.get_application_count(to_id)

    console.print(f"\n[bold]Merge Companies[/bold]")
    console.print(f"  From: {from_company.name} ({from_count} applications)")
    console.print(f"  To:   {to_company.name} ({to_count} applications)")
    console.print(f"\nThis will:")
    console.print(f"  • Move all {from_count} applications to \"{to_company.name}\"")
    console.print(f"  • Add \"{from_company.name}\" as an alias")
    console.print(f"  • Delete the company \"{from_company.name}\"")

    if not force:
        if not Confirm.ask("\nProceed?", default=False):
            raise typer.Abort()

    if service.merge(from_id, to_id):
        console.print(f"\n[green]✓ Companies merged successfully[/green]")
    else:
        console.print(f"\n[red]Failed to merge companies[/red]")


@app.command("alias")
def add_alias(
    company_id: int = typer.Argument(..., help="Company ID"),
    alias: str = typer.Argument(..., help="Alias to add"),
):
    """Add an alias for a company"""
    service = CompanyService()

    company = service.get(company_id)
    if not company:
        console.print(f"[red]Company #{company_id} not found[/red]")
        raise typer.Exit(1)

    result = service.add_alias(company_id, alias)

    if result:
        console.print(f"[green]✓ Added alias \"{alias}\" for {company.name}[/green]")
    else:
        console.print(f"[yellow]Alias \"{alias}\" may already exist[/yellow]")


@app.command("show")
def show_company(
    company_id: int = typer.Argument(..., help="Company ID"),
):
    """Show company details"""
    service = CompanyService()

    company = service.get(company_id)
    if not company:
        console.print(f"[red]Company #{company_id} not found[/red]")
        raise typer.Exit(1)

    count = service.get_application_count(company_id)
    aliases = service.get_aliases(company_id)

    console.print(f"\n[bold]{company.name}[/bold] (ID: {company.id})")
    console.print(f"  Applications: {count}")
    console.print(f"  Created: {company.created_at}")

    if aliases:
        console.print(f"\n  [bold]Aliases:[/bold]")
        for alias in aliases:
            console.print(f"    • {alias.alias}")


@app.command("delete")
def delete_company(
    company_id: int = typer.Argument(..., help="Company ID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a company (only if no applications exist)"""
    service = CompanyService()

    company = service.get(company_id)
    if not company:
        console.print(f"[red]Company #{company_id} not found[/red]")
        raise typer.Exit(1)

    # Check for applications
    app_count = service.get_application_count(company_id, include_deleted=True)
    if app_count > 0:
        console.print(f"[red]✗ Cannot delete {company.name}[/red]")
        console.print(f"  {app_count} application(s) exist (including soft-deleted)")
        console.print(f"  Delete or hard-delete all applications first")
        raise typer.Exit(1)

    # Confirm deletion
    if not force:
        console.print(f"[yellow]Delete company: {company.name}?[/yellow]")
        if not Confirm.ask("Continue?", default=False):
            raise typer.Abort()

    success, message = service.delete(company_id)
    if success:
        console.print(f"[green]✓ {message}[/green]")
    else:
        console.print(f"[red]✗ {message}[/red]")
        raise typer.Exit(1)

