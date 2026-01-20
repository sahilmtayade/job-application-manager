"""CLI commands for configuration management"""

from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from jam.core.services.config_service import ConfigService

console = Console()
app = typer.Typer()


@app.command("set")
def set_config(
    key: str = typer.Argument(..., help="Configuration key"),
    value: str = typer.Argument(..., help="Configuration value"),
):
    """Set a configuration value"""
    service = ConfigService()

    config = service.set(key, value)
    console.print(f"[green]✓ Configuration set:[/green]")
    console.print(f"  {config.key} = {config.value}")


@app.command("get")
def get_config(
    key: str = typer.Argument(..., help="Configuration key"),
):
    """Get a configuration value"""
    service = ConfigService()

    value = service.get(key)
    if value is None:
        console.print(f"[yellow]Configuration key '{key}' not set[/yellow]")
        # Show default if available
        default = service.DEFAULTS.get(key)
        if default:
            console.print(f"[dim]Default value: {default}[/dim]")
    else:
        console.print(f"{key} = {value}")


@app.command("list")
def list_config():
    """List all configuration values"""
    service = ConfigService()

    configs = service.get_all()

    if not configs:
        console.print("[yellow]No configuration values set[/yellow]")
        console.print("\n[bold]Available defaults:[/bold]")
        for key, value in service.DEFAULTS.items():
            console.print(f"  {key} = {value if value else '(not set)'}")
        return

    table = Table(title="Configuration")
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="green")

    for key, value in sorted(configs.items()):
        table.add_row(key, str(value) if value is not None else "[dim]None[/dim]")

    console.print(table)

    # Show available defaults that aren't set
    unset_defaults = {k: v for k, v in service.DEFAULTS.items() if k not in configs}
    if unset_defaults:
        console.print("\n[bold]Available defaults (not set):[/bold]")
        for key, value in unset_defaults.items():
            console.print(f"  {key} = {value if value else '(not set)'}")


@app.command("delete")
def delete_config(
    key: str = typer.Argument(..., help="Configuration key"),
):
    """Delete a configuration value"""
    service = ConfigService()

    if not service.exists(key):
        console.print(f"[yellow]Configuration key '{key}' not found[/yellow]")
        raise typer.Exit(1)

    if service.delete(key):
        console.print(f"[green]✓ Configuration key '{key}' deleted[/green]")
    else:
        console.print(f"[red]Failed to delete configuration key '{key}'[/red]")


@app.command("reset")
def reset_config(
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Reset all configuration to defaults"""
    service = ConfigService()

    configs = service.get_all()
    if not configs:
        console.print("[yellow]No configuration to reset[/yellow]")
        return

    if not force:
        console.print(f"[red]⚠ This will delete all {len(configs)} configuration value(s)[/red]")
        if not typer.confirm("Are you sure?", default=False):
            raise typer.Abort()

    deleted_count = 0
    for key in configs.keys():
        if service.delete(key):
            deleted_count += 1

    console.print(f"[green]✓ Reset {deleted_count} configuration value(s)[/green]")

