"""Resolve catalog services from natural language (synonyms + API)."""

from __future__ import annotations

import re

from services.geo_utils import strip_city_from_text
from services.search_service import SearchService

# Profession / colloquial terms → catalog search tokens.
SERVICE_SYNONYMS: dict[str, list[str]] = {
    "electrician": ["electric", "electrical", "electricity", "كهرب", "كهربائي"],
    "plumber": ["plumbing", "plomb", "plombier", "سباك", "plombierie"],
    "cleaner": ["cleaning", "clean", "housekeeping", "تنظيف", "menage"],
    "cleaning": ["clean", "cleaner", "تنظيف"],
    "carpenter": ["carpentry", "wood", "نجار", "menuisier"],
    "painter": ["painting", "paint", "دهان", "peinture"],
    "gardener": ["gardening", "garden", "landscape", "حدائق"],
    "mechanic": ["auto", "car repair", "garage", "mécanicien"],
    "ac": ["air conditioning", "hvac", "cooling", "تكييف", "climatisation"],
    "locksmith": ["lock", "serrurier", "أقفال"],
    "mover": ["moving", "relocation", "نقل", "déménagement"],
    "pest": ["pest control", "exterminator", "مكافحة"],
}

_STOPWORDS = frozenset(
    {
        "i",
        "need",
        "want",
        "find",
        "looking",
        "for",
        "a",
        "an",
        "the",
        "me",
        "please",
        "service",
        "provider",
        "company",
        "near",
        "my",
        "area",
        "local",
        "best",
        "good",
        "cheap",
        "أحتاج",
        "ابحث",
        "عن",
        "خدمة",
        "مزود",
        "شركة",
    }
)


def _tokens(text: str) -> list[str]:
    return [
        t
        for t in re.findall(r"[\w\u0600-\u06FF]+", (text or "").lower())
        if len(t) >= 3 and t not in _STOPWORDS
    ]


def service_search_candidates(raw_query: str, city: str | None = None) -> list[str]:
    """Ordered unique phrases to try against the catalog resolver."""
    base = strip_city_from_text(raw_query, city).strip()
    if not base:
        return []

    candidates: list[str] = []
    seen: set[str] = set()

    def add(q: str) -> None:
        q = q.strip()
        if len(q) < 2:
            return
        key = q.lower()
        if key in seen:
            return
        seen.add(key)
        candidates.append(q)

    add(base)
    lower = base.lower()
    for key, aliases in SERVICE_SYNONYMS.items():
        if key in lower or any(a.lower() in lower for a in aliases):
            add(key)
            for alias in aliases:
                add(alias)

    for token in _tokens(base):
        add(token)
        for key, aliases in SERVICE_SYNONYMS.items():
            if token == key or token in [a.lower() for a in aliases]:
                add(key)
                for alias in aliases[:2]:
                    add(alias)

    return candidates


class ServiceResolver:
    def __init__(self):
        self.search = SearchService()

    async def resolve_service_id(
        self, raw_query: str, locale: str, city: str | None = None
    ) -> str | None:
        for candidate in service_search_candidates(raw_query, city):
            service_id = await self.search.find_service_id(candidate, locale)
            if service_id:
                return service_id
        return None
