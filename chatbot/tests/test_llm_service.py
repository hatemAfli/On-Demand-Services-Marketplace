"""LLM service routing tests (mocked — no OpenRouter calls)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.search_intent import SearchIntent
from services.llm_service import LLMService


def _provider_row(name: str = "Joe Plumber") -> dict:
    return {
        "given_service_id": "gs-1",
        "service_id": "svc-1",
        "owner_id": "owner-1",
        "owner_type": "PROVIDER",
        "service_name": "Plumbing",
        "category_name": "Home",
        "provider_name": name,
        "city": "Tunis",
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
async def test_hi_returns_welcome_without_providers(service):
    response = await service.process_message("sess-1", "Hi", "en")
    assert response.providers == []
    assert "ServeMe" in response.message or "service" in response.message.lower()
    assert any("plumb" in s.lower() for s in response.suggestions)


@pytest.mark.asyncio
async def test_service_request_triggers_search(service):
    fake_results = [_provider_row()]
    service.service_resolver.resolve_service_id = AsyncMock(return_value="svc-1")
    service.search_service.search_by_service_id = AsyncMock(return_value=fake_results)
    service.embedding_service.semantic_search = AsyncMock(return_value=[])

    with patch.object(
        service,
        "_extract_intent",
        AsyncMock(
            return_value=SearchIntent(service_query="plumber", confidence=0.9)
        ),
    ):
        response = await service.process_message("sess-2", "I need a plumber", "en")

    assert len(response.providers) >= 1
    service.search_service.search_by_service_id.assert_awaited_once()


@pytest.mark.asyncio
async def test_llm_mislabels_hi_still_no_search(service):
    bad_intent = SearchIntent(service_query="hi", confidence=0.9)

    with patch.object(service, "_extract_intent", AsyncMock(return_value=bad_intent)):
        response = await service.process_message("sess-3", "Hi", "en")

    assert response.providers == []
