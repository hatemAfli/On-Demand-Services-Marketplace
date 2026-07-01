"""Tests for city extraction and result filtering."""

from services.geo_utils import extract_city, normalize_city, strip_city_from_text
from services.result_ranker import filter_by_city, trim_results


def test_no_false_city_from_article():
    assert extract_city("I need a plumber") is None


def test_extract_city_tunis():
    assert extract_city("Electrician in Tunis") == "Tunis"
    assert extract_city("كهربائي في تونس") == "Tunis"


def test_strip_city_from_query():
    assert strip_city_from_text("Electrician in Tunis", "Tunis") == "Electrician"


def test_filter_by_city_strict():
    results = [
        {"given_service_id": "1", "city": "Tunis"},
        {"given_service_id": "2", "city": "Sfax"},
    ]
    filtered = filter_by_city(results, "Tunis")
    assert len(filtered) == 1
    assert filtered[0]["city"] == "Tunis"


def test_trim_results_not_always_eight():
    results = [{"given_service_id": str(i), "city": "Tunis"} for i in range(8)]
    assert len(trim_results(results, 5)) == 5
    assert len(trim_results(results[:2], 5)) == 2


def test_normalize_city_aliases():
    assert normalize_city("tunis") == "Tunis"
    assert normalize_city("صفاقس") == "Sfax"
