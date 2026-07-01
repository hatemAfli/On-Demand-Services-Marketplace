"""Enrich LLM intent with deterministic city and service parsing."""

from __future__ import annotations

from models.search_intent import SearchIntent
from services.geo_utils import extract_city, is_known_city, normalize_city, strip_city_from_text
from services.message_routing import extract_meaningful_query, is_filter_only, is_smalltalk


def enrich_intent(
    intent: SearchIntent, message: str, history: list[dict]
) -> SearchIntent:
    city = normalize_city(intent.city) or extract_city(message)
    if not city:
        for turn in reversed(history):
            if turn.get("role") != "user":
                continue
            city = extract_city(turn.get("content") or "")
            if city:
                break
    if city:
        intent.city = city if is_known_city(city) else extract_city(message)

    query = extract_meaningful_query(intent)
    if not query:
        query = message.strip()

    if query:
        cleaned = strip_city_from_text(query, intent.city)
        if cleaned and not is_smalltalk(cleaned) and not is_filter_only(cleaned):
            intent.service_query = cleaned

    return intent
