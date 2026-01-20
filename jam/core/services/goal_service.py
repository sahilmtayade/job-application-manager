"""Service layer for goal operations"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from jam.core.enums import GoalType
from jam.core.models import Goal
from jam.db.tables.application_table import ApplicationTable
from jam.db.tables.goal_table import GoalTable


class GoalService:
    """Business logic for goal operations"""

    def __init__(self):
        self.goal_table = GoalTable()
        self.app_table = ApplicationTable()

    def set_goal(self, goal_type: GoalType, target_count: int) -> Goal:
        """
        Set a new goal for the current period.

        For daily goals: today
        For weekly goals: current week (Monday-Sunday)
        """
        today = date.today()

        if goal_type == GoalType.DAILY:
            period_start = today
            period_end = today
        else:  # WEEKLY
            # Monday of current week
            period_start = today - timedelta(days=today.weekday())
            # Sunday of current week
            period_end = period_start + timedelta(days=6)

        return self.goal_table.create(
            goal_type=goal_type,
            target_count=target_count,
            period_start=period_start,
            period_end=period_end,
        )

    def get_current_goal(self, goal_type: GoalType) -> Optional[Goal]:
        """Get the current goal for a type"""
        return self.goal_table.get_current(goal_type)

    def get_latest_goal(self, goal_type: GoalType) -> Optional[Goal]:
        """Get the most recently set goal of a type"""
        return self.goal_table.get_latest(goal_type)

    def get_progress(self, goal_type: GoalType) -> dict:
        """
        Get progress toward the current goal.

        Returns dict with:
        - goal: The Goal object (or None if not set)
        - current: Number of applications in the period
        - target: Target count
        - remaining: Applications needed to meet goal
        - percentage: Percentage complete
        - period_start: Start of period
        - period_end: End of period
        """
        goal = self.get_current_goal(goal_type)
        today = date.today()

        if goal_type == GoalType.DAILY:
            period_start = today
            period_end = today
        else:  # WEEKLY
            period_start = today - timedelta(days=today.weekday())
            period_end = period_start + timedelta(days=6)

        # Count applications in period
        current = self.app_table.count_in_period(period_start, period_end)

        # If no goal for current period, use the latest goal
        if not goal:
            goal = self.get_latest_goal(goal_type)

        if goal:
            target = goal.target_count
        else:
            target = 0

        remaining = max(0, target - current)
        percentage = (current / target * 100) if target > 0 else 0

        return {
            "goal": goal,
            "current": current,
            "target": target,
            "remaining": remaining,
            "percentage": min(100, percentage),
            "period_start": period_start,
            "period_end": period_end,
        }

    def get_all_goals(self, goal_type: Optional[GoalType] = None) -> list[Goal]:
        """Get all goals, optionally filtered by type"""
        return self.goal_table.get_all(goal_type)

