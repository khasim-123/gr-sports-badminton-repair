import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "GR Sports Badminton Service Platform"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "gr_sports_super_secret_jwt_key_2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./badminton.db")
    
    # Master Shop Location (Indiranagar, Bengaluru)
    DEFAULT_SHOP_NAME: str = "GR Sports Master Hub, 80 Feet Road, Indiranagar, Bengaluru"
    DEFAULT_SHOP_LAT: float = 12.9716
    DEFAULT_SHOP_LNG: float = 77.6412
    DEFAULT_FREE_RADIUS_KM: float = 10.0
    DEFAULT_PER_KM_RATE: float = 15.0
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]

    class Config:
        case_sensitive = True

settings = Settings()
