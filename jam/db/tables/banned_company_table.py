"""Table operations for banned companies database"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from jam.core.models import BannedCompany
from jam.db.connection import get_cursor


class BannedCompanyTable:
    """Database operations for banned companies"""

    def create(self, name: str, reason: Optional[str] = None) -> BannedCompany:
        """Add a company to the banned list"""
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO banned_companies (name, reason, created_at)
                VALUES (?, ?, ?)
                """,
                (name, reason, now)
            )
            banned_id = cursor.lastrowid
            return BannedCompany(
                id=banned_id,
                name=name,
                reason=reason,
                created_at=now
            )

    def get_by_id(self, banned_id: int) -> Optional[BannedCompany]:
        """Get a banned company by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM banned_companies WHERE id = ?",
                (banned_id,)
            )
            row = cursor.fetchone()
            if row:
                return BannedCompany(**dict(row))
            return None

    def get_by_name(self, name: str) -> Optional[BannedCompany]:
        """Get a banned company by exact name (case-insensitive)"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM banned_companies WHERE LOWER(name) = LOWER(?)",
                (name,)
            )
            row = cursor.fetchone()
            if row:
                return BannedCompany(**dict(row))
            return None

    def get_all(self) -> list[BannedCompany]:
        """Get all banned companies"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT * FROM banned_companies ORDER BY name")
            return [BannedCompany(**dict(row)) for row in cursor.fetchall()]

    def delete(self, banned_id: int) -> bool:
        """Remove a company from the banned list"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM banned_companies WHERE id = ?", (banned_id,))
            return cursor.rowcount > 0

    def check_names(self, names: list[str]) -> list[str]:
        """
        Check which company names from the provided list are banned.
        Returns the list of banned names (case-insensitive match).
        """
        if not names:
            return []

        with get_cursor() as (conn, cursor):
            # Create placeholders for IN clause
            placeholders = ",".join("LOWER(?)" for _ in names)
            cursor.execute(
                f"""
                SELECT name FROM banned_companies
                WHERE LOWER(name) IN ({placeholders})
                """,
                [n.lower() for n in names]
            )
            return [row["name"] for row in cursor.fetchall()]

    def is_banned(self, name: str) -> bool:
        """Check if a company name is banned (case-insensitive)"""
        return self.get_by_name(name) is not None

