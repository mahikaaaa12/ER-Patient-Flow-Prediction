import logging
from fastapi import APIRouter, HTTPException, status
from app.chatbot.chatbot_service import chatbot_service
from app.chatbot.conversation_manager import conversation_manager
from app.ml_service.model_registry import model_registry
from app.schemas.chat_schema import (
    ChatRequest,
    ChatResponse,
    ConversationHistoryResponse,
    RAGQueryRequest,
    RAGQueryResponse,
)

# Safe lazy import of backend RAG service for dedicated RAG endpoint
try:
    from backend.rag.rag_service import rag_service
except ImportError:
    rag_service = None

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chatbot & RAG"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Process chat message (ML & RAG & Conversational)",
    description="Accepts a natural language message and returns an AI-generated response, ML prediction, or RAG knowledge context.",
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    Main Chatbot endpoint handling ML Predictions, RAG Knowledge Retrieval, and Conversational Responses.
    Accepts: {"message": "..."}
    Returns: {"response": "...", "intent": "...", "data": null, "confidence": 0.0, "session_id": "..."}
    """
    try:
        return chatbot_service.process_message(request)
    except Exception as e:
        logger.error(f"Error processing /api/chat message: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while processing the chat message. Please try again.",
        )


@router.post(
    "/chat/message",
    response_model=ChatResponse,
    include_in_schema=False,
)
async def chat_message_alias(request: ChatRequest) -> ChatResponse:
    """Route alias supporting /api/chat/message."""
    return await chat_endpoint(request)


@router.post(
    "/rag/query",
    response_model=RAGQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Direct Knowledge Base RAG Query Endpoint",
    description="Executes semantic retrieval against ChromaDB knowledge documents independently from session memory.",
)
async def rag_query_endpoint(request: RAGQueryRequest) -> RAGQueryResponse:
    """
    Dedicated RAG Endpoint for direct knowledge base inspection.
    Accepts: {"query": "What are ESI level 1 guidelines?", "top_k": 3}
    Returns: {"answer": "...", "found": true, "confidence": 0.85, "citations": [...], "sources": [...]}
    """
    if rag_service is None:
        logger.warning("RAG service module is not available on server.")
        return RAGQueryResponse(
            answer="Knowledge base service is currently unavailable.",
            confidence=0.0,
            found=False,
            citations=[],
            sources=[],
        )

    try:
        result = rag_service.query(request.query)
        return RAGQueryResponse(
            answer=result.get("answer", ""),
            confidence=result.get("confidence", 0.0),
            found=result.get("found", False),
            citations=result.get("citations", []),
            sources=result.get("sources", []),
        )
    except Exception as e:
        logger.error(f"Error processing /api/rag/query: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while querying the knowledge base.",
        )


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
            detail=f"Could not retrieve conversation history.",
        )


@router.delete(
    "/chat/session/{session_id}",
    summary="Clear conversation session memory",
)
async def clear_session(session_id: str):
    try:
        cleared = conversation_manager.clear_session(session_id)
        if not cleared:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' not found or already cleared.",
            )
        return {"message": f"Session '{session_id}' cleared successfully."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing session {session_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while clearing session memory.",
        )


@router.get(
    "/chat/health",
    summary="Chatbot & RAG sub-system health check",
)
async def chat_health_check():
    registered_models = model_registry.list_models()
    has_unified = model_registry.get_unified_interface() is not None
    is_available = len(registered_models) > 0 or has_unified

    rag_available = rag_service is not None
    return {
        "status": "healthy",
        "service": "ER Patient Flow Chatbot & RAG API",
        "ml_models_registered": registered_models,
        "ml_model_available": is_available,
        "rag_available": rag_available,
    }
