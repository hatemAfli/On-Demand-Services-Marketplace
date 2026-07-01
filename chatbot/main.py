import os
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from models.chat_models import ChatRequest, ChatResponse, EmbedRequest, EmbedResponse
from services.llm_service import LLMService
from services.embedding_service import EmbeddingService

app = FastAPI(title="ServeMe Chatbot")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

llm_service = LLMService()
embedding_service = EmbeddingService()


async def verify_secret(x_chatbot_secret: str = Header(...)):
    expected = os.getenv("NESTJS_CHATBOT_SECRET", "")
    if not expected or x_chatbot_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_secret)])
async def chat(request: ChatRequest):
    try:
        return await llm_service.process_message(
            session_id=request.session_id,
            message=request.message,
            locale=request.locale,
            history=request.history,
            faq_items=request.faq,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(verify_secret)])
async def embed(request: EmbedRequest):
    try:
        vector = await embedding_service.embed_text(request.text)
        return EmbedResponse(embedding=vector)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/health")
async def health():
    from services.ai_client import get_chat_model, get_embed_model
    from services.redis_client import get_redis

    return {
        "status": "ok",
        "provider": "openrouter",
        "redis": get_redis() is not None,
        "chat_model": get_chat_model(),
        "embed_model": get_embed_model(),
    }
