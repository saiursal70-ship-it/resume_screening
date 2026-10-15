import os
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"
    DATABASE_URL_SYNC: str = "sqlite:///./app.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    COOKIE_NAME: str = "session_token"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://hr-ai-assistent-5.onrender.com",
        "https://hr-ai-assistant-frontend.onrender.com",
    ]
    UPLOAD_DIR: str = "/app/uploads"
    MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5MB
    USE_FAKE_AI: bool = False

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def upload_path(self) -> Path:
        target_path = Path(self.UPLOAD_DIR)
        try:
            target_path.mkdir(parents=True, exist_ok=True)
            return target_path
        except (PermissionError, OSError):
            local_path = Path(__file__).resolve().parent.parent / "uploads"
            local_path.mkdir(parents=True, exist_ok=True)
            return local_path

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
