import os
from functools import lru_cache

from supabase import create_client

from services.ai_client import get_embed_model, get_openrouter_client


@lru_cache
def _get_supabase():
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)


class EmbeddingService:
    async def embed_text(self, text: str) -> list[float]:
        client = get_openrouter_client()
        model = get_embed_model()
        response = await client.embeddings.create(model=model, input=text)
        return response.data[0].embedding

    async def semantic_search(
        self,
        query: str,
        city: str | None = None,
        min_rating: float | None = None,
        max_price: float | None = None,
        is_available: bool | None = None,
        owner_type: str | None = None,
        limit: int = 8,
    ) -> list[dict]:
        vector = await self.embed_text(query)

        supabase = _get_supabase()
        if supabase is None:
            return []

        result = supabase.rpc(
            "match_providers",
            {
                "query_embedding": vector,
                "match_count": limit,
                "filter_city": city,
                "filter_min_rating": min_rating,
                "filter_available": is_available,
                "filter_max_price": max_price,
                "filter_owner_type": owner_type,
            },
        ).execute()

        if not result.data:
            return []

        return [
            {
                "given_service_id": row["given_service_id"],
                "owner_id": row["owner_id"],
                "owner_type": row["owner_type"],
                "service_id": row["service_id"],
                "service_name": row["service_name"],
                "category_name": row["category_name"],
                "city": row["city"],
                "price": row["price"],
                "pricing_type": row["pricing_type"],
                "average_rating": row["average_rating"],
                "total_reviews": row["total_reviews"],
                "is_top_provider": row["is_top_provider"],
                "similarity": row["similarity"],
                "provider_name": row.get("provider_name") or "Provider",
                "photo_url": row.get("photo_url"),
                "tagline": row.get("tagline"),
            }
            for row in result.data
        ]
