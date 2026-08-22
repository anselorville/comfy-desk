"""
App configuration — reads from environment variables / repo-root .env file.
"""
from pathlib import Path

from pydantic_settings import BaseSettings

_ROOT_ENV = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    comfyui_url: str = "http://comfyui:8188"
    joycaption_url: str = "http://joycaption:8000"
    output_dir: str = "/app/output"
    gateway_api_key: str = ""              # empty = auth disabled
    joycaption_model: str = "fancyfeast/llama-joycaption-beta-one-hf-llava"
    dataset_dir: str = "/app/dataset"
    agent_llm_base_url: str = ""           # OpenAI-compatible base, e.g. https://api.deepseek.com/v1
    agent_llm_api_key: str = ""
    agent_llm_model: str = ""
    agent_llm_mock: bool = False

    class Config:
        env_file = _ROOT_ENV
        extra = "ignore"


settings = Settings()
