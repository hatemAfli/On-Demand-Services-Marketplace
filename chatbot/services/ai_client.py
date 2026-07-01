import os
from openai import AsyncOpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def get_openrouter_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. "
            "Create a key at https://openrouter.ai/settings/keys"
        )
    return AsyncOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=api_key,
        default_headers={
            "HTTP-Referer": os.getenv(
                "OPENROUTER_SITE_URL", "http://localhost:3000"
            ),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "ServeMe Marketplace"),
        },
    )


def get_chat_model() -> str:
    return os.getenv(
        "OPENROUTER_CHAT_MODEL",
        "meta-llama/llama-3.2-3b-instruct:free",
    )


def get_embed_model() -> str:
    return os.getenv(
        "OPENROUTER_EMBED_MODEL",
        "openai/text-embedding-3-small",
    )
