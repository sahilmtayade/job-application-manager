"""Service layer for company operations"""

from __future__ import annotations

from typing import Optional

from jam.core.models import Company, CompanyAlias
from jam.db.tables.company_table import CompanyTable


class CompanyService:
    """Business logic for company operations"""

    def __init__(self):
        self.table = CompanyTable()

    def get(self, company_id: int) -> Optional[Company]:
        """Get a company by ID"""
        return self.table.get_by_id(company_id)

    def get_by_name(self, name: str) -> Optional[Company]:
        """Get a company by exact name"""
        return self.table.get_by_name(name)

    def list(self) -> list[Company]:
        """List all companies"""
        return self.table.get_all()

    def search(self, query: str) -> list[Company]:
        """Search companies by name"""
        return self.table.search(query)

    def merge(self, from_id: int, to_id: int) -> bool:
        """
        Merge one company into another.

        All applications from the source company are moved to the target.
        The source company name becomes an alias of the target.
        """
        from_company = self.table.get_by_id(from_id)
        to_company = self.table.get_by_id(to_id)

        if not from_company or not to_company:
            return False

        return self.table.merge(from_id, to_id)

    def add_alias(self, company_id: int, alias: str) -> Optional[CompanyAlias]:
        """Add an alias for a company"""
        company = self.table.get_by_id(company_id)
        if not company:
            return None
        return self.table.add_alias(company_id, alias)

    def get_aliases(self, company_id: int) -> list[CompanyAlias]:
        """Get all aliases for a company"""
        return self.table.get_aliases(company_id)

    def get_application_count(self, company_id: int, include_deleted: bool = False) -> int:
        """Get the number of applications for a company"""
        return self.table.get_application_count(company_id, include_deleted=include_deleted)

    def delete(self, company_id: int) -> tuple[bool, str]:
        """
        Delete a company.

        Returns tuple of (success, message).
        Fails if any applications exist (including soft-deleted).
        """
        company = self.table.get_by_id(company_id)
        if not company:
            return False, f"Company #{company_id} not found"

        # Check for any applications (including soft-deleted)
        app_count = self.table.get_application_count(company_id, include_deleted=True)
        if app_count > 0:
            return False, f"Cannot delete {company.name}: {app_count} application(s) exist. Delete applications first."

        success = self.table.delete(company_id)
        if success:
            return True, f"Company {company.name} deleted successfully"
        return False, "Failed to delete company"

    def find_similar(self, name: str) -> list[Company]:
        """Find companies with similar names"""
        return self.table.find_similar(name)

