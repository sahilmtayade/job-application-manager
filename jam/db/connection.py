"""SQLite connection manager for JAM"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator


def get_data_dir() -> Path:
    """
    Get the data directory.

    Uses JAM_DATA_DIR environment variable if set, otherwise defaults to ~/.jam
    """
    if env_dir := os.environ.get("JAM_DATA_DIR"):
        return Path(env_dir)
    return Path.home() / ".jam"


# Module-level paths for convenience
DATA_DIR = get_data_dir()
DB_PATH = DATA_DIR / "jam.db"
BACKUPS_DIR = DATA_DIR / "backups"


def get_db_path() -> Path:
    """Get the database path, ensuring directory exists"""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "jam.db"


def get_backups_dir() -> Path:
    """Get the backups directory, ensuring it exists"""
    backups_dir = get_data_dir() / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    return backups_dir


def ensure_data_dir() -> None:
    """Ensure the data directory exists"""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "backups").mkdir(parents=True, exist_ok=True)


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """Get a database connection with row factory configured"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_cursor() -> Generator[tuple[sqlite3.Connection, sqlite3.Cursor], None, None]:
    """Get a database cursor with automatic commit/rollback"""
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            yield conn, cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
