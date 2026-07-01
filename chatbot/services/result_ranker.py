"""Post-process provider search results for relevance and accuracy."""

from __future__ import annotations

import os

MIN_SIMILARITY = float(os.getenv("CHATBOT_MIN_SIMILARITY", "0.40"))
MAX_RESULTS = int(os.getenv("CHATBOT_MAX_RESULTS", "5"))
STRUCTURED_FETCH_LIMIT = int(os.getenv("CHATBOT_STRUCTURED_LIMIT", "12"))
SEMANTIC_FETCH_LIMIT = int(os.getenv("CHATBOT_SEMANTIC_LIMIT", "15"))


def cities_match(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return True
    return a.strip().lower() == b.strip().lower()


def filter_by_city(results: list[dict], city: str | None) -> list[dict]:
    if not city:
        return results
    return [r for r in results if cities_match(r.get("city"), city)]


def apply_similarity_threshold(
    results: list[dict], min_similarity: float = MIN_SIMILARITY
) -> list[dict]:
    filtered: list[dict] = []
    for row in results:
        sim = row.get("similarity")
        if sim is None:
            filtered.append(row)
            continue
        if sim >= min_similarity:
            filtered.append(row)
    return filtered


def dedupe_results(results: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for row in results:
        key = str(row.get("given_service_id") or row.get("owner_id") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def merge_structured_first(structured: list[dict], semantic: list[dict]) -> list[dict]:
    return dedupe_results([*structured, *semantic])


def trim_results(results: list[dict], max_count: int = MAX_RESULTS) -> list[dict]:
    return results[: max(1, max_count)] if results else []
