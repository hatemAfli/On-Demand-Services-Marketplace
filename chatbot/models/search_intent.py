from pydantic import BaseModel
from typing import Optional


class SearchIntent(BaseModel):
    service_query: Optional[str] = None
    category_hint: Optional[str] = None
    city: Optional[str] = None
    max_price: Optional[float] = None
    min_rating: Optional[float] = None
    sort: Optional[str] = None
    is_available_immediately: Optional[bool] = None
    is_top_provider: Optional[bool] = None
    owner_type: Optional[str] = None  # "PROVIDER" | "COMPANY" | None
    prefer_company: Optional[bool] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    confidence: float = 1.0
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
