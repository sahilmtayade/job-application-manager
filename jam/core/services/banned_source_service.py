"""Service layer for banned source operations"""

from __future__ import annotations

from typing import Optional

from jam.core.models import BannedSource
from jam.db.tables.banned_source_table import BannedSourceTable


class BannedSourceService:
    """Business logic for banned source operations"""

    def __init__(self):
        self.table = BannedSourceTable()

    def add(self, name: str, reason: Optional[str] = None) -> tuple[bool, str, Optional[BannedSource]]:
        """
        Add a source to the banned list.
        Returns tuple of (success, message, banned_source).
        """
        name = name.strip()
        if not name:
            return False, "Source name cannot be empty", None

        # Check if already banned
        existing = self.table.get_by_name(name)
        if existing:
            return False, f"'{name}' is already on the banned list", None

        try:
            banned = self.table.create(name, reason)
            return True, f"'{name}' added to banned list", banned
        except Exception as e:
            return False, f"Failed to ban source: {str(e)}", None

    def remove(self, banned_id: int) -> tuple[bool, str]:
        """
        Remove a source from the banned list.
        Returns tuple of (success, message).
        """
        banned = self.table.get_by_id(banned_id)
        if not banned:
            return False, f"Banned source #{banned_id} not found"

        success = self.table.delete(banned_id)
        if success:
            return True, f"'{banned.name}' removed from banned list"
        return False, "Failed to remove from banned list"

    def get(self, banned_id: int) -> Optional[BannedSource]:
        """Get a banned source by ID"""
        return self.table.get_by_id(banned_id)

    def list(self) -> list[BannedSource]:
        """List all banned sources"""
        return self.table.get_all()

    def is_banned(self, name: str) -> bool:
        """Check if a source name is banned (case-insensitive)"""
        return self.table.is_banned(name)

    def check_names(self, names: list[str]) -> list[str]:
        """Check which names from the list are banned"""
        return self.table.check_names(names)

