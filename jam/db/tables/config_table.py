"""Table operations for user config database"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
import json

from jam.core.models import Config
from jam.db.connection import get_cursor


class ConfigTable:
    """Database operations for user configuration"""

    def get(self, key: str) -> Optional[Config]:
        """Get a config value by key"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM user_config WHERE key = ?",
                (key,)
            )
            row = cursor.fetchone()
            if row:
                return Config(**dict(row))
            return None

    def set(self, key: str, value: str) -> Config:
        """Set a config value, creating or updating as needed"""
        with get_cursor() as (conn, cursor):
            now = datetime.now()
            cursor.execute(
                """
                INSERT INTO user_config (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (key, value, now)
            )
            return Config(key=key, value=value, updated_at=now)

    def get_all(self) -> list[Config]:
        """Get all config entries"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT * FROM user_config ORDER BY key"
            )
            return [Config(**dict(row)) for row in cursor.fetchall()]

    def delete(self, key: str) -> bool:
        """Delete a config entry"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "DELETE FROM user_config WHERE key = ?",
                (key,)
            )
            return cursor.rowcount > 0

    def exists(self, key: str) -> bool:
        """Check if a config key exists"""
        with get_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT 1 FROM user_config WHERE key = ? LIMIT 1",
                (key,)
            )
            return cursor.fetchone() is not None

    def clear_all(self) -> None:
        """Delete all config entries"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM user_config")

