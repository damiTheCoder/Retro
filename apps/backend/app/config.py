import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./trading.db"
    OPENROUTER_API_KEY: str = ""
    AI_MODEL: str = "nex-agi/nex-n2.5-pro:free"
    AI_PROVIDER: str = "openrouter"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
