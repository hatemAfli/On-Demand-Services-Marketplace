"""City extraction and normalization (Tunisia)."""

from __future__ import annotations

import re
import unicodedata

# Canonical names match provider seed data (backend/prisma/seed-providers.ts).
CITY_ALIASES: dict[str, str] = {
    "tunis": "Tunis",
    "tunis city": "Tunis",
    "tunisia capital": "Tunis",
    "تونس": "Tunis",
    "tunisie": "Tunis",
    "sfax": "Sfax",
    "صفاقس": "Sfax",
    "sousse": "Sousse",
    "سوسة": "Sousse",
    "kairouan": "Kairouan",
    "القيروان": "Kairouan",
    "bizerte": "Bizerte",
    "بنزرت": "Bizerte",
    "gabes": "Gabes",
    "gabès": "Gabes",
    "قابس": "Gabes",
    "ariana": "Ariana",
    "أريانة": "Ariana",
    "gafsa": "Gafsa",
    "قفصة": "Gafsa",
    "monastir": "Monastir",
    "المنستير": "Monastir",
    "ben arous": "Ben Arous",
    "ben-arous": "Ben Arous",
    "بن عروس": "Ben Arous",
    "nabeul": "Nabeul",
    "نابل": "Nabeul",
    "mahdia": "Mahdia",
    "المهدية": "Mahdia",
}

_CITY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(CITY_ALIASES, key=len, reverse=True)) + r")\b",
    re.IGNORECASE | re.UNICODE,
)

_IN_CITY = re.compile(
    r"(?:\b(?:in|at|near|around|à|en|dans|في|ب(?:ـ)?)\s+)([a-zA-Z\u0600-\u06FF][\w\s\-']{1,30})",
    re.IGNORECASE | re.UNICODE,
)

_KNOWN_CITIES = frozenset(CITY_ALIASES.values())


def is_known_city(name: str | None) -> bool:
    if not name:
        return False
    return normalize_city(name) in _KNOWN_CITIES


def _fold(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower().strip()


def normalize_city(raw: str | None) -> str | None:
    if not raw:
        return None
    key = _fold(raw)
    if key in CITY_ALIASES:
        return CITY_ALIASES[key]
    for alias, canonical in CITY_ALIASES.items():
        if _fold(alias) == key:
            return canonical
    # Title-case unknown city as-is (still used for strict filter).
    return raw.strip().title() if raw.strip() else None


def extract_city(message: str) -> str | None:
    text = message or ""
    match = _IN_CITY.search(text)
    if match:
        candidate = match.group(1).strip(" .,!؟?")
        normalized = normalize_city(candidate)
        if normalized and is_known_city(normalized):
            return normalized

    for m in _CITY_PATTERN.finditer(text):
        normalized = normalize_city(m.group(1))
        if normalized and is_known_city(normalized):
            return normalized
    return None


def strip_city_from_text(text: str, city: str | None) -> str:
    if not text:
        return text
    cleaned = text
    if city:
        for variant in {city, city.lower(), _fold(city)}:
            cleaned = re.sub(
                rf"\b(?:in|at|near|around|à|a|en|dans|في|ب)\s+{re.escape(variant)}\b",
                "",
                cleaned,
                flags=re.IGNORECASE | re.UNICODE,
            )
            cleaned = re.sub(
                rf"\b{re.escape(variant)}\b",
                "",
                cleaned,
                flags=re.IGNORECASE | re.UNICODE,
            )
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" ,.-")
    return cleaned or text.strip()
