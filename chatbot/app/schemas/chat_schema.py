from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MessageItem(BaseModel):
    sender: str = Field(..., description="Sender role, e.g., 'user' or 'bot'")
    text: str = Field(..., description="Message text content")
    intent: Optional[str] = Field(default=None, description="Detected intent associated with the message/turn")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="UTC timestamp of message")


ChatMessage = MessageItem


class SessionData(BaseModel):
    session_id: str = Field(..., description="Unique conversation session ID")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Session creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Session last updated timestamp")
    messages: List[MessageItem] = Field(default_factory=list, description="Ordered conversation messages")
    prediction_context: Dict[str, Any] = Field(default_factory=dict, description="Session prediction context state")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Natural language message from the user")
    session_id: Optional[str] = Field(default=None, description="Optional session/conversation identifier")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional extra parameters or context")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Generated text response for the user")
    intent: str = Field(..., description="Detected user intent")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Prediction or RAG data payload, or null if unavailable")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confidence score for the detected intent or retrieval")
    session_id: str = Field(..., description="Conversation session ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")


class ConversationHistoryResponse(BaseModel):
    session_id: str
    messages: List[MessageItem]


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Natural language question for knowledge base search")
    top_k: Optional[int] = Field(default=3, ge=1, le=10, description="Number of document chunks to retrieve")


class RAGQueryResponse(BaseModel):
    answer: str = Field(..., description="Synthesized RAG answer or context string")
    confidence: float = Field(default=0.0, description="Maximum similarity confidence score")
    found: bool = Field(default=False, description="True if relevant knowledge context was found")
    citations: List[Dict[str, Any]] = Field(default_factory=list, description="Document chunk citations and section metadata")
    sources: List[str] = Field(default_factory=list, description="Source filenames referenced in the answer")
