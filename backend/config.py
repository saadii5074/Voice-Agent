"""
config.py — Application configuration via environment variables.
Uses pydantic-settings for typed, validated settings with .env support.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, computed_field
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Deepgram ──────────────────────────────────────────────────────────────
    deepgram_api_key: str = Field(
        ...,
        description="Deepgram API key (required)",
    )

    # ── Server ────────────────────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0", description="Bind host")
    port: int = Field(default=8000, description="Bind port")

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Stored as a plain string from env to avoid pydantic-settings JSON parsing issues
    cors_origins_str: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
        description="Comma-separated list of allowed CORS origins",
    )

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        return [s.strip() for s in self.cors_origins_str.split(",") if s.strip()]

    # ── Deepgram streaming defaults ───────────────────────────────────────────
    deepgram_model: str = Field(default="nova-2-general", description="Deepgram model — nova-2-general supports Urdu/Hindi with diarization")
    deepgram_language: str = Field(
        default="hi", description="Deepgram language — 'hi' for Hindustani (covers Urdu+Hindi), nova-2-meeting does NOT support ur"
    )
    deepgram_sample_rate: int = Field(default=16000, description="Audio sample rate")
    deepgram_channels: int = Field(default=1, description="Audio channels")
    deepgram_encoding: str = Field(
        default="linear16", description="Audio encoding format"
    )


# Module-level singleton — import `settings` everywhere else
settings = Settings()
