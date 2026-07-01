import os

import httpx
from models.search_intent import SearchIntent

NESTJS_URL = os.getenv("NESTJS_API_URL", "http://localhost:3000").rstrip("/")
CHATBOT_SECRET = os.getenv("NESTJS_CHATBOT_SECRET", "")
NESTJS_API_PREFIX = "/api"


class SearchService:
    def _service_url(self) -> str:
        return f"{NESTJS_URL}{NESTJS_API_PREFIX}/chatbot/service"

    def _headers(self) -> dict:
        return {"X-Chatbot-Secret": CHATBOT_SECRET}

    async def _post_service(self, payload: dict) -> dict | None:
        if not CHATBOT_SECRET:
            return None
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                self._service_url(),
                json=payload,
                headers=self._headers(),
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            return data if isinstance(data, dict) else None

    async def find_service_id(self, query: str, locale: str = "en") -> str | None:
        data = await self._post_service(
            {
                "action": "resolve-service",
                "query": query.strip(),
                "locale": locale,
            }
        )
        if not data:
            return None
        service_id = data.get("serviceId")
        return service_id if service_id else None

    async def search_providers(
        self, intent: SearchIntent, locale: str = "en", *, limit: int = 12
    ) -> list[dict]:
        query = intent.service_query or intent.category_hint
        if not query:
            return []

        service_id = await self.find_service_id(query, locale)
        if not service_id:
            return []

        return await self.search_by_service_id(service_id, intent, locale, limit=limit)

    async def search_by_service_id(
        self,
        service_id: str,
        intent: SearchIntent,
        locale: str = "en",
        *,
        limit: int = 12,
    ) -> list[dict]:
        search_params: dict = {
            "serviceId": service_id,
            "locale": "AR" if locale.startswith("ar") else "EN",
            "limit": limit,
        }
        if intent.city:
            search_params["city"] = intent.city
        if intent.max_price is not None:
            search_params["maxPrice"] = intent.max_price
        if intent.min_rating is not None:
            search_params["minRating"] = intent.min_rating
        if intent.is_available_immediately:
            search_params["isAvailableImmediately"] = True
        if intent.is_top_provider:
            search_params["isTopProvider"] = True
        if intent.owner_type in ("PROVIDER", "COMPANY"):
            search_params["ownerType"] = intent.owner_type
        if intent.sort:
            search_params["sort"] = intent.sort

        data = await self._post_service(
            {
                "action": "search",
                "search": search_params,
            }
        )
        if not data:
            return []

        items = data.get("items") or []
        mapped = []
        for item in items:
            owner = item.get("owner") or {}
            mapped.append(
                {
                    "given_service_id": item.get("givenServiceId"),
                    "owner_id": owner.get("id"),
                    "owner_type": owner.get("type", "PROVIDER"),
                    "service_id": item.get("serviceId"),
                    "service_name": item.get("serviceName", ""),
                    "category_name": item.get("categoryName", ""),
                    "city": owner.get("city", ""),
                    "price": item.get("price", 0),
                    "pricing_type": item.get("pricingType", "FIXED"),
                    "average_rating": item.get("averageRating", 0),
                    "total_reviews": item.get("totalReviews", 0),
                    "is_top_provider": owner.get("isTopProvider", False),
                    "similarity": None,
                    "provider_name": owner.get("displayName", "Provider"),
                    "photo_url": owner.get("photoUrl"),
                    "tagline": owner.get("tagline"),
                }
            )
        return mapped
