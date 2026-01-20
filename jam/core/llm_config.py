"""LLM Configuration loader

Provides centralized access to LLM settings from config/llm.yaml
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class ServerConfig:
    """LLM server connection settings"""
    url: str = "http://localhost:11434"
    connect_timeout: float = 60.0
    read_timeout: Optional[float] = None


@dataclass
class ModelsConfig:
    """Model name configuration"""
    vision: str = "qwen3-vl:4b"
    text: str = "llama3.2"


@dataclass
class EndpointsConfig:
    """API endpoint paths"""
    models: str = "/api/tags"
    generate: str = "/api/generate"
    completions: str = "/v1/chat/completions"


@dataclass
class AnalysisConfig:
    """Analysis settings"""
    concurrency: int = 2  # Number of concurrent job analyses


@dataclass
class LLMConfig:
    """Complete LLM configuration"""
    server: ServerConfig = field(default_factory=ServerConfig)
    models: ModelsConfig = field(default_factory=ModelsConfig)
    api_mode: str = "ollama"
    endpoints: dict = field(default_factory=dict)
    analysis: AnalysisConfig = field(default_factory=AnalysisConfig)

    @property
    def url(self) -> str:
        """Shortcut to server URL"""
        return self.server.url

    @property
    def vision_model(self) -> str:
        """Shortcut to vision model name"""
        return self.models.vision

    @property
    def text_model(self) -> str:
        """Shortcut to text model name"""
        return self.models.text

    @property
    def models_endpoint(self) -> str:
        """Get the models list endpoint based on api_mode"""
        mode_endpoints = self.endpoints.get(self.api_mode, {})
        if self.api_mode == "openai":
            return mode_endpoints.get("models", "/v1/models")
        return mode_endpoints.get("models", "/api/tags")

    @property
    def generate_endpoint(self) -> str:
        """Get the generation endpoint based on api_mode"""
        mode_endpoints = self.endpoints.get(self.api_mode, {})
        if self.api_mode == "openai":
            return mode_endpoints.get("completions", "/v1/chat/completions")
        return mode_endpoints.get("generate", "/api/generate")


def _find_config_path() -> Path:
    """Find the config file path, checking multiple locations"""
    # Check relative to this file (jam/core/llm_config.py -> config/llm.yaml)
    module_dir = Path(__file__).parent.parent.parent  # Go up to project root
    config_path = module_dir / "config" / "llm.yaml"

    if config_path.exists():
        return config_path

    # Check current working directory
    cwd_config = Path.cwd() / "config" / "llm.yaml"
    if cwd_config.exists():
        return cwd_config

    # Check environment variable
    env_path = os.environ.get("JAM_LLM_CONFIG")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    # Return default path (may not exist)
    return config_path


def _load_config_from_file(path: Path) -> dict:
    """Load configuration from YAML file"""
    if not path.exists():
        return {}

    with open(path, "r") as f:
        return yaml.safe_load(f) or {}


def _parse_config(data: dict) -> LLMConfig:
    """Parse raw config dict into LLMConfig dataclass"""
    server_data = data.get("server", {})
    server = ServerConfig(
        url=server_data.get("url", "http://localhost:11434"),
        connect_timeout=server_data.get("connect_timeout", 60.0),
        read_timeout=server_data.get("read_timeout"),
    )

    models_data = data.get("models", {})
    models = ModelsConfig(
        vision=models_data.get("vision", "qwen3-vl:4b"),
        text=models_data.get("text", "llama3.2"),
    )

    analysis_data = data.get("analysis", {})
    analysis = AnalysisConfig(
        concurrency=analysis_data.get("concurrency", 2),
    )

    return LLMConfig(
        server=server,
        models=models,
        api_mode=data.get("api_mode", "ollama"),
        endpoints=data.get("endpoints", {}),
        analysis=analysis,
    )


@lru_cache(maxsize=1)
def get_llm_config() -> LLMConfig:
    """
    Get the LLM configuration (cached).

    Configuration is loaded from config/llm.yaml.
    Call reload_config() to refresh after file changes.
    """
    config_path = _find_config_path()
    data = _load_config_from_file(config_path)
    return _parse_config(data)


def reload_config() -> LLMConfig:
    """Reload configuration from file (clears cache)"""
    get_llm_config.cache_clear()
    return get_llm_config()


# Convenience function for quick access
def get_config() -> LLMConfig:
    """Alias for get_llm_config()"""
    return get_llm_config()

