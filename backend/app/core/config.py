from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    SECRET_KEY: str = "changeme-use-random-string-in-production"
    DATABASE_PATH: str = "/data/ratioguard.db"

    # Transmission
    TRANSMISSION_URL: str = "http://localhost:9091/transmission/rpc"
    TRANSMISSION_USER: str = ""
    TRANSMISSION_PASS: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
