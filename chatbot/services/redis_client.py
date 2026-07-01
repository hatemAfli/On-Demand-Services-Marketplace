import os

from redis import Redis

_client: Redis | None = None
_unavailable = False


def get_redis() -> Redis | None:
    global _client, _unavailable
    if _unavailable:
        return None
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return None
    if _client is None:
        try:
            _client = Redis.from_url(url, decode_responses=True)
            _client.ping()
        except Exception:
            _unavailable = True
            _client = None
            return None
    return _client
