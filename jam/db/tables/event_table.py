"""Table operations for application events database"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from jam.core.enums import ApplicationStatus
from jam.core.models import ApplicationEvent
from jam.db.connection import get_cursor


class EventTable:
    """Database operations for application status events"""

    def create(
        self,
        application_id: int,
        to_status: ApplicationStatus,
        from_status: Optional[ApplicationStatus] = None,
        notes: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> ApplicationEvent:
        """Create a new status event"""
        with get_cursor() as (conn, cursor):
            event_time = timestamp or datetime.now()
            cursor.execute(
                """
                INSERT INTO application_events
                (application_id, from_status, to_status, timestamp, notes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    application_id,
                    from_status.value if from_status else None,
                    to_status.value,
                    event_time,
                    notes
                )
            )
            event_id = cursor.lastrowid

            return ApplicationEvent(
                id=event_id,
                application_id=application_id,
                from_status=from_status,
                to_status=to_status,
                timestamp=event_time,
                notes=notes
            )

    def get_by_id(self, event_id: int) -> Optional[ApplicationEvent]:
        """Get an event by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM application_events WHERE id = ?",
                (event_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_event(row)
            return None

    def get_all_for_application(self, application_id: int) -> list[ApplicationEvent]:
        """Get all events for an application ordered by timestamp"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT * FROM application_events
                WHERE application_id = ?
                ORDER BY timestamp ASC
                """,
                (application_id,)
            )
            return [self._row_to_event(row) for row in cursor.fetchall()]

    def get_latest_for_application(self, application_id: int) -> Optional[ApplicationEvent]:
        """Get the most recent event for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT * FROM application_events
                WHERE application_id = ?
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (application_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_event(row)
            return None

    def get_current_status(self, application_id: int) -> Optional[ApplicationStatus]:
        """Get the current status of an application from latest event"""
        event = self.get_latest_for_application(application_id)
        return event.to_status if event else None

    def update(
        self,
        event_id: int,
        to_status: Optional[ApplicationStatus] = None,
        notes: Optional[str] = None,
    ) -> Optional[ApplicationEvent]:
        """Update a status event's to_status and/or notes"""
        with get_cursor() as (conn, cursor):
            # Get existing event first
            cursor.execute(
                "SELECT * FROM application_events WHERE id = ?",
                (event_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            existing = self._row_to_event(row)

            # Build update query
            updates = []
            params = []

            if to_status is not None:
                updates.append("to_status = ?")
                params.append(to_status.value)

            if notes is not None:
                updates.append("notes = ?")
                params.append(notes if notes else None)

            if not updates:
                return existing

            params.append(event_id)
            cursor.execute(
                f"UPDATE application_events SET {', '.join(updates)} WHERE id = ?",
                params
            )

            # Return updated event
            cursor.execute(
                "SELECT * FROM application_events WHERE id = ?",
                (event_id,)
            )
            row = cursor.fetchone()
            return self._row_to_event(row) if row else None

    def delete(self, event_id: int) -> bool:
        """Delete a status event"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "DELETE FROM application_events WHERE id = ?",
                (event_id,)
            )
            return cursor.rowcount > 0

    def count_for_application(self, application_id: int) -> int:
        """Count events for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT COUNT(*) as count FROM application_events WHERE application_id = ?",
                (application_id,)
            )
            row = cursor.fetchone()
            return row["count"] if row else 0

    def status_exists_for_application(
        self,
        application_id: int,
        status: ApplicationStatus
    ) -> bool:
        """Check if a status already exists for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT 1 FROM application_events
                WHERE application_id = ? AND to_status = ?
                LIMIT 1
                """,
                (application_id, status.value)
            )
            return cursor.fetchone() is not None

    def _row_to_event(self, row) -> ApplicationEvent:
        """Convert a database row to an ApplicationEvent model"""
        data = dict(row)
        if data.get("from_status"):
            data["from_status"] = ApplicationStatus(data["from_status"])
        data["to_status"] = ApplicationStatus(data["to_status"])
        return ApplicationEvent(**data)

