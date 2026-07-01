"""Answer general questions about ServeMe using FAQ + app knowledge."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from prompts.app_assistant import APP_ASSISTANT_SYSTEM, APP_ASSISTANT_USER
from services.ai_client import get_chat_model, get_openrouter_client

_APP_QUESTION = re.compile(
    r"(?:"
    r"\bhow\s+(?:do|does|can|to|much)\b|"
    r"\bwhat\s+(?:is|are|does)\b|"
    r"\bwhere\s+(?:is|can|do)\b|"
    r"\bwhen\s+(?:can|do|is)\b|"
    r"\bwhy\s+(?:is|do|can't|cannot)\b|"
    r"\b(?:payment|pay|cancel|refund|book(?:ing)?|appointment|register|sign\s*up|"
    r"account|review|rating|complaint|verify|verification|fee|commission|payout|"
    r"wallet|invoice|support|help|contact|privacy|terms|policy)\b|"
    r"\bserveme\b|\bmarketplace\b|\bplatform\b|\bthe\s+app\b"
    r")",
    re.IGNORECASE | re.UNICODE,
)


def is_app_question(message: str, *, has_service_intent: bool = False) -> bool:
    text = (message or "").strip()
    if len(text) < 4:
        return False
    if has_service_intent and _APP_QUESTION.search(text) is None:
        return False
    # Pure service search: "electrician in Tunis" — not an app question.
    if has_service_intent and not re.search(
        r"\b(?:how|what|where|when|why|payment|cancel|refund|book|account|fee)\b",
        text,
        re.I,
    ):
        return False
    return bool(_APP_QUESTION.search(text))


def _score_faq(question: str, user_message: str) -> float:
    q = question.lower()
    m = user_message.lower()
    if q in m or m in q:
        return 1.0
    return SequenceMatcher(None, q, m).ratio()


class FaqAssistant:
    def __init__(self):
        self._cache: dict[str, list[dict]] = {}

    async def load_faq(
        self, locale: str, *, preloaded: list[dict] | None = None
    ) -> list[dict]:
        if isinstance(preloaded, list) and preloaded:
            return preloaded
        lang = "ar" if locale.startswith("ar") else "en"
        if lang in self._cache:
            return self._cache[lang]
        return []

    def match_faq(self, message: str, faq_items: list[dict]) -> tuple[str, float] | None:
        best_answer = ""
        best_score = 0.0
        for item in faq_items:
            question = (item.get("question") or "").strip()
            answer = (item.get("answer") or "").strip()
            if not question or not answer:
                continue
            score = _score_faq(question, message)
            if score > best_score:
                best_score = score
                best_answer = answer
        if best_score >= 0.52 and best_answer:
            return best_answer, best_score
        return None

    async def _llm_answer(
        self, message: str, locale: str, faq_items: list[dict], history: list[dict]
    ) -> str:
        faq_snippets = "\n".join(
            f"- Q: {i.get('question', '')}\n  A: {i.get('answer', '')}"
            for i in faq_items[:12]
        )
        hist = "\n".join(
            f"{h.get('role')}: {h.get('content')}"
            for h in history[-4:]
            if h.get("content")
        )
        user_prompt = APP_ASSISTANT_USER.format(
            faq=faq_snippets or "(none)",
            history=hist or "(none)",
            message=message,
            locale=locale,
        )
        client = get_openrouter_client()
        response = await client.chat.completions.create(
            model=get_chat_model(),
            messages=[
                {"role": "system", "content": APP_ASSISTANT_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=400,
        )
        return (response.choices[0].message.content or "").strip()

    async def answer(
        self,
        message: str,
        locale: str,
        history: list[dict],
        *,
        faq_items: list[dict] | None = None,
    ) -> str | None:
        loaded = await self.load_faq(locale, preloaded=faq_items)
        matched = self.match_faq(message, loaded)
        if matched:
            return matched[0]
        try:
            return await self._llm_answer(message, locale, loaded, history)
        except Exception:
            if locale.startswith("ar"):
                return (
                    "يمكنني مساعدتك في العثور على مزودي خدمات. "
                    "لأسئلة الحساب والحجز والدفع، راجع قسم المساعدة في التطبيق."
                )
            return (
                "I can help you find service providers. "
                "For account, booking, and payment questions, check the Help section in the app."
            )
