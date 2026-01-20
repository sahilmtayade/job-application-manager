"""Service layer for backup operations"""

from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from jam.db.connection import get_db_path, get_backups_dir, ensure_data_dir


class BackupService:
    """Business logic for database backup and restore"""

    def __init__(self):
        ensure_data_dir()

    def create_backup(self, custom_name: Optional[str] = None) -> Path:
        """
        Create a timestamped backup of the database.

        Returns the path to the backup file.
        """
        db_path = get_db_path()
        backups_dir = get_backups_dir()

        if not db_path.exists():
            raise FileNotFoundError("No database to backup")

        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")

        if custom_name:
            backup_name = f"jam_{custom_name}_{timestamp}.db"
        else:
            backup_name = f"jam_{timestamp}.db"

        backup_path = backups_dir / backup_name
        shutil.copy2(db_path, backup_path)

        return backup_path

    def list_backups(self) -> list[dict]:
        """
        List all available backups.

        Returns list of dicts with:
        - name: Filename
        - path: Full path
        - size: File size in bytes
        - created: Creation timestamp
        """
        backups_dir = get_backups_dir()

        if not backups_dir.exists():
            return []

        backups = []
        for backup_file in sorted(backups_dir.glob("jam_*.db"), reverse=True):
            stat = backup_file.stat()
            # Use UTC with timezone info for consistent frontend parsing
            created_dt = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
            backups.append({
                "name": backup_file.name,
                "path": backup_file,
                "size": stat.st_size,
                "created": created_dt.isoformat(),
            })

        return backups

    def restore_backup(self, backup_path: Path) -> bool:
        """
        Restore the database from a backup.

        Creates a backup of current database before restoring.
        """
        db_path = get_db_path()

        if not backup_path.exists():
            raise FileNotFoundError(f"Backup not found: {backup_path}")

        # Backup current database first
        if db_path.exists():
            self.create_backup(custom_name="pre-restore")

        # Restore from backup
        shutil.copy2(backup_path, db_path)
        return True

    def get_backup_by_name(self, name: str) -> Optional[Path]:
        """Get a backup path by filename"""
        backups_dir = get_backups_dir()

        # Check if it's a full path
        path = Path(name)
        if path.exists() and path.is_file():
            return path

        # Check in backups directory
        backup_path = backups_dir / name
        if backup_path.exists():
            return backup_path

        # Try adding .db extension
        backup_path = backups_dir / f"{name}.db"
        if backup_path.exists():
            return backup_path

        return None

    def delete_backup(self, backup_path: Path) -> bool:
        """Delete a backup file"""
        backups_dir = get_backups_dir()
        if backup_path.exists() and backup_path.parent == backups_dir:
            backup_path.unlink()
            return True
        return False
