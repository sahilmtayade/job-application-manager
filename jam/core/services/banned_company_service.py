"""Service layer for banned company operations"""

from __future__ import annotations

from typing import Optional

from jam.core.models import BannedCompany
from jam.db.tables.banned_company_table import BannedCompanyTable


class BannedCompanyService:
    """Business logic for banned company operations"""

    def __init__(self):
        self.table = BannedCompanyTable()

    def add(self, name: str, reason: Optional[str] = None) -> tuple[bool, str, Optional[BannedCompany]]:
        """
        Add a company to the banned list.
        Returns tuple of (success, message, banned_company).
        """
        name = name.strip()
        if not name:
            return False, "Company name cannot be empty", None

        # Check if already banned
        existing = self.table.get_by_name(name)
        if existing:
            return False, f"'{name}' is already on the banned list", None

        try:
            banned = self.table.create(name, reason)
            return True, f"'{name}' added to banned list", banned
        except Exception as e:
            return False, f"Failed to ban company: {str(e)}", None

    def remove(self, banned_id: int) -> tuple[bool, str]:
        """
        Remove a company from the banned list.
        Returns tuple of (success, message).
        """
        banned = self.table.get_by_id(banned_id)
        if not banned:
            return False, f"Banned company #{banned_id} not found"

        success = self.table.delete(banned_id)
        if success:
            return True, f"'{banned.name}' removed from banned list"
        return False, "Failed to remove from banned list"

    def get(self, banned_id: int) -> Optional[BannedCompany]:
        """Get a banned company by ID"""
        return self.table.get_by_id(banned_id)

    def list(self) -> list[BannedCompany]:
        """List all banned companies"""
        return self.table.get_all()

    def is_banned(self, name: str) -> bool:
        """Check if a company name is banned (case-insensitive)"""
        return self.table.is_banned(name)

    def check_names(self, names: list[str]) -> list[str]:
        """
        Check which company names are banned.
        Returns list of banned names.
        """
        return self.table.check_names(names)

