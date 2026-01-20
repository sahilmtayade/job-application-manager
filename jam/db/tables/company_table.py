"""Table operations for company database"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from jam.core.models import Company, CompanyAlias
from jam.db.connection import get_cursor


class CompanyTable:
    """Database operations for companies"""

    def create(self, name: str) -> Company:
        """Create a new company"""
        name = name.strip()
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO companies (name, created_at, updated_at)
                VALUES (?, ?, ?)
                """,
                (name, now, now)
            )
            company_id = cursor.lastrowid
            return Company(
                id=company_id,
                name=name,
                created_at=now,
                updated_at=now
            )

    def get_by_id(self, company_id: int) -> Optional[Company]:
        """Get a company by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM companies WHERE id = ?",
                (company_id,)
            )
            row = cursor.fetchone()
            if row:
                return Company(**dict(row))
            return None

    def get_by_name(self, name: str) -> Optional[Company]:
        """Get a company by exact name"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM companies WHERE name = ?",
                (name,)
            )
            row = cursor.fetchone()
            if row:
                return Company(**dict(row))
            return None

    def get_all(self) -> list[Company]:
        """Get all companies"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT * FROM companies ORDER BY name")
            return [Company(**dict(row)) for row in cursor.fetchall()]

    def search(self, query: str) -> list[Company]:
        """Search companies by name (case-insensitive partial match)"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT DISTINCT c.* FROM companies c
                LEFT JOIN company_aliases ca ON c.id = ca.company_id
                WHERE LOWER(c.name) LIKE LOWER(?)
                   OR LOWER(ca.alias) LIKE LOWER(?)
                ORDER BY c.name
                """,
                (f"%{query}%", f"%{query}%")
            )
            return [Company(**dict(row)) for row in cursor.fetchall()]

    def find_similar(self, name: str) -> list[Company]:
        """Find companies with similar names for matching on add"""
        normalized = name.lower().strip()
        with get_cursor() as (conn, cursor):
            # Check exact match first
            cursor.execute(
                "SELECT * FROM companies WHERE LOWER(name) = ?",
                (normalized,)
            )
            exact = cursor.fetchone()
            if exact:
                return [Company(**dict(exact))]

            # Check aliases for exact match
            cursor.execute(
                """
                SELECT c.* FROM companies c
                JOIN company_aliases ca ON c.id = ca.company_id
                WHERE LOWER(ca.alias) = ?
                """,
                (normalized,)
            )
            alias_match = cursor.fetchone()
            if alias_match:
                return [Company(**dict(alias_match))]

            # Fuzzy match - companies containing the search term or vice versa
            cursor.execute(
                """
                SELECT DISTINCT c.* FROM companies c
                LEFT JOIN company_aliases ca ON c.id = ca.company_id
                WHERE LOWER(c.name) LIKE ?
                   OR LOWER(ca.alias) LIKE ?
                   OR ? LIKE '%' || LOWER(c.name) || '%'
                ORDER BY c.name
                LIMIT 5
                """,
                (f"%{normalized}%", f"%{normalized}%", normalized)
            )
            return [Company(**dict(row)) for row in cursor.fetchall()]

    def update(self, company_id: int, name: str) -> Optional[Company]:
        """Update a company's name"""
        name = name.strip()
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                UPDATE companies SET name = ?, updated_at = ?
                WHERE id = ?
                """,
                (name, now, company_id)
            )
            if cursor.rowcount > 0:
                return self.get_by_id(company_id)
            return None

    def delete(self, company_id: int) -> bool:
        """Delete a company (will fail if applications exist)"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM companies WHERE id = ?", (company_id,))
            return cursor.rowcount > 0

    def merge(self, from_id: int, to_id: int) -> bool:
        """Merge one company into another (updates all applications)"""
        with get_cursor() as (conn, cursor):
            # Update all applications to point to target company
            cursor.execute(
                "UPDATE applications SET company_id = ? WHERE company_id = ?",
                (to_id, from_id)
            )
            # Move aliases from source to target
            cursor.execute(
                "UPDATE company_aliases SET company_id = ? WHERE company_id = ?",
                (to_id, from_id)
            )
            # Get the source company name to add as alias
            cursor.execute("SELECT name FROM companies WHERE id = ?", (from_id,))
            source = cursor.fetchone()
            if source:
                try:
                    cursor.execute(
                        "INSERT INTO company_aliases (company_id, alias) VALUES (?, ?)",
                        (to_id, source["name"])
                    )
                except Exception:
                    pass  # Alias may already exist
            # Delete the source company
            cursor.execute("DELETE FROM companies WHERE id = ?", (from_id,))
            return True

    def add_alias(self, company_id: int, alias: str) -> Optional[CompanyAlias]:
        """Add an alias for a company"""
        alias = alias.strip()
        with get_cursor() as (conn, cursor):
            try:
                cursor.execute(
                    "INSERT INTO company_aliases (company_id, alias) VALUES (?, ?)",
                    (company_id, alias)
                )
                return CompanyAlias(
                    id=cursor.lastrowid,
                    company_id=company_id,
                    alias=alias
                )
            except Exception:
                return None  # Alias already exists

    def get_aliases(self, company_id: int) -> list[CompanyAlias]:
        """Get all aliases for a company"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM company_aliases WHERE company_id = ?",
                (company_id,)
            )
            return [CompanyAlias(**dict(row)) for row in cursor.fetchall()]

    def get_application_count(self, company_id: int, include_deleted: bool = False) -> int:
        """Get the number of applications for a company"""
        with get_cursor() as (conn, cursor):
            query = "SELECT COUNT(*) as count FROM applications WHERE company_id = ?"
            if not include_deleted:
                query += " AND is_deleted = 0"
            cursor.execute(query, (company_id,))
            row = cursor.fetchone()
            return row["count"] if row else 0

    def delete_alias(self, alias_id: int) -> bool:
        """Delete an alias by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "DELETE FROM company_aliases WHERE id = ?",
                (alias_id,)
            )
            return cursor.rowcount > 0
