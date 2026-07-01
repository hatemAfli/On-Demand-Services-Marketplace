class ConversationStore:
    """LLM context supplied by NestJS on each /chat request."""

    def __init__(self, max_history: int = 10):
        self.max_history = max_history
        self._history: list[dict] = []

    def bind_history(self, history: list | None) -> None:
        rows = history if isinstance(history, list) else []
        self._history = rows[-self.max_history :]

    def add(self, session_id: str, role: str, content: str):
        """No-op — NestJS persists every turn before/after calling Python."""
        del session_id, role, content

    def get_history(self, session_id: str) -> list:
        del session_id
        return list(self._history)
