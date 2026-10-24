import os
import secrets
from pydantic_settings import BaseSettings


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings(BaseSettings):
    PROJECT_NAME: str = "GR Sports Badminton Service Platform"
    API_V1_STR: str = "/api"

    # "production" enables strict checks (required secrets, no OTP echo, locked CORS)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # JWT signing key. Required in production; a random per-process key is used in
    # development so tokens simply stop working after a restart.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))  # 7 days

    # Database (local default is SQLite so the app runs without credentials in code)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./badminton.db")

    # Public URL of this API (used to build absolute links to uploaded media).
    # Falls back to the incoming request's base URL when empty.
    PUBLIC_API_URL: str = os.getenv("PUBLIC_API_URL", "")

    # First admin account (logs in with mobile number + password). On startup, if ADMIN_PHONE +
    # ADMIN_PASSWORD are set and that admin has no password yet, the password is set (hashed).
    # Never overwrites an existing password.
    ADMIN_PHONE: str = os.getenv("ADMIN_PHONE", "")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "GR Sports Admin")

    # Customer login codes are sent by SMS through MSG91 (needs an approved DLT OTP template).
    MSG91_AUTH_KEY: str = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_OTP_TEMPLATE_ID: str = os.getenv("MSG91_OTP_TEMPLATE_ID", "")

    # Whether to return the login code in the API response:
    #   "false" - never (production)
    #   "auto"  - only when the SMS could not be sent (e.g. before MSG91/DLT is set up)
    #   "true"  - always (local development / tests)
    # While codes are returned, anyone who knows a customer's mobile number can log in as them.
    EXPOSE_OTP_IN_RESPONSE: str = os.getenv("EXPOSE_OTP_IN_RESPONSE", "false" if os.getenv("ENVIRONMENT", "development").lower() == "production" else "auto").lower()
    OTP_TTL_SECONDS: int = 600
    OTP_MAX_ATTEMPTS: int = 5
    # SMS cost protection: codes per number per 15 minutes, and total codes per day (all numbers)
    OTP_PER_PHONE_LIMIT: int = 3
    SMS_DAILY_LIMIT: int = int(os.getenv("SMS_DAILY_LIMIT", "500"))

    # Uploads
    MAX_UPLOAD_BYTES: int = 8 * 1024 * 1024

    # Site visit records older than this are deleted on startup
    VISIT_RETENTION_DAYS: int = int(os.getenv("VISIT_RETENTION_DAYS", "365"))

    # Shop location (Dondaparthy, Visakhapatnam). Approximate; the admin can set exact
    # coordinates in Distance & Free Radius.
    DEFAULT_SHOP_NAME: str = "GR Sports, Beside Ramalayam Arch, Near Diamond Park, Dondaparthy, Visakhapatnam"
    DEFAULT_SHOP_LAT: float = 17.7283
    DEFAULT_SHOP_LNG: float = 83.3017
    DEFAULT_FREE_RADIUS_KM: float = 10.0
    DEFAULT_PER_KM_RATE: float = 15.0

    # CORS: comma-separated list of allowed frontend origins
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def BACKEND_CORS_ORIGINS(self) -> list[str]:
        return _csv(self.CORS_ORIGINS)

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()

if not settings.SECRET_KEY:
    if settings.is_production:
        raise RuntimeError("SECRET_KEY must be set in production")
    settings.SECRET_KEY = secrets.token_urlsafe(48)

if settings.is_production and "*" in settings.BACKEND_CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS must list explicit origins in production, not '*'")
