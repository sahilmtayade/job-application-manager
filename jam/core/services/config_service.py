"""Service layer for config operations"""

from __future__ import annotations

from typing import Any, Optional
import json

from jam.core.models import Config
from jam.db.tables.config_table import ConfigTable


class ConfigService:
    """Business logic for configuration management"""

    # Default configuration values
    DEFAULTS = {
        "default_source": None,
        "default_work_location": None,
        "ghosted_threshold_days": "30",
        "reapplication_warning_days": "90",
    }

    def __init__(self):
        self.table = ConfigTable()

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a config value.
        Returns the default if key doesn't exist.
        Falls back to DEFAULTS if default not provided.
        """
        config = self.table.get(key)
        if config:
            return self._deserialize(config.value)

        if default is not None:
            return default

        return self._deserialize(self.DEFAULTS.get(key))

    def set(self, key: str, value: Any) -> Config:
        """Set a config value"""
        serialized = self._serialize(value)
        return self.table.set(key, serialized)

    def get_all(self) -> dict[str, Any]:
        """Get all config entries as a dictionary"""
        configs = self.table.get_all()
        result = {}
        for config in configs:
            result[config.key] = self._deserialize(config.value)
        return result

    def delete(self, key: str) -> bool:
        """Delete a config entry"""
        return self.table.delete(key)

    def exists(self, key: str) -> bool:
        """Check if a config key exists"""
        return self.table.exists(key)

    def reset(self) -> None:
        """Reset all config to defaults by clearing all entries"""
        self.table.clear_all()

    def get_with_default_fallback(self, key: str) -> Any:
        """Get a config value, falling back to DEFAULTS"""
        return self.get(key, default=self._deserialize(self.DEFAULTS.get(key)))

    def _serialize(self, value: Any) -> str:
        """Serialize a value to string for storage"""
        if value is None:
            return ""
        if isinstance(value, (str, int, float, bool)):
            return str(value)
        # For complex types, use JSON
        return json.dumps(value)

    def _deserialize(self, value: Optional[str]) -> Any:
        """Deserialize a stored string value"""
        if value is None or value == "":
            return None

        # Try to parse as JSON for complex types
        if value.startswith(("[", "{")):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass

        # Try to parse as number
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            pass

        # Try to parse as boolean
        if value.lower() in ("true", "false"):
            return value.lower() == "true"

        # Return as string
        return value

