"""Table operations for application files database"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from jam.core.models import ApplicationFile
from jam.db.connection import get_cursor


class FileTable:
    """Database operations for application files"""

    def create(
        self,
        application_id: int,
        filename: str,
        mime_type: str,
        file_data: bytes,
    ) -> ApplicationFile:
        """Store a file in the database"""
        filename = filename.strip()
        file_size = len(file_data)

        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO application_files
                (application_id, filename, mime_type, file_data, file_size, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (application_id, filename, mime_type, file_data, file_size, now)
            )
            file_id = cursor.lastrowid
            return ApplicationFile(
                id=file_id,
                application_id=application_id,
                filename=filename,
                mime_type=mime_type,
                file_size=file_size,
                created_at=now,
            )

    def get_by_id(self, file_id: int, include_data: bool = True) -> Optional[ApplicationFile]:
        """Get a file by ID, optionally including the file data"""
        with get_cursor() as (conn, cursor):
            if include_data:
                cursor.execute(
                    "SELECT * FROM application_files WHERE id = ?",
                    (file_id,)
                )
            else:
                cursor.execute(
                    """SELECT id, application_id, filename, mime_type, file_size, created_at
                    FROM application_files WHERE id = ?""",
                    (file_id,)
                )
            row = cursor.fetchone()
            if row:
                data = dict(row)
                return ApplicationFile(
                    id=data["id"],
                    application_id=data["application_id"],
                    filename=data["filename"],
                    mime_type=data["mime_type"],
                    file_size=data["file_size"],
                    file_data=data.get("file_data"),
                    created_at=data["created_at"],
                )
            return None

    def list_by_application(self, application_id: int) -> list[ApplicationFile]:
        """List all files for an application (metadata only, no BLOB data)"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """SELECT id, application_id, filename, mime_type, file_size, created_at
                FROM application_files
                WHERE application_id = ?
                ORDER BY created_at DESC""",
                (application_id,)
            )
            return [
                ApplicationFile(
                    id=row["id"],
                    application_id=row["application_id"],
                    filename=row["filename"],
                    mime_type=row["mime_type"],
                    file_size=row["file_size"],
                    created_at=row["created_at"],
                )
                for row in cursor.fetchall()
            ]

    def delete(self, file_id: int) -> bool:
        """Delete a file by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM application_files WHERE id = ?", (file_id,))
            return cursor.rowcount > 0

    def get_file_count(self, application_id: int) -> int:
        """Get the number of files for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT COUNT(*) as count FROM application_files WHERE application_id = ?",
                (application_id,)
            )
            row = cursor.fetchone()
            return row["count"] if row else 0

    def get_file_counts_batch(self, application_ids: list[int]) -> dict[int, int]:
        """Get file counts for multiple applications at once"""
        if not application_ids:
            return {}

        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(application_ids))
            cursor.execute(
                f"""SELECT application_id, COUNT(*) as count
                FROM application_files
                WHERE application_id IN ({placeholders})
                GROUP BY application_id""",
                application_ids
            )
            return {row["application_id"]: row["count"] for row in cursor.fetchall()}

