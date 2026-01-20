"""Table operations for application database"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from jam.core.enums import ApplicationStatus, WorkLocation
from jam.core.models import Application, ApplicationEvent
from jam.db.connection import get_cursor


class ApplicationTable:
    """Database operations for applications"""

    def _trim(self, value: Optional[str]) -> Optional[str]:
        """Trim whitespace from optional string"""
        return value.strip() if value else value

    def create(
        self,
        company_id: int,
        company_name_raw: str,
        position: str,
        applied_at: date,
        initial_status: ApplicationStatus = ApplicationStatus.APPLIED,
        source: Optional[str] = None,
        url: Optional[str] = None,
        notes: Optional[str] = None,
        work_location: Optional[WorkLocation] = None,
        location_address: Optional[str] = None,
    ) -> Application:
        """Create a new application with initial status event"""
        # Trim all string fields
        company_name_raw = company_name_raw.strip()
        position = position.strip()
        source = self._trim(source)
        url = self._trim(url)
        location_address = self._trim(location_address)
        # Notes can have intentional whitespace, only trim edges
        notes = self._trim(notes)

        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO applications
                (company_id, company_name_raw, position, applied_at,
                 source, url, notes, work_location, location_address, is_deleted, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (company_id, company_name_raw, position, applied_at, source, url, notes,
                 work_location.value if work_location else None,
                 location_address, now, now)
            )
            app_id = cursor.lastrowid

            # Create initial status event
            cursor.execute(
                """
                INSERT INTO application_events
                (application_id, from_status, to_status, timestamp)
                VALUES (?, NULL, ?, ?)
                """,
                (app_id, initial_status.value, now)
            )

            return Application(
                id=app_id,
                company_id=company_id,
                company_name_raw=company_name_raw,  # Already trimmed above
                position=position,  # Already trimmed above
                applied_at=applied_at,
                source=source,  # Already trimmed above
                url=url,  # Already trimmed above
                notes=notes,  # Already trimmed above
                work_location=work_location,
                location_address=location_address,  # Already trimmed above
                is_deleted=False,
                created_at=now,
                updated_at=now,
                current_status=initial_status,
                status_updated_at=now
            )

    def get_by_id(self, app_id: int, include_deleted: bool = False) -> Optional[Application]:
        """Get an application by ID with current status from events"""
        with get_cursor() as (conn, cursor):
            query = """
                SELECT a.*, c.name as company_name,
                       e.to_status as current_status,
                       e.timestamp as status_updated_at
                FROM applications a
                JOIN companies c ON a.company_id = c.id
                LEFT JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                WHERE a.id = ?
            """
            if not include_deleted:
                query += " AND a.is_deleted = 0"

            cursor.execute(query, (app_id,))
            row = cursor.fetchone()
            if row:
                data = dict(row)
                if data.get("current_status"):
                    data["current_status"] = ApplicationStatus(data["current_status"])
                data["is_deleted"] = bool(data["is_deleted"])
                if data.get("work_location"):
                    data["work_location"] = WorkLocation(data["work_location"])
                return Application(**data)
            return None

    def get_all(
        self,
        include_deleted: bool = False,
        status: Optional[list[ApplicationStatus]] = None,
        company_id: Optional[int] = None,
        since: Optional[date] = None,
        limit: Optional[int] = None,
    ) -> list[Application]:
        """Get applications with optional filters, including current status from events"""
        with get_cursor() as (conn, cursor):
            query = """
                SELECT a.*, c.name as company_name,
                       e.to_status as current_status,
                       e.timestamp as status_updated_at
                FROM applications a
                JOIN companies c ON a.company_id = c.id
                LEFT JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                WHERE 1=1
            """
            params: list = []

            if not include_deleted:
                query += " AND a.is_deleted = 0"

            if status:
                placeholders = ",".join("?" * len(status))
                query += f" AND e.to_status IN ({placeholders})"
                params.extend(s.value for s in status)

            if company_id:
                query += " AND a.company_id = ?"
                params.append(company_id)

            if since:
                query += " AND a.applied_at >= ?"
                params.append(since)

            query += " ORDER BY a.applied_at DESC, a.id DESC"

            if limit:
                query += " LIMIT ?"
                params.append(limit)

            cursor.execute(query, params)
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                if data.get("current_status"):
                    data["current_status"] = ApplicationStatus(data["current_status"])
                data["is_deleted"] = bool(data["is_deleted"])
                if data.get("work_location"):
                    data["work_location"] = WorkLocation(data["work_location"])
                results.append(Application(**data))
            return results

    def update(
        self,
        app_id: int,
        company_id: Optional[int] = None,
        company_name_raw: Optional[str] = None,
        position: Optional[str] = None,
        source: Optional[str] = None,
        url: Optional[str] = None,
        notes: Optional[str] = None,
        work_location: Optional[WorkLocation] = None,
        location_address: Optional[str] = None,
    ) -> Optional[Application]:
        """Update an application's metadata fields (not status)"""
        app = self.get_by_id(app_id)
        if not app:
            return None

        # Trim string fields
        company_name_raw = self._trim(company_name_raw)
        position = self._trim(position)
        source = self._trim(source)
        url = self._trim(url)
        notes = self._trim(notes)
        location_address = self._trim(location_address)

        with get_cursor() as (conn, cursor):
            now = datetime.now()
            updates = ["updated_at = ?"]
            params: list = [now]

            if company_id is not None:
                updates.append("company_id = ?")
                params.append(company_id)

            if company_name_raw is not None:
                updates.append("company_name_raw = ?")
                params.append(company_name_raw)

            if position is not None:
                updates.append("position = ?")
                params.append(position)

            if source is not None:
                updates.append("source = ?")
                params.append(source)

            if url is not None:
                updates.append("url = ?")
                params.append(url)

            if notes is not None:
                updates.append("notes = ?")
                params.append(notes)

            if work_location is not None:
                updates.append("work_location = ?")
                params.append(work_location.value)

            if location_address is not None:
                updates.append("location_address = ?")
                params.append(location_address)

            params.append(app_id)
            cursor.execute(
                f"UPDATE applications SET {', '.join(updates)} WHERE id = ?",
                params
            )

        return self.get_by_id(app_id)

    def soft_delete(self, app_id: int) -> bool:
        """Soft delete an application"""
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                UPDATE applications
                SET is_deleted = 1, deleted_at = ?, updated_at = ?
                WHERE id = ? AND is_deleted = 0
                """,
                (now, now, app_id)
            )
            return cursor.rowcount > 0

    def hard_delete(self, app_id: int) -> bool:
        """Permanently delete an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM applications WHERE id = ?", (app_id,))
            return cursor.rowcount > 0

    def restore(self, app_id: int) -> bool:
        """Restore a soft-deleted application"""
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                UPDATE applications
                SET is_deleted = 0, deleted_at = NULL, updated_at = ?
                WHERE id = ? AND is_deleted = 1
                """,
                (now, app_id)
            )
            return cursor.rowcount > 0

    def find_similar(
        self,
        company_id: int,
        position: Optional[str] = None,
        include_deleted: bool = True,
    ) -> list[Application]:
        """Find similar applications for reapplication check"""
        with get_cursor() as (conn, cursor):
            query = """
                SELECT a.*, c.name as company_name
                FROM applications a
                JOIN companies c ON a.company_id = c.id
                WHERE a.company_id = ?
            """
            params: list = [company_id]

            if not include_deleted:
                query += " AND a.is_deleted = 0"

            if position:
                query += " AND LOWER(a.position) LIKE LOWER(?)"
                params.append(f"%{position}%")

            query += " ORDER BY a.applied_at DESC"

            cursor.execute(query, params)
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data["status"] = ApplicationStatus(data["status"])
                data["is_deleted"] = bool(data["is_deleted"])
                if data.get("work_location"):
                    data["work_location"] = WorkLocation(data["work_location"])
                results.append(Application(**data))
            return results

    def count_in_period(
        self,
        start_date: date,
        end_date: date,
        include_deleted: bool = True,
    ) -> int:
        """Count applications in a date range"""
        with get_cursor() as (conn, cursor):
            query = """
                SELECT COUNT(*) as count FROM applications
                WHERE applied_at >= ? AND applied_at <= ?
            """
            params: list = [start_date, end_date]

            if not include_deleted:
                query += " AND is_deleted = 0"

            cursor.execute(query, params)
            row = cursor.fetchone()
            return row["count"] if row else 0

    def get_unique_sources(self, include_deleted: bool = False) -> list[str]:
        """Get list of unique sources used in applications"""
        with get_cursor() as (conn, cursor):
            query = """
                SELECT DISTINCT source FROM applications
                WHERE source IS NOT NULL AND source != ''
            """

            if not include_deleted:
                query += " AND is_deleted = 0"

            query += " ORDER BY source"

            cursor.execute(query)
            return [row["source"] for row in cursor.fetchall()]

    def get_unique_positions(self, include_deleted: bool = False) -> list[str]:
        """Get list of unique positions used in applications"""
        with get_cursor() as (conn, cursor):
            query = """
                SELECT DISTINCT position FROM applications
                WHERE position IS NOT NULL AND position != ''
            """

            if not include_deleted:
                query += " AND is_deleted = 0"

            query += " ORDER BY position"

            cursor.execute(query)
            return [row["position"] for row in cursor.fetchall()]


