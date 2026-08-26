from abc import ABC, abstractmethod
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
from app.schemas.chat_schema import MessageItem, SessionData
from app.utils.helpers import generate_session_id

logger = logging.getLogger(__name__)


# ==========================================================
# 1. Storage Layer Abstraction (Pluggable for Future DBs)
# ==========================================================

class BaseConversationStorage(ABC):
    """
    Abstract storage contract for conversation and session state persistence.
    Allows replacing the in-memory storage with PostgreSQL, Redis, MongoDB, etc.
    """

    @abstractmethod
    def create_session(self, session_id: str) -> str:
        """Create and initialize a new conversation session."""
        pass

    @abstractmethod
    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Retrieve full session record including messages."""
        pass

    @abstractmethod
    def add_message(self, session_id: str, message: MessageItem, max_history: int) -> MessageItem:
        """Store a message in the session and enforce maximum history limit."""
        pass

    @abstractmethod
    def get_history(self, session_id: str, limit: Optional[int] = None) -> List[MessageItem]:
        """Retrieve ordered message history for a session."""
        pass

    @abstractmethod
    def clear_session(self, session_id: str) -> bool:
        """Delete or reset a conversation session."""
        pass

    @abstractmethod
    def session_exists(self, session_id: str) -> bool:
        """Check if a session exists."""
        pass

    @abstractmethod
    def update_prediction_context(self, session_id: str, context_data: Dict[str, Any]) -> None:
        """Store or update session prediction context."""
        pass

    @abstractmethod
    def get_prediction_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve prediction context for a session."""
        pass


class InMemoryConversationStorage(BaseConversationStorage):
    """
    Thread-safe in-memory conversation storage implementation.
    Stores session metadata, message queues, and prediction context dictionaries.
    """

    def __init__(self) -> None:
        self._sessions: Dict[str, SessionData] = {}

    def create_session(self, session_id: str) -> str:
        now = datetime.utcnow()
        self._sessions[session_id] = SessionData(
            session_id=session_id,
            created_at=now,
            updated_at=now,
            messages=[],
            prediction_context={},
        )
        return session_id

    def get_session(self, session_id: str) -> Optional[SessionData]:
        return self._sessions.get(session_id)

    def session_exists(self, session_id: str) -> bool:
        return session_id in self._sessions

    def add_message(self, session_id: str, message: MessageItem, max_history: int) -> MessageItem:
        if session_id not in self._sessions:
            self.create_session(session_id)

        session = self._sessions[session_id]
        session.messages.append(message)
        session.updated_at = datetime.utcnow()

        # Enforce history limit window
        if len(session.messages) > max_history:
            session.messages = session.messages[-max_history:]

        return message

    def get_history(self, session_id: str, limit: Optional[int] = None) -> List[MessageItem]:
        session = self._sessions.get(session_id)
        if not session:
            return []
        messages = session.messages
        if limit is not None and limit > 0:
            return messages[-limit:]
        return list(messages)

    def clear_session(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def update_prediction_context(self, session_id: str, context_data: Dict[str, Any]) -> None:
        if session_id in self._sessions:
            session = self._sessions[session_id]
            if session.prediction_context is None:
                session.prediction_context = {}
            session.prediction_context.update(context_data)
            session.updated_at = datetime.utcnow()

    def get_prediction_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = self._sessions.get(session_id)
        if session and session.prediction_context:
            return dict(session.prediction_context)
        return None


# ==========================================================
# 2. Conversation Manager (Orchestrator)
# ==========================================================

class ConversationManager:
    """
    Conversation Manager coordinating session lifecycles, message tracking,
    intent associations, prediction context retention, and history limits.
    """

    def __init__(
        self,
        max_history_per_session: int = 50,
        storage: Optional[BaseConversationStorage] = None,
    ) -> None:
        self.max_history = max_history_per_session
        self.storage = storage or InMemoryConversationStorage()

    def create_session(self, session_id: Optional[str] = None) -> str:
        """Explicitly create a new conversation session."""
        sid = session_id.strip() if (session_id and session_id.strip()) else generate_session_id()
        return self.storage.create_session(sid)

    def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """Validates existing session ID or creates a new one if missing."""
        if not session_id or not session_id.strip():
            return self.create_session()
        sid = session_id.strip()
        if not self.storage.session_exists(sid):
            self.storage.create_session(sid)
        return sid

    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Retrieves session metadata and full message history."""
        if not session_id:
            return None
        return self.storage.get_session(session_id.strip())

    def add_message(
        self,
        session_id: str,
        sender: str,
        text: str,
        intent: Optional[str] = None,
    ) -> MessageItem:
        """
        Appends a message turn (user or bot) with detected intent and timestamp.
        No sensitive patient identifiers are stored.
        """
        sid = session_id.strip()
        msg = MessageItem(
            sender=sender,
            text=text,
            intent=intent,
            timestamp=datetime.utcnow(),
        )
        return self.storage.add_message(sid, msg, self.max_history)

    def update_prediction_context(
        self,
        session_id: str,
        intent: str,
        inputs: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        time_window: Optional[str] = None,
    ) -> None:
        """
        Updates prediction context retained for the active conversation session:
        - intent
        - date/time/window
        - selected prediction type
        - relevant model input parameters
        - previous prediction result payload

        No sensitive patient health information is stored.
        """
        sid = self.get_or_create_session(session_id)
        ctx_data = {
            "intent": intent,
            "selected_prediction_type": intent,
            "inputs": inputs or {},
            "previous_payload": payload or {},
            "time_window": time_window or (inputs.get("time_window") if inputs else None),
            "last_updated": datetime.utcnow().isoformat(),
        }
        self.storage.update_prediction_context(sid, ctx_data)
        logger.info(f"Updated prediction context for session {sid}: intent='{intent}', window='{time_window}'")

    def get_prediction_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves active prediction context dictionary for session."""
        if not session_id:
            return None
        return self.storage.get_prediction_context(session_id.strip())

    def clear_prediction_context(self, session_id: str) -> None:
        """Clears stored prediction context for session."""
        if session_id and self.storage.session_exists(session_id.strip()):
            self.storage.update_prediction_context(
                session_id.strip(),
                {"intent": None, "inputs": {}, "previous_payload": {}, "time_window": None},
            )

    def get_history(self, session_id: str, limit: Optional[int] = None) -> List[MessageItem]:
        """Retrieves recent message history for a session."""
        if not session_id:
            return []
        return self.storage.get_history(session_id.strip(), limit=limit)

    def clear_session(self, session_id: str) -> bool:
        """Clears memory history for a session."""
        if not session_id:
            return False
        return self.storage.clear_session(session_id.strip())

    def session_exists(self, session_id: str) -> bool:
        """Checks if a session is currently active in storage."""
        if not session_id:
            return False
        return self.storage.session_exists(session_id.strip())


# Global singleton instance
conversation_manager = ConversationManager()
