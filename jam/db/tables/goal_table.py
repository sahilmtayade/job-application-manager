"""Table operations for goal database"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from jam.core.enums import GoalType
from jam.core.models import Goal
from jam.db.connection import get_cursor


class GoalTable:
    """Database operations for goals"""

    def create(
        self,
        goal_type: GoalType,
        target_count: int,
        period_start: date,
        period_end: date,
    ) -> Goal:
        """Create a new goal"""
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO goals (goal_type, target_count, period_start, period_end, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (goal_type.value, target_count, period_start, period_end, now)
            )
            return Goal(
                id=cursor.lastrowid,
                goal_type=goal_type,
                target_count=target_count,
                period_start=period_start,
                period_end=period_end,
                created_at=now
            )

    def get_by_id(self, goal_id: int) -> Optional[Goal]:
        """Get a goal by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT * FROM goals WHERE id = ?", (goal_id,))
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data["goal_type"] = GoalType(data["goal_type"])
                return Goal(**data)
            return None

    def get_current(self, goal_type: GoalType, reference_date: Optional[date] = None) -> Optional[Goal]:
        """Get the current goal for a type (most recent that covers the reference date)"""
        if reference_date is None:
            reference_date = date.today()

        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT * FROM goals
                WHERE goal_type = ?
                  AND period_start <= ?
                  AND period_end >= ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (goal_type.value, reference_date, reference_date)
            )
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data["goal_type"] = GoalType(data["goal_type"])
                return Goal(**data)
            return None

    def get_latest(self, goal_type: GoalType) -> Optional[Goal]:
        """Get the most recently created goal of a type"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT * FROM goals
                WHERE goal_type = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (goal_type.value,)
            )
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data["goal_type"] = GoalType(data["goal_type"])
                return Goal(**data)
            return None

    def get_all(self, goal_type: Optional[GoalType] = None) -> list[Goal]:
        """Get all goals, optionally filtered by type"""
        with get_cursor() as (conn, cursor):
            if goal_type:
                cursor.execute(
                    "SELECT * FROM goals WHERE goal_type = ? ORDER BY created_at DESC",
                    (goal_type.value,)
                )
            else:
                cursor.execute("SELECT * FROM goals ORDER BY created_at DESC")

            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data["goal_type"] = GoalType(data["goal_type"])
                results.append(Goal(**data))
            return results

    def delete(self, goal_id: int) -> bool:
        """Delete a goal"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
            return cursor.rowcount > 0

    def update(self, goal_id: int, target_count: int) -> Optional[Goal]:
        """Update a goal's target count"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "UPDATE goals SET target_count = ? WHERE id = ?",
                (target_count, goal_id)
            )
            if cursor.rowcount > 0:
                return self.get_by_id(goal_id)
            return None

