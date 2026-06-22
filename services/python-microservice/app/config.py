from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    gemini_api_key: str = ""
    telegram_bot_token: str = ""
    telegram_webhook_url: str = ""
    nodejs_api_url: str = "http://localhost:3000"
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
