"""Main CLI application for JAM"""

import typer
from rich.console import Console

from jam.db.schema import init_db

# Initialize console for rich output
console = Console()

# Create main app
app = typer.Typer(
    name="jam",
    help="Job Application Manager - Track and analyze your job applications",
    no_args_is_help=True,
)


def init_callback():
    """Initialize database on startup"""
    init_db()


# Import and register subcommands
from jam.cli.applications import app as applications_app
from jam.cli.companies import app as companies_app
from jam.cli.goals import app as goals_app
from jam.cli.stats import app as stats_app
from jam.cli.notes import app as notes_app
from jam.cli.config import app as config_app
from jam.cli.export import export
from jam.cli.backup import app as backup_app

# Register application commands at root level
app.command(name="add")(applications_app.registered_commands[0].callback)
app.command(name="list")(applications_app.registered_commands[1].callback)
app.command(name="show")(applications_app.registered_commands[2].callback)
app.command(name="update")(applications_app.registered_commands[3].callback)
app.command(name="delete")(applications_app.registered_commands[4].callback)
app.command(name="restore")(applications_app.registered_commands[5].callback)

# Register subcommand groups
app.add_typer(companies_app, name="company", help="Manage companies")
app.add_typer(goals_app, name="goal", help="Manage application goals")
app.add_typer(stats_app, name="stats", help="View statistics")
app.add_typer(notes_app, name="note", help="Manage notes")
app.add_typer(config_app, name="config", help="Manage configuration")
app.add_typer(backup_app, name="backup", help="Backup and restore")

# Register export at root level
app.command(name="export")(export)


@app.callback()
def callback():
    """Initialize database before any command"""
    init_callback()


if __name__ == "__main__":
    app()

