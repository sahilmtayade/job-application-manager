"""Table operations for banned sources database"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from jam.core.models import BannedSource
from jam.db.connection import get_cursor


class BannedSourceTable:
    """Database operations for banned sources"""

    def create(self, name: str, reason: Optional[str] = None) -> BannedSource:
        """Add a source to the banned list"""
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO banned_sources (name, reason, created_at)
                VALUES (?, ?, ?)
                """,
                (name, reason, now)
            )
            banned_id = cursor.lastrowid
            return BannedSource(
                id=banned_id,
                name=name,
                reason=reason,
                created_at=now
            )

    def get_by_id(self, banned_id: int) -> Optional[BannedSource]:
        """Get a banned source by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM banned_sources WHERE id = ?",
                (banned_id,)
            )
            row = cursor.fetchone()
            if row:
                return BannedSource(**dict(row))
            return None

    def get_by_name(self, name: str) -> Optional[BannedSource]:
        """Get a banned source by exact name (case-insensitive)"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM banned_sources WHERE LOWER(name) = LOWER(?)",
                (name,)
            )
            row = cursor.fetchone()
            if row:
                return BannedSource(**dict(row))
            return None

    def get_all(self) -> list[BannedSource]:
        """Get all banned sources"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT * FROM banned_sources ORDER BY name")
            return [BannedSource(**dict(row)) for row in cursor.fetchall()]

    def delete(self, banned_id: int) -> bool:
        """Remove a source from the banned list"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM banned_sources WHERE id = ?", (banned_id,))
            return cursor.rowcount > 0

    def check_names(self, names: list[str]) -> list[str]:
        """
        Check which source names from the provided list are banned.
        Returns the list of banned names (case-insensitive match).
        """
        if not names:
            return []

        with get_cursor() as (conn, cursor):
            # Create placeholders for IN clause
            placeholders = ",".join("LOWER(?)" for _ in names)
            cursor.execute(
                f"""
                SELECT name FROM banned_sources
                WHERE LOWER(name) IN ({placeholders})
                """,
                [n.lower() for n in names]
            )
            return [row["name"] for row in cursor.fetchall()]

    def is_banned(self, name: str) -> bool:
        """Check if a source name is banned (case-insensitive)"""
        return self.get_by_name(name) is not None

