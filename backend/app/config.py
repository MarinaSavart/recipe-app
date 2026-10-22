from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    ANTHROPIC_API_KEY: Optional[str] = None

    # LLM (OpenRouter)
    OPENROUTER_API_KEY: str
    OPENROUTER_MODEL: str = "nvidia/nemotron-3-super-120b-a12b:free"

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    GOOGLE_CLIENT_ID: Optional[str] = None

    # CORS — comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    # Optional regex for dynamic origins (e.g. Vercel preview deployments)
    ALLOWED_ORIGIN_REGEX: Optional[str] = None

    # Netscape cookies file for yt-dlp, used instead of browser cookies
    # when set (e.g. on a server without a browser)
    COOKIES_FILE: Optional[str] = None

    class Config:
        env_file = ".env"


settings = Settings()