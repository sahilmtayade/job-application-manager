"""Table operations for application notes database"""

from __future__ import annotations

from typing import Optional

from jam.core.models import Note
from jam.db.connection import get_cursor


class NoteTable:
    """Database operations for application notes"""

    def create(self, application_id: int, content: str) -> Note:
        """Create a new note for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                INSERT INTO application_notes (application_id, content)
                VALUES (?, ?)
                """,
                (application_id, content)
            )
            note_id = cursor.lastrowid
            cursor.execute(
                "SELECT * FROM application_notes WHERE id = ?",
                (note_id,)
            )
            row = cursor.fetchone()
            return Note(**dict(row))

    def get_by_id(self, note_id: int) -> Optional[Note]:
        """Get a note by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM application_notes WHERE id = ?",
                (note_id,)
            )
            row = cursor.fetchone()
            if row:
                return Note(**dict(row))
            return None

    def get_by_application(self, application_id: int) -> list[Note]:
        """Get all notes for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT * FROM application_notes
                WHERE application_id = ?
                ORDER BY created_at DESC
                """,
                (application_id,)
            )
            return [Note(**dict(row)) for row in cursor.fetchall()]

    def search(self, query: str) -> list[tuple[Note, int]]:
        """
        Search notes by content.
        Returns list of (Note, application_id) tuples.
        """
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT * FROM application_notes
                WHERE LOWER(content) LIKE LOWER(?)
                ORDER BY created_at DESC
                """,
                (f"%{query}%",)
            )
            results = []
            for row in cursor.fetchall():
                note = Note(**dict(row))
                results.append((note, note.application_id))
            return results

    def update(self, note_id: int, content: str) -> Optional[Note]:
        """Update a note's content"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                UPDATE application_notes
                SET content = ?
                WHERE id = ?
                """,
                (content, note_id)
            )
            if cursor.rowcount == 0:
                return None

            cursor.execute(
                "SELECT * FROM application_notes WHERE id = ?",
                (note_id,)
            )
            row = cursor.fetchone()
            if row:
                return Note(**dict(row))
            return None

    def delete(self, note_id: int) -> bool:
        """Delete a note"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "DELETE FROM application_notes WHERE id = ?",
                (note_id,)
            )
            return cursor.rowcount > 0

    def count_by_application(self, application_id: int) -> int:
        """Count notes for an application"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                """
                SELECT COUNT(*) as count
                FROM application_notes
                WHERE application_id = ?
                """,
                (application_id,)
            )
            row = cursor.fetchone()
            return row["count"] if row else 0

