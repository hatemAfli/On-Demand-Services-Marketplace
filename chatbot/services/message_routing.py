"""Rule-based routing before provider search (greetings, thanks, vague messages)."""

from __future__ import annotations

import re

from models.search_intent import SearchIntent
from services.geo_utils import extract_city

# Standalone greetings / small talk — must not trigger provider search.
_GREETING = re.compile(
    r"^(?:"
    r"hi|hello|hey|yo|sup|hiya|howdy|greetings|"
    r"good\s+(?:morning|afternoon|evening|night)|"
    r"salut|bonjour|coucou|bonsoir|"
    r"marhaba|mar7aba|ahlan|salam|assalamu?\s*alaikum|"
    r"مرحبا|مرحباً|أهلا|أهلاً|السلام|سلام|"
    r"صباح(?:\s+ال)?(?:خير|نور)|مساء(?:\s+ال)?(?:خير|نور)"
    r")(?:[\s!.?،,…]*)*$",
    re.IGNORECASE | re.UNICODE,
)

_THANKS = re.compile(
    r"^(?:"
    r"thanks?(?:\s+you)?|thank\s+you|thx|ty|"
    r"merci|shukran|جزاك\s+الله\s+خير|شكرا|شكراً"
    r")(?:[\s!.?،,…]*)*$",
    re.IGNORECASE | re.UNICODE,
)

_ACK = re.compile(
    r"^(?:ok(?:ay)?|yes|yep|yeah|sure|alright|got\s+it|understood|"
    r"حسنا|حسناً|تمام|نعم|اوكي"
    r")(?:[\s!.?،,…]*)*$",
    re.IGNORECASE | re.UNICODE,
)

# Refinement-only phrases with no service noun — not enough to search alone.
_FILTER_ONLY = re.compile(
    r"^(?:"
    r"top\s+rated|cheapest|lowest\s+price|highest\s+rated|"
    r"available\s+now|show\s+companies|independent\s+providers|"
    r"الأعلى\s+تقييماً|الأرخص|متاح\s+الآن|عرض\s+الشركات|مزودون\s+مستقلون"
    r")(?:[\s!.?،,…]*)*$",
    re.IGNORECASE | re.UNICODE,
)

_SERVICE_HINT = re.compile(
    r"\b(?:"
    r"plumb|electric|clean|paint|repair|install|fix|ac\b|hvac|"
    r"carpent|gardenc|mov(e|ing)|delivery|pest|locksmith|"
    r"نجار|سباك|كهرب|تنظيف|دهان|تكييف|صيانة|نقل"
    r")",
    re.IGNORECASE | re.UNICODE,
)


def is_greeting(message: str) -> bool:
    text = message.strip()
    return len(text) <= 80 and bool(_GREETING.match(text))


def is_thanks(message: str) -> bool:
    text = message.strip()
    return len(text) <= 80 and bool(_THANKS.match(text))


def is_ack_only(message: str) -> bool:
    text = message.strip()
    return len(text) <= 40 and bool(_ACK.match(text))


def is_filter_only(message: str) -> bool:
    text = message.strip()
    return bool(_FILTER_ONLY.match(text))


def is_smalltalk(message: str) -> bool:
    return is_greeting(message) or is_thanks(message) or is_ack_only(message)


def history_has_service_context(history: list[dict]) -> bool:
    """True if a prior user turn looked like a service request."""
    for turn in history:
        if turn.get("role") != "user":
            continue
        content = (turn.get("content") or "").strip()
        if not content or is_smalltalk(content):
            continue
        if _SERVICE_HINT.search(content):
            return True
        if len(content.split()) >= 2 and not is_filter_only(content):
            return True
    return False


def extract_meaningful_query(intent: SearchIntent) -> str | None:
    for candidate in (intent.service_query, intent.category_hint):
        if not candidate:
            continue
        q = candidate.strip()
        if len(q) < 2:
            continue
        if is_smalltalk(q) or is_filter_only(q):
            continue
        return q
    return None


def last_service_query_from_history(history: list[dict]) -> str | None:
    """Best-effort service text from prior user turns (for refinement messages)."""
    for turn in reversed(history):
        if turn.get("role") != "user":
            continue
        content = (turn.get("content") or "").strip()
        if not content or is_smalltalk(content) or is_filter_only(content):
            continue
        if has_service_hint(content) or len(content.split()) >= 2:
            return content
    return None


def should_search(intent: SearchIntent, message: str, history: list[dict]) -> bool:
    has_city = bool(intent.city or extract_city(message))
    has_service = bool(extract_meaningful_query(intent)) or bool(
        _SERVICE_HINT.search(message)
    )

    if intent.needs_clarification and not (has_city and has_service):
        return False
    if is_smalltalk(message) and not history_has_service_context(history):
        return False
    if is_filter_only(message):
        return history_has_service_context(history)
    query = extract_meaningful_query(intent)
    if query:
        return True
    if _SERVICE_HINT.search(message):
        return True
    return False


def welcome_reply(locale: str) -> str:
    if locale.startswith("ar"):
        return (
            "مرحباً! أنا مساعد ServeMe. "
            "أخبرني بالخدمة التي تحتاجها (مثلاً: سبّاك، تنظيف، كهربائي…) "
            "وسأعرض لك أفضل المزودين والشركات."
        )
    return (
        "Hi! I'm your ServeMe assistant. "
        "Tell me what service you need (e.g. plumber, cleaning, electrician) "
        "and I'll find the best providers and companies for you."
    )


def thanks_reply(locale: str) -> str:
    if locale.startswith("ar"):
        return "العفو! هل تحتاج مساعدة في خدمة أخرى؟"
    return "You're welcome! Need help finding another service?"


def clarification_reply(locale: str) -> str:
    if locale.startswith("ar"):
        return "ما الخدمة التي تبحث عنها؟ يمكنك ذكر نوع الخدمة أو المدينة."
    return "What service are you looking for? You can mention the type of service or your city."


def ack_without_context_reply(locale: str) -> str:
    if locale.startswith("ar"):
        return "حسناً! ما الخدمة التي تريد البحث عنها؟"
    return "Sure! What service would you like me to search for?"


def conversational_reply(message: str, locale: str, history: list[dict]) -> str:
    if is_greeting(message) and not history_has_service_context(history):
        return welcome_reply(locale)
    if is_thanks(message):
        return thanks_reply(locale)
    if is_ack_only(message) and not history_has_service_context(history):
        return ack_without_context_reply(locale)
    if is_filter_only(message) and not history_has_service_context(history):
        return clarification_reply(locale)
    return clarification_reply(locale)


def welcome_suggestions(locale: str) -> list[str]:
    if locale.startswith("ar"):
        return [
            "أحتاج سبّاك",
            "ابحث عن شركة تنظيف",
            "إصلاح مكيّف",
            "كهربائي في تونس",
        ]
    return [
        "I need a plumber",
        "Find a cleaning company",
        "AC repair near me",
        "Electrician in Tunis",
    ]


def has_service_hint(message: str) -> bool:
    return bool(_SERVICE_HINT.search(message or ""))


def search_refine_suggestions(locale: str) -> list[str]:
    if locale.startswith("ar"):
        return ["الأعلى تقييماً", "الأرخص", "متاح الآن", "عرض الشركات"]
    return ["Top rated", "Cheapest", "Available now", "Show companies"]
