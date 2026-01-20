"""Service layer for application file operations"""

from __future__ import annotations

from typing import Optional

from jam.core.models import ApplicationFile
from jam.db.tables.file_table import FileTable


# Configuration
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


class FileService:
    """Business logic for application file operations"""

    def __init__(self):
        self.table = FileTable()

    def upload(
        self,
        application_id: int,
        filename: str,
        mime_type: str,
        file_data: bytes,
    ) -> tuple[bool, str, Optional[ApplicationFile]]:
        """
        Upload a file for an application.
        Returns tuple of (success, message, file).
        """
        # Validate file size
        if len(file_data) > MAX_FILE_SIZE:
            max_mb = MAX_FILE_SIZE / (1024 * 1024)
            return False, f"File size exceeds maximum allowed ({max_mb}MB)", None

        # Validate MIME type
        if mime_type not in ALLOWED_MIME_TYPES:
            allowed = ", ".join(sorted(ALLOWED_MIME_TYPES))
            return False, f"File type not allowed. Allowed types: {allowed}", None

        # Validate filename
        if not filename or not filename.strip():
            return False, "Filename cannot be empty", None

        try:
            file = self.table.create(
                application_id=application_id,
                filename=filename,
                mime_type=mime_type,
                file_data=file_data,
            )
            return True, "File uploaded successfully", file
        except Exception as e:
            return False, f"Failed to upload file: {str(e)}", None

    def get(self, file_id: int, include_data: bool = True) -> Optional[ApplicationFile]:
        """Get a file by ID"""
        return self.table.get_by_id(file_id, include_data=include_data)

    def list_for_application(self, application_id: int) -> list[ApplicationFile]:
        """List all files for an application (metadata only)"""
        return self.table.list_by_application(application_id)

    def delete(self, file_id: int) -> tuple[bool, str]:
        """
        Delete a file.
        Returns tuple of (success, message).
        """
        file = self.table.get_by_id(file_id, include_data=False)
        if not file:
            return False, f"File #{file_id} not found"

        success = self.table.delete(file_id)
        if success:
            return True, f"File '{file.filename}' deleted"
        return False, "Failed to delete file"

    def get_file_count(self, application_id: int) -> int:
        """Get the number of files for an application"""
        return self.table.get_file_count(application_id)

    def get_file_counts_batch(self, application_ids: list[int]) -> dict[int, int]:
        """Get file counts for multiple applications"""
        return self.table.get_file_counts_batch(application_ids)

