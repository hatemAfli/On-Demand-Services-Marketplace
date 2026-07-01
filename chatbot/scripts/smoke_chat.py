"""Quick manual E2E check against the running Python chatbot (loads .env)."""

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from services.llm_service import LLMService


async def main() -> int:
    svc = LLMService()
    cases = [
        ("Hi", "en", 0),
        ("Hello", "en", 0),
        ("Top rated", "en", 0),
        ("How do I cancel a booking?", "en", 0),
        ("I need a plumber", "en", None),
    ]

    failed = 0
    for message, locale, max_providers in cases:
        resp = await svc.process_message(f"e2e-{message[:8]}", message, locale)
        n = len(resp.providers)
        ok = n == max_providers if max_providers is not None else n >= 0
        status = "OK" if ok else "FAIL"
        if not ok:
            failed += 1
        print(
            f"[{status}] {message!r} -> providers={n}, "
            f"msg={resp.message[:80]!r}..."
        )
        if resp.suggestions:
            print(f"       suggestions={resp.suggestions[:2]}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
