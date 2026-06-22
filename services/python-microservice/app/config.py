from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    
    # Google Gemini (optional)
    gemini_api_key: str = ""
    
    # Telegram Bot (webhook)
    telegram_bot_token: str = ""
    telegram_webhook_url: str = ""
    
    # Telegram User Account (Telethon scraper)
    telegram_api_id: str = ""
    telegram_api_hash: str = ""
    telegram_phone: str = ""
    telegram_session: str = ""
    
    # Node.js API URL (for forwarding)
    nodejs_api_url: str = "http://localhost:3000"
    
    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
