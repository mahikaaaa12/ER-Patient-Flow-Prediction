from datetime import datetime
from app.chatbot.conversation_manager import (
    BaseConversationStorage,
    ConversationManager,
    InMemoryConversationStorage,
)
from app.schemas.chat_schema import MessageItem


def test_session_creation_auto_generated():
    manager = ConversationManager()
    sid = manager.create_session()
    assert sid is not None
    assert len(sid) > 0
    assert manager.session_exists(sid) is True


def test_session_creation_custom_id():
    manager = ConversationManager()
    sid = manager.create_session("custom-er-session-101")
    assert sid == "custom-er-session-101"
    assert manager.session_exists("custom-er-session-101") is True


def test_get_or_create_session():
    manager = ConversationManager()
    # When None -> creates new
    sid1 = manager.get_or_create_session(None)
    assert sid1 is not None
    assert manager.session_exists(sid1) is True

    # When existing -> returns existing
    sid2 = manager.get_or_create_session(sid1)
    assert sid2 == sid1

    # When new string provided -> creates session with that ID
    sid3 = manager.get_or_create_session("session-xyz")
    assert sid3 == "session-xyz"
    assert manager.session_exists("session-xyz") is True


def test_message_storage_and_intent_tracking():
    manager = ConversationManager()
    sid = manager.create_session("test-msg-session")

    # Add user message with intent
    user_msg = manager.add_message(
        session_id=sid,
        sender="user",
        text="What is the expected patient volume?",
        intent="PATIENT_VOLUME",
    )
    assert user_msg.sender == "user"
    assert user_msg.text == "What is the expected patient volume?"
    assert user_msg.intent == "PATIENT_VOLUME"
    assert isinstance(user_msg.timestamp, datetime)

    # Add bot response
    bot_msg = manager.add_message(
        session_id=sid,
        sender="bot",
        text="Estimated volume is 42 patients.",
        intent="PATIENT_VOLUME",
    )
    assert bot_msg.sender == "bot"
    assert bot_msg.intent == "PATIENT_VOLUME"

    # Verify session record
    session_data = manager.get_session(sid)
    assert session_data is not None
    assert len(session_data.messages) == 2
    assert session_data.messages[0].sender == "user"
    assert session_data.messages[1].sender == "bot"


def test_history_retrieval_and_limits():
    manager = ConversationManager(max_history_per_session=10)
    sid = manager.create_session("history-test")

    # Add 5 messages
    for i in range(5):
        manager.add_message(sid, sender="user", text=f"Message {i}")

    # Full history
    all_history = manager.get_history(sid)
    assert len(all_history) == 5
    assert all_history[0].text == "Message 0"
    assert all_history[4].text == "Message 4"

    # History with limit parameter
    limited = manager.get_history(sid, limit=3)
    assert len(limited) == 3
    assert limited[0].text == "Message 2"
    assert limited[2].text == "Message 4"


def test_max_history_bounding():
    # Configure manager to keep maximum 4 messages
    manager = ConversationManager(max_history_per_session=4)
    sid = manager.create_session("bounded-test")

    # Add 10 messages
    for i in range(10):
        manager.add_message(sid, sender="user", text=f"Turn {i}")

    history = manager.get_history(sid)
    assert len(history) == 4
    # Must retain only the 4 most recent messages (Turn 6, 7, 8, 9)
    assert [m.text for m in history] == ["Turn 6", "Turn 7", "Turn 8", "Turn 9"]


def test_session_clearing():
    manager = ConversationManager()
    sid = manager.create_session("clear-test")
    manager.add_message(sid, sender="user", text="Test")
    assert manager.session_exists(sid) is True

    # Clear session
    cleared = manager.clear_session(sid)
    assert cleared is True
    assert manager.session_exists(sid) is False
    assert manager.get_history(sid) == []
    assert manager.get_session(sid) is None

    # Clearing non-existent session
    cleared_again = manager.clear_session("non-existent-sid")
    assert cleared_again is False


def test_pluggable_storage_backend_interface():
    # Verify storage interface can be swapped
    storage = InMemoryConversationStorage()
    manager = ConversationManager(storage=storage)

    sid = manager.create_session("custom-storage-sid")
    manager.add_message(sid, sender="user", text="Hello Storage")

    assert storage.session_exists("custom-storage-sid") is True
    assert len(storage.get_history("custom-storage-sid")) == 1


def test_prediction_context_storage():
    manager = ConversationManager()
    sid = manager.create_session("context-test")

    # Update prediction context
    manager.update_prediction_context(
        session_id=sid,
        intent="PATIENT_VOLUME",
        inputs={"time_window": "tomorrow", "hour_of_day": 14},
        payload={"predicted_volume": 150},
        time_window="tomorrow",
    )

    ctx = manager.get_prediction_context(sid)
    assert ctx is not None
    assert ctx["intent"] == "PATIENT_VOLUME"
    assert ctx["time_window"] == "tomorrow"
    assert ctx["inputs"]["hour_of_day"] == 14
    assert ctx["previous_payload"]["predicted_volume"] == 150

    # Clear prediction context
    manager.clear_prediction_context(sid)
    ctx_cleared = manager.get_prediction_context(sid)
    assert ctx_cleared["intent"] is None
