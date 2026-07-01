import json

from models.chat_models import ChatResponse, ProviderResult
from models.search_intent import SearchIntent
from prompts.intent_extraction import (
    INTENT_SYSTEM_PROMPT,
    INTENT_USER_TEMPLATE,
)
from services.ai_client import get_chat_model, get_openrouter_client
from services.conversation_store import ConversationStore
from services.embedding_service import EmbeddingService
from services.faq_assistant import FaqAssistant, is_app_question
from services.geo_utils import extract_city, is_known_city, normalize_city, strip_city_from_text
from services.intent_enricher import enrich_intent
from services.message_routing import (
    conversational_reply,
    extract_meaningful_query,
    has_service_hint,
    history_has_service_context,
    last_service_query_from_history,
    is_filter_only,
    is_smalltalk,
    is_thanks,
    search_refine_suggestions,
    should_search,
    welcome_suggestions,
)
from services.result_ranker import (
    MAX_RESULTS,
    SEMANTIC_FETCH_LIMIT,
    STRUCTURED_FETCH_LIMIT,
    apply_similarity_threshold,
    dedupe_results,
    filter_by_city,
    merge_structured_first,
    trim_results,
)
from services.search_service import SearchService
from services.service_resolver import ServiceResolver


class LLMService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.search_service = SearchService()
        self.service_resolver = ServiceResolver()
        self.faq_assistant = FaqAssistant()
        self.store = ConversationStore()

    async def process_message(
        self,
        session_id: str,
        message: str,
        locale: str = "en",
        history: list | None = None,
        faq_items: list | None = None,
    ) -> ChatResponse:
        message = message.strip()
        if not message:
            reply = conversational_reply("", locale, [])
            return self._conversational_response(session_id, locale, reply)

        self.store.bind_history(history)
        faq_cache = faq_items if isinstance(faq_items, list) else []
        history_rows = self.store.get_history(session_id)

        if is_smalltalk(message) or is_thanks(message):
            if not history_has_service_context(history_rows):
                reply = conversational_reply(message, locale, history_rows)
                return self._conversational_response(
                    session_id,
                    locale,
                    reply,
                    suggestions=welcome_suggestions(locale),
                )

        service_like = has_service_hint(message) or bool(extract_city(message))
        if is_app_question(message, has_service_intent=service_like):
            if not service_like or not should_search(
                SearchIntent(service_query=message), message, history_rows
            ):
                reply = await self.faq_assistant.answer(
                    message, locale, history_rows, faq_items=faq_cache
                )
                return self._conversational_response(
                    session_id,
                    locale,
                    reply or conversational_reply(message, locale, history_rows),
                    suggestions=welcome_suggestions(locale),
                )

        intent = await self._extract_intent(message, history_rows, locale)
        intent = enrich_intent(intent, message, history_rows)

        if not should_search(intent, message, history_rows):
            reply = (
                intent.clarification_question.strip()
                if intent.clarification_question and intent.clarification_question.strip()
                else conversational_reply(message, locale, history_rows)
            )
            return self._conversational_response(
                session_id,
                locale,
                reply,
                suggestions=welcome_suggestions(locale),
            )

        query = extract_meaningful_query(intent)
        if not query and has_service_hint(message):
            query = strip_city_from_text(message, intent.city)
        if not query:
            query = last_service_query_from_history(history_rows)
            if query:
                query = strip_city_from_text(query, intent.city)

        if not query:
            return self._conversational_response(
                session_id,
                locale,
                conversational_reply(message, locale, history_rows),
                suggestions=welcome_suggestions(locale),
            )

        results, fallback, city = await self._execute_search(
            intent, query, locale
        )

        if intent.sort == "RATING_DESC":
            results.sort(key=lambda r: r.get("average_rating") or 0, reverse=True)
        elif intent.sort == "PRICE_ASC":
            results.sort(key=lambda r: r.get("price") or 0)
        elif intent.sort == "PRICE_DESC":
            results.sort(key=lambda r: r.get("price") or 0, reverse=True)

        if intent.is_top_provider:
            results = [r for r in results if r.get("is_top_provider")]

        results = trim_results(results, MAX_RESULTS)
        fallback = len(results) == 0
        reply = self._build_search_reply(results, locale, fallback, city, query)
        suggestions = self._search_suggestions(intent, locale, results)

        provider_models = [ProviderResult(**r) for r in results]

        return ChatResponse(
            session_id=session_id,
            message=reply,
            providers=provider_models,
            intent_detected=True,
            fallback=fallback,
            suggestions=suggestions,
        )

    async def _execute_search(
        self,
        intent: SearchIntent,
        query: str,
        locale: str,
    ) -> tuple[list[dict], bool, str | None]:
        city = intent.city if is_known_city(intent.city) else None
        if not city and intent.service_query:
            city = extract_city(intent.service_query)
        clean_query = strip_city_from_text(query, city)
        intent.service_query = clean_query

        owner_filter = intent.owner_type
        if intent.prefer_company and not owner_filter:
            owner_filter = "COMPANY"

        structured: list[dict] = []
        service_id = await self.service_resolver.resolve_service_id(
            clean_query, locale, city
        )
        if service_id:
            structured = await self.search_service.search_by_service_id(
                service_id,
                intent,
                locale,
                limit=STRUCTURED_FETCH_LIMIT,
            )
            structured = filter_by_city(structured, city)

        semantic: list[dict] = []
        if len(structured) < MAX_RESULTS:
            semantic = await self.embedding_service.semantic_search(
                query=clean_query,
                city=city,
                min_rating=intent.min_rating,
                max_price=intent.max_price,
                is_available=intent.is_available_immediately,
                owner_type=owner_filter,
                limit=SEMANTIC_FETCH_LIMIT,
            )
            semantic = apply_similarity_threshold(semantic)
            semantic = filter_by_city(semantic, city)

        results = merge_structured_first(structured, semantic)
        results = trim_results(results, MAX_RESULTS)

        if city and not results:
            return [], True, city
        return results, len(results) == 0, city

    def _conversational_response(
        self,
        session_id: str,
        locale: str,
        reply: str,
        suggestions: list[str] | None = None,
    ) -> ChatResponse:
        return ChatResponse(
            session_id=session_id,
            message=reply,
            providers=[],
            intent_detected=True,
            fallback=False,
            suggestions=suggestions or welcome_suggestions(locale),
        )

    async def _chat_completion(
        self,
        messages: list[dict],
        *,
        json_mode: bool = False,
        temperature: float = 0.2,
        max_tokens: int = 300,
    ) -> str:
        client = get_openrouter_client()
        kwargs: dict = {
            "model": get_chat_model(),
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    async def _extract_intent(
        self, message: str, history: list, locale: str
    ) -> SearchIntent:
        hist_text = "\n".join(
            f"{h['role']}: {h['content']}" for h in history[:-1][-6:]
        ) or "(none)"

        user_prompt = INTENT_USER_TEMPLATE.format(
            history=hist_text,
            message=message,
            locale=locale,
        )

        try:
            raw = await self._chat_completion(
                [
                    {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                json_mode=True,
                temperature=0.1,
            )
            data = json.loads(raw or "{}")
            intent = SearchIntent(**data)
            return self._sanitize_intent(intent, message)
        except Exception:
            return self._fallback_intent(message, locale, history)

    def _sanitize_intent(self, intent: SearchIntent, message: str) -> SearchIntent:
        for field in ("service_query", "category_hint"):
            val = getattr(intent, field)
            if val and (is_smalltalk(val.strip()) or is_filter_only(val.strip())):
                setattr(intent, field, None)
        if intent.service_query and is_smalltalk(message):
            intent.service_query = None
        if not intent.city:
            extracted = extract_city(message)
            if extracted:
                intent.city = extracted
        elif not is_known_city(intent.city):
            intent.city = extract_city(message)
        return intent

    def _fallback_intent(
        self, message: str, locale: str, history: list
    ) -> SearchIntent:
        lang = "ar" if locale.startswith("ar") else "en"
        city = extract_city(message)
        if is_smalltalk(message) and not history_has_service_context(history):
            return SearchIntent(
                language=lang,
                confidence=0.95,
                needs_clarification=True,
                clarification_question=conversational_reply(message, locale, history),
            )
        if has_service_hint(message) or city:
            service_query = strip_city_from_text(message, city)
            return SearchIntent(
                service_query=service_query,
                city=city,
                language=lang,
                confidence=0.6,
            )
        return SearchIntent(
            language=lang,
            confidence=0.3,
            needs_clarification=True,
            clarification_question=conversational_reply(message, locale, history),
        )

    def _build_search_reply(
        self,
        results: list[dict],
        locale: str,
        fallback: bool,
        city: str | None,
        query: str,
    ) -> str:
        loc = "ar" if locale.startswith("ar") else "en"
        service_label = strip_city_from_text(query, city) or query

        if fallback:
            if city:
                if loc == "ar":
                    return (
                        f"لم أجد {service_label} في {city} حالياً. "
                        "جرّب مدينة أخرى أو صياغة مختلفة."
                    )
                return (
                    f"I couldn't find {service_label} in {city} right now. "
                    "Try another city or rephrase your request."
                )
            if loc == "ar":
                return "لم أجد نتائج مطابقة. جرّب صياغة أخرى أو حدّد المدينة."
            return "I couldn't find matching providers. Try rephrasing or add your city."

        count = len(results)
        if city:
            if loc == "ar":
                return f"وجدت {count} {'خيار' if count == 1 else 'خيارات'} لـ{service_label} في {city}."
            return (
                f"I found {count} {service_label} option{'s' if count != 1 else ''} "
                f"in {city} — browse the cards below."
            )
        if loc == "ar":
            return f"وجدت {count} {'خيار' if count == 1 else 'خيارات'} — اختر من البطاقات أدناه."
        return f"I found {count} option{'s' if count != 1 else ''} — browse the cards below."

    def _search_suggestions(
        self, intent: SearchIntent, locale: str, results: list[dict]
    ) -> list[str]:
        base = search_refine_suggestions(locale)
        if intent.owner_type == "COMPANY" or intent.prefer_company:
            return base
        if intent.owner_type == "PROVIDER":
            return base
        has_company = any(r.get("owner_type") == "COMPANY" for r in results)
        if has_company and locale.startswith("ar"):
            return ["عرض الشركات", "الأعلى تقييماً", "الأرخص", "متاح الآن"]
        if has_company:
            return ["Show companies", "Top rated", "Cheapest", "Available now"]
        return base
