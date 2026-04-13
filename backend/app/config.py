from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    ANTHROPIC_API_KEY: Optional[str] = None 

    class Config:
        env_file = ".env"


settings = Settings()