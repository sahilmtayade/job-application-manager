"""Service layer for note operations"""

from __future__ import annotations

from typing import Optional

from jam.core.models import Note, Application
from jam.db.tables.note_table import NoteTable
from jam.db.tables.application_table import ApplicationTable


class NoteService:
    """Business logic for note operations"""

    def __init__(self):
        self.note_table = NoteTable()
        self.app_table = ApplicationTable()

    def add(self, application_id: int, content: str) -> Optional[Note]:
        """
        Add a note to an application.
        Returns None if application doesn't exist.
        """
        # Verify application exists
        app = self.app_table.get_by_id(application_id)
        if not app:
            return None

        return self.note_table.create(application_id, content)

    def get(self, note_id: int) -> Optional[Note]:
        """Get a note by ID"""
        return self.note_table.get_by_id(note_id)

    def list_for_application(self, application_id: int) -> list[Note]:
        """Get all notes for an application"""
        return self.note_table.get_by_application(application_id)

    def search(self, query: str) -> list[tuple[Note, Application]]:
        """
        Search notes by content.
        Returns list of (Note, Application) tuples.
        """
        results = self.note_table.search(query)
        enriched = []
        for note, app_id in results:
            app = self.app_table.get_by_id(app_id, include_deleted=True)
            if app:
                enriched.append((note, app))
        return enriched

    def update(self, note_id: int, content: str) -> Optional[Note]:
        """Update a note's content"""
        return self.note_table.update(note_id, content)

    def delete(self, note_id: int) -> bool:
        """Delete a note"""
        return self.note_table.delete(note_id)

    def count_for_application(self, application_id: int) -> int:
        """Count notes for an application"""
        return self.note_table.count_by_application(application_id)

