from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    ANTHROPIC_API_KEY: Optional[str] = None

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    GOOGLE_CLIENT_ID: Optional[str] = None

    class Config:
        env_file = ".env"


settings = Settings()