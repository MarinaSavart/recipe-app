import json
import types
from typing import Optional

from pydantic_settings import BaseSettings


def _decode_comma_or_json(self, field_name, field, value):
    """
    pydantic-settings attend du JSON pour les champs de type liste. On accepte
    en plus une string séparée par des virgules (ex: "http://a,http://b"),
    format plus lisible pour un .env, en repli si ce n'est pas du JSON valide.
    """
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    DEBUG: bool = False

    DATABASE_URL: str
    ANTHROPIC_API_KEY: Optional[str] = None

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    # Durée de vie du token en minutes (10080 = 7 jours)
    # À réduire en production si un mécanisme de refresh token est mis en place
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    GOOGLE_CLIENT_ID: Optional[str] = None

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings):
        for source in (env_settings, dotenv_settings):
            source.decode_complex_value = types.MethodType(_decode_comma_or_json, source)
        return init_settings, env_settings, dotenv_settings, file_secret_settings


settings = Settings()
