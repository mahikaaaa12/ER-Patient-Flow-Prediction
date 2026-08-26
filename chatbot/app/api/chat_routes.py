import logging
from fastapi import APIRouter, HTTPException, status
from app.chatbot.chatbot_service import chatbot_service
from app.chatbot.conversation_manager import conversation_manager
from app.ml_service.model_registry import model_registry
from app.schemas.chat_schema import (
    ChatRequest,
    ChatResponse,
    ConversationHistoryResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chatbot"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Process chat message",
    description="Accepts a natural language message and returns an AI-generated ER patient flow response.",
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    Main Chatbot endpoint.
    Accepts: {"message": "..."}
    Returns: {"response": "...", "intent": "...", "data": null, "confidence": 0.0}
    """
    try:
        return chatbot_service.process_message(request)
    except Exception as e:
        logger.error(f"Error in /api/chat endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while processing the chat message.",
        )


@router.post(
    "/chat/message",
    response_model=ChatResponse,
    include_in_schema=False,
)
async def chat_message_alias(request: ChatRequest) -> ChatResponse:
    """Route alias to support /api/chat/message."""
    return await chat_endpoint(request)


@router.get(
    "/chat/history/{session_id}",
    response_model=ConversationHistoryResponse,
    summary="Get conversation history by session ID",
)
async def get_conversation_history(session_id: str) -> ConversationHistoryResponse:
    try:
        messages = conversation_manager.get_history(session_id)
        return ConversationHistoryResponse(session_id=session_id, messages=messages)
    except Exception as e:
        logger.error(f"Error retrieving history for session {session_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not retrieve conversation history: {str(e)}",
        )


@router.delete(
    "/chat/session/{session_id}",
    summary="Clear conversation session memory",
)
async def clear_session(session_id: str):
    cleared = conversation_manager.clear_session(session_id)
    if not cleared:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found or already cleared.",
        )
    return {"message": f"Session '{session_id}' cleared successfully."}


@router.get(
    "/chat/health",
    summary="Chatbot sub-system health check",
)
async def chat_health_check():
    registered_models = model_registry.list_models()
    has_unified = model_registry.get_unified_interface() is not None
    is_available = len(registered_models) > 0 or has_unified
    return {
        "status": "healthy",
        "service": "ER Patient Flow Chatbot",
        "ml_models_registered": registered_models,
        "ml_model_available": is_available,
    }
