from pydantic import BaseModel
from typing import Optional, List, Any


class ChatRequest(BaseModel):
    session_id: str
    message: str
    locale: str = "en"
    history: List[dict[str, Any]] = []
    faq: List[dict[str, Any]] = []


class ProviderResult(BaseModel):
    given_service_id: str
    service_id: str
    owner_id: str
    owner_type: str  # "PROVIDER" | "COMPANY"
    service_name: str
    category_name: str
    provider_name: str
    city: str
    price: float
    pricing_type: str
    average_rating: float
    total_reviews: int
    is_top_provider: bool
    similarity: Optional[float] = None
    photo_url: Optional[str] = None
    tagline: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    message: str
    providers: List[ProviderResult] = []
    intent_detected: bool = True
    fallback: bool = False
    suggestions: List[str] = []


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: List[float]
