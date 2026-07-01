"""City-scoped search behavior tests."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.search_intent import SearchIntent
from services.llm_service import LLMService


def _provider_row(city: str, pid: str) -> dict:
    return {
        "given_service_id": pid,
        "service_id": "svc-1",
        "owner_id": f"owner-{pid}",
        "owner_type": "PROVIDER",
        "service_name": "Electrical",
        "category_name": "Home",
        "provider_name": f"Tech {city}",
        "city": city,
        "price": 50.0,
        "pricing_type": "FIXED",
        "average_rating": 4.5,
        "total_reviews": 10,
        "is_top_provider": False,
    }


@pytest.fixture
def service():
    svc = LLMService()
    svc.store = MagicMock()
    svc.store.get_history.return_value = []
    return svc


@pytest.mark.asyncio
async def test_electrician_in_tunis_filters_other_cities(service):
    mixed = [_provider_row("Tunis", "1"), _provider_row("Sfax", "2")]
    service.service_resolver.resolve_service_id = AsyncMock(return_value="svc-1")
    service.search_service.search_by_service_id = AsyncMock(return_value=mixed)
    service.embedding_service.semantic_search = AsyncMock(return_value=[])

    intent = SearchIntent(
        service_query="Electrician",
        city="Tunis",
        confidence=0.9,
    )
    with patch.object(service, "_extract_intent", AsyncMock(return_value=intent)):
        response = await service.process_message(
            "sess-city", "Electrician in Tunis", "en"
        )

    assert all(p.city == "Tunis" for p in response.providers)
    assert len(response.providers) <= 5
    assert "Tunis" in response.message
