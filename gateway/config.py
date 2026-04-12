"""
App configuration — reads from environment variables / .env file.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    comfyui_url: str = "http://comfyui:8188"
    joycaption_url: str = "http://joycaption:8000"
    output_dir: str = "/app/output"
    gateway_api_key: str = ""              # empty = auth disabled
    joycaption_model: str = "fancyfeast/llama-joycaption-beta-one-hf-llava"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
