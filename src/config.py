import os

class Config:
    raw_uri = os.environ.get("DATABASE_URL")

    if raw_uri and raw_uri.startswith("postgres://"):
        raw_uri = raw_uri.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = raw_uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get("SECRET_KEY", "default-secret")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "default-jwt-secret")
    
    # Telegram integration settings
    TELEGRAM_ENABLED = os.getenv("TELEGRAM_ENABLED", "true").lower() == "true"
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    APP_BASE_URL = os.getenv("APP_BASE_URL", "https://v3-app.herokuapp.com")
    TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID")
    TELEGRAM_ADMIN_THREAD_ID = os.getenv("TELEGRAM_ADMIN_THREAD_ID")

    # VAT
    VAT_DEFAULT_RATE = float(os.getenv('VAT_DEFAULT_RATE', '0.20'))