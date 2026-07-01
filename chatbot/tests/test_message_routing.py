"""Unit tests for chatbot message routing (no API keys required)."""

from models.search_intent import SearchIntent
from services.message_routing import (
    extract_meaningful_query,
    has_service_hint,
    history_has_service_context,
    is_filter_only,
    is_greeting,
    is_smalltalk,
    should_search,
    welcome_suggestions,
)


def test_greeting_detected():
    assert is_greeting("Hi")
    assert is_greeting("Hello!")
    assert is_greeting("hey")
    assert is_greeting("مرحبا")
    assert not is_greeting("I need a plumber")
    assert not is_greeting("Hi, I need a plumber")


def test_smalltalk_should_not_search():
    intent = SearchIntent(service_query="hi", confidence=0.9)
    assert not should_search(intent, "Hi", [])
    assert not should_search(intent, "Hello", [])


def test_service_request_should_search():
    intent = SearchIntent(service_query="plumber", confidence=0.9)
    assert should_search(intent, "I need a plumber", [])


def test_filter_only_without_context_should_not_search():
    intent = SearchIntent(service_query="top rated", confidence=0.8)
    assert is_filter_only("Top rated")
    assert not should_search(intent, "Top rated", [])


def test_filter_with_history_can_search():
    history = [{"role": "user", "content": "I need a plumber"}]
    intent = SearchIntent(sort="RATING_DESC", confidence=0.8)
    assert history_has_service_context(history)
    assert should_search(intent, "Top rated", history)


def test_extract_meaningful_query_rejects_greeting():
    intent = SearchIntent(service_query="hello", category_hint=None)
    assert extract_meaningful_query(intent) is None


def test_service_hint_in_message():
    assert has_service_hint("I need an electrician")
    assert not has_service_hint("Hi")


def test_welcome_suggestions_are_service_examples():
    en = welcome_suggestions("en")
    assert any("plumb" in s.lower() for s in en)
    assert not any(s == "Top rated" for s in en)


def test_greeting_plus_service_in_one_message():
    msg = "Hi, I need a plumber"
    assert not is_smalltalk(msg)
    assert has_service_hint(msg)
