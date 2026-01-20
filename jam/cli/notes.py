"""CLI commands for note management"""

from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm
from rich.table import Table

from jam.core.services.note_service import NoteService
from jam.core.services.application_service import ApplicationService

console = Console()
app = typer.Typer()


@app.command("add")
def add(
    app_id: int = typer.Argument(..., help="Application ID"),
    content: Optional[str] = typer.Argument(None, help="Note content"),
):
    """Add a note to an application"""
    service = NoteService()
    app_service = ApplicationService()

    # Verify application exists
    application = app_service.get(app_id)
    if not application:
        console.print(f"[red]Application #{app_id} not found[/red]")
        raise typer.Exit(1)

    # Prompt for content if not provided
    if not content:
        content = typer.prompt("Note content")

    note = service.add(app_id, content)
    if note:
        console.print(f"[green]✓ Note added to application #{app_id}[/green]")
        console.print(f"  ID: {note.id}")
        console.print(f"  Content: {note.content}")
    else:
        console.print(f"[red]Failed to add note[/red]")


@app.command("list")
def list_notes(
    app_id: int = typer.Argument(..., help="Application ID"),
):
    """List all notes for an application"""
    service = NoteService()
    app_service = ApplicationService()

    # Verify application exists
    application = app_service.get(app_id, include_deleted=True)
    if not application:
        console.print(f"[red]Application #{app_id} not found[/red]")
        raise typer.Exit(1)

    notes = service.list_for_application(app_id)

    if not notes:
        console.print(f"[yellow]No notes found for application #{app_id}[/yellow]")
        return

    console.print(f"\n[bold]Notes for: {application.company_name or application.company_name_raw} - {application.position}[/bold]")

    for note in notes:
        panel = Panel(
            note.content,
            title=f"Note #{note.id}",
            subtitle=f"{note.created_at.strftime('%Y-%m-%d %H:%M') if note.created_at else 'Unknown'}",
            border_style="blue"
        )
        console.print(panel)


@app.command("search")
def search(
    query: str = typer.Argument(..., help="Search query"),
):
    """Search notes across all applications"""
    service = NoteService()

    results = service.search(query)

    if not results:
        console.print(f"[yellow]No notes found matching '{query}'[/yellow]")
        return

    console.print(f"\n[bold]Found {len(results)} note(s) matching '{query}':[/bold]\n")

    for note, app in results:
        deleted_marker = " [dim](deleted)[/dim]" if app.is_deleted else ""
        console.print(f"[cyan]App #{app.id}[/cyan]: {app.company_name or app.company_name_raw} - {app.position}{deleted_marker}")
        panel = Panel(
            note.content,
            title=f"Note #{note.id}",
            subtitle=f"{note.created_at.strftime('%Y-%m-%d %H:%M') if note.created_at else 'Unknown'}",
            border_style="blue"
        )
        console.print(panel)
        console.print()


@app.command("delete")
def delete(
    note_id: int = typer.Argument(..., help="Note ID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a note"""
    service = NoteService()

    # Verify note exists
    note = service.get(note_id)
    if not note:
        console.print(f"[red]Note #{note_id} not found[/red]")
        raise typer.Exit(1)

    if not force:
        console.print(f"Delete note #{note_id}:")
        console.print(f"  {note.content[:80]}{'...' if len(note.content) > 80 else ''}")
        if not Confirm.ask("Delete this note?", default=False):
            raise typer.Abort()

    if service.delete(note_id):
        console.print(f"[green]✓ Note #{note_id} deleted[/green]")
    else:
        console.print(f"[red]Failed to delete note #{note_id}[/red]")

