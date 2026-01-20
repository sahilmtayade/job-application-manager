"""CLI commands for goal management"""

import typer
from rich.console import Console
from rich.progress import BarColumn, Progress, TextColumn

from jam.core.enums import GoalType
from jam.core.services.goal_service import GoalService

console = Console()
app = typer.Typer()


@app.command("set")
def set_goal(
    goal_type: str = typer.Argument(..., help="Goal type: daily or weekly"),
    target: int = typer.Argument(..., help="Target number of applications"),
):
    """Set a daily or weekly application goal"""
    service = GoalService()

    try:
        g_type = GoalType(goal_type.lower())
    except ValueError:
        console.print(f"[red]Invalid goal type: {goal_type}. Use 'daily' or 'weekly'.[/red]")
        raise typer.Exit(1)

    if target <= 0:
        console.print(f"[red]Target must be a positive number[/red]")
        raise typer.Exit(1)

    goal = service.set_goal(g_type, target)

    console.print(f"[green]✓ {g_type.value.title()} goal set to {target} applications[/green]")
    console.print(f"  Period: {goal.period_start} to {goal.period_end}")


@app.command("status")
def status():
    """Show progress toward current goals"""
    service = GoalService()

    console.print("\n[bold]Goal Progress[/bold]\n")

    for goal_type in GoalType:
        progress_data = service.get_progress(goal_type)

        current = progress_data["current"]
        target = progress_data["target"]
        percent = progress_data["percent"]
        period_start = progress_data["period_start"]
        period_end = progress_data["period_end"]

        if target == 0:
            console.print(f"[dim]{goal_type.value.title()}: No goal set[/dim]")
            continue

        # Determine color based on progress
        if percent >= 100:
            color = "green"
            status_emoji = "✓"
        elif percent >= 50:
            color = "yellow"
            status_emoji = "◐"
        else:
            color = "red"
            status_emoji = "○"

        # Period label
        if goal_type == GoalType.DAILY:
            period_label = f"Today ({period_start})"
        else:
            period_label = f"Week of {period_start}"

        console.print(f"[bold]{goal_type.value.title()}[/bold] - {period_label}")

        # Progress bar
        with Progress(
            TextColumn("{task.description}"),
            BarColumn(bar_width=30),
            TextColumn("[{task.percentage:>3.0f}%]"),
            TextColumn("{task.fields[count]}"),
            console=console,
            transient=True,
        ) as progress_bar:
            task = progress_bar.add_task(
                f"  {status_emoji}",
                total=target,
                completed=min(current, target),
                count=f"{current}/{target}",
            )
            progress_bar.refresh()

        # Show completed bar inline
        filled = int(percent / 100 * 20)
        bar = "█" * filled + "░" * (20 - filled)
        console.print(f"  [{color}]{bar}[/{color}] {current}/{target} ({percent:.0f}%)")

        remaining = progress_data["remaining"]
        if remaining > 0:
            console.print(f"  [dim]{remaining} more to reach goal[/dim]")
        else:
            console.print(f"  [green]Goal achieved! 🎉[/green]")

        console.print()


@app.command("history")
def history(
    goal_type: str = typer.Option(None, "--type", "-t", help="Filter by type: daily or weekly"),
    limit: int = typer.Option(10, "--limit", "-n", help="Number of goals to show"),
):
    """Show goal history"""
    service = GoalService()

    g_type = None
    if goal_type:
        try:
            g_type = GoalType(goal_type.lower())
        except ValueError:
            console.print(f"[red]Invalid goal type: {goal_type}[/red]")
            raise typer.Exit(1)

    goals = service.get_all_goals(g_type)[:limit]

    if not goals:
        console.print("[dim]No goals found[/dim]")
        return

    for goal in goals:
        console.print(
            f"  {goal.goal_type.value.title()}: {goal.target_count} "
            f"({goal.period_start} to {goal.period_end})"
        )

