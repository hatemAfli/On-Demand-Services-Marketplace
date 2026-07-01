# ServeMe Chatbot

Python microservice for client AI search. Uses **[OpenRouter](https://openrouter.ai)** for chat + embeddings. **Conversation history is stored in PostgreSQL** (via NestJS); Redis is optional for other caches only.

## Setup

### 1. OpenRouter API key

1. Sign up at https://openrouter.ai
2. Create a key at https://openrouter.ai/settings/keys

### 2. Configure `chatbot/.env`

```env
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY
OPENROUTER_CHAT_MODEL=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_EMBED_MODEL=openai/text-embedding-3-small
REDIS_URL=redis://localhost:6379
CHATBOT_SESSION_TTL_DAYS=90

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NESTJS_API_URL=http://localhost:3000
NESTJS_CHATBOT_SECRET=same-secret-as-backend-.env
```

### 3. Database

Run `backend/sql/chatbot_embeddings.sql` in Supabase (1536-dim vectors for `text-embedding-3-small`).

### 4. Install & run

```bash
cd chatbot
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Ensure Redis is running (`docker run -d -p 6379:6379 redis:7-alpine`).

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/chat` | `X-Chatbot-Secret` | Process client message |
| `POST` | `/embed` | `X-Chatbot-Secret` | Generate embedding vector |
| `GET` | `/health` | none | Service status |

Client-facing chat goes through NestJS: `POST /api/chatbot/chat` (JWT). NestJS forwards conversation history and FAQ to Python, and Python calls `POST /api/chatbot/service` (secret) for catalog search.

Embeddings are synced automatically by the NestJS API when given services change.

## Free chat models

Browse https://openrouter.ai/models?q=free — set `OPENROUTER_CHAT_MODEL` and restart.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `OPENROUTER_API_KEY is not set` | Add key to `.env`, restart uvicorn |
| 401 on `/embed` or `/chat` | Match `NESTJS_CHATBOT_SECRET` in backend + chatbot |
| Vector dimension error | DB must use `vector(1536)` |
| Empty search results | Ensure given services are active and embeddings table is populated |
| Lost conversation context | Check `REDIS_URL` and Redis is running |
