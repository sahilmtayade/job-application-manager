"""CLI commands for backup and restore"""

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.prompt import Confirm
from rich.table import Table

from jam.core.services.backup_service import BackupService

console = Console()
app = typer.Typer(invoke_without_command=True)


@app.callback(invoke_without_command=True)
def backup_callback(
    ctx: typer.Context,
    list_backups: bool = typer.Option(False, "--list", "-l", help="List available backups"),
    restore: Optional[str] = typer.Option(None, "--restore", "-r", help="Restore from backup file"),
):
    """Backup and restore the database"""
    service = BackupService()

    if list_backups:
        backups = service.list_backups()

        if not backups:
            console.print("[dim]No backups found[/dim]")
            return

        table = Table(title="Available Backups")
        table.add_column("Name", style="cyan")
        table.add_column("Size", justify="right")
        table.add_column("Created")

        for backup in backups:
            size_kb = backup["size"] / 1024
            if size_kb < 1024:
                size_str = f"{size_kb:.1f} KB"
            else:
                size_str = f"{size_kb/1024:.1f} MB"

            table.add_row(
                backup["name"],
                size_str,
                backup["created"].strftime("%Y-%m-%d %H:%M:%S"),
            )

        console.print(table)
        return

    if restore:
        backup_path = service.get_backup_by_name(restore)

        if not backup_path:
            console.print(f"[red]Backup not found: {restore}[/red]")
            console.print("[dim]Use --list to see available backups[/dim]")
            raise typer.Exit(1)

        console.print(f"[yellow]⚠ This will replace your current database with:[/yellow]")
        console.print(f"  {backup_path}")
        console.print("[dim]A backup of your current database will be created first.[/dim]")

        if not Confirm.ask("Continue?", default=False):
            raise typer.Abort()

        try:
            service.restore_backup(backup_path)
            console.print(f"[green]✓ Database restored from {backup_path.name}[/green]")
        except Exception as e:
            console.print(f"[red]Failed to restore: {e}[/red]")
            raise typer.Exit(1)
        return

    # Default action: create backup
    if ctx.invoked_subcommand is None:
        try:
            backup_path = service.create_backup()
            console.print(f"[green]✓ Backup created: {backup_path}[/green]")
        except FileNotFoundError:
            console.print("[yellow]No database to backup. Start using JAM first![/yellow]")
        except Exception as e:
            console.print(f"[red]Failed to create backup: {e}[/red]")
            raise typer.Exit(1)


@app.command("create")
def create(
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Custom name for backup"),
):
    """Create a new backup"""
    service = BackupService()

    try:
        backup_path = service.create_backup(custom_name=name)
        console.print(f"[green]✓ Backup created: {backup_path}[/green]")
    except FileNotFoundError:
        console.print("[yellow]No database to backup. Start using JAM first![/yellow]")
    except Exception as e:
        console.print(f"[red]Failed to create backup: {e}[/red]")
        raise typer.Exit(1)


@app.command("delete")
def delete_backup(
    name: str = typer.Argument(..., help="Backup filename to delete"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a backup"""
    service = BackupService()

    backup_path = service.get_backup_by_name(name)

    if not backup_path:
        console.print(f"[red]Backup not found: {name}[/red]")
        raise typer.Exit(1)

    if not force:
        if not Confirm.ask(f"Delete backup {backup_path.name}?", default=False):
            raise typer.Abort()

    if service.delete_backup(backup_path):
        console.print(f"[green]✓ Backup deleted: {backup_path.name}[/green]")
    else:
        console.print(f"[red]Failed to delete backup[/red]")

