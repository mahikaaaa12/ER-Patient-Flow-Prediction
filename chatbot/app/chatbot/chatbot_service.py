"""
==============================================================================
Chatbot Service Orchestrator with Additive RAG Safeguards & Fallbacks
==============================================================================
Orchestrates incoming chat requests across three prioritized operational categories:

Priority Order:
1. CATEGORY 1: REAL-TIME OPERATIONAL / PREDICTION QUESTIONS (XGBoost/LSTM ML Models)
2. CATEGORY 2: KNOWLEDGE-BASED QUESTIONS (ChromaDB RAG Vector Store Retrieval)
3. CATEGORY 3: GENERAL CONVERSATIONAL QUESTIONS (Standard Bot Rules)
4. RAG FALLBACK: If RAG retrieval fails or context is missing -> Fall back to CATEGORY 3
5. CHROMADB UNAVAILABLE: Application continues functioning normally without crashing

Preserves 100% of existing medical safety, ML prediction, and session memory logic.
"""

import logging
from typing import Dict, Any, Optional

from app.chatbot.conversation_manager import conversation_manager
from app.chatbot.input_validator import input_validator
from app.chatbot.intent_detector import intent_detector
from app.chatbot.response_generator import response_generator
from app.chatbot.safety_guard import safety_guard
from app.chatbot.query_router import query_router, QueryCategory
from app.ml_service.prediction_service import prediction_service
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.schemas.prediction_schema import Intent, PredictionRequest
from app.utils.helpers import sanitize_input

# Safe lazy import of backend RAG retriever with error logging
retriever = None
rag_settings = None
try:
    from backend.rag.config import rag_settings
    from backend.rag.retriever import retriever
    logger_init = logging.getLogger(__name__)
    logger_init.info("[ChatbotService] RAG retriever module successfully imported and available.")
except ImportError as err:
    logger_init = logging.getLogger(__name__)
    logger_init.warning(f"[ChatbotService] RAG retriever module unavailable ({err}). RAG features will fall back gracefully.")

logger = logging.getLogger(__name__)


class ChatbotService:
    """
    Core Chatbot orchestrator enforcing priority order, safety gates, ML predictions,
    non-blocking RAG knowledge retrieval, and explicit fallbacks.
    """

    def __init__(self) -> None:
        self.conv_mgr = conversation_manager
        self.intent_det = intent_detector
        self.validator = input_validator
        self.pred_service = prediction_service
        self.resp_gen = response_generator
        self.safety_guard = safety_guard
        self.router = query_router

    def process_message(self, request: ChatRequest) -> ChatResponse:
        """
        Process an incoming user message through safety, routing, prediction/retrieval, and fallback pipelines.
        Guaranteed non-crashing: Any internal RAG error falls back gracefully to standard chatbot response.
        """
        # 1. Clean input & resolve session
        clean_text = sanitize_input(request.message)
        session_id = self.conv_mgr.get_or_create_session(request.session_id)

        # 2. Medical Safety & Scope Check (Medical Diagnosis/Treatment Refusal Gate)
        safety_check = self.safety_guard.check_scope(clean_text)
        if not safety_check.is_safe:
            logger.warning(f"Session {session_id} - Out-of-scope clinical query intercepted: {safety_check.reason}")
            refusal_text = safety_check.refusal_message or self.safety_guard.SAFETY_REFUSAL_MESSAGE
            out_of_scope_intent = Intent.OUT_OF_SCOPE_MEDICAL.value

            self.conv_mgr.add_message(session_id, sender="user", text=clean_text, intent=out_of_scope_intent)
            self.conv_mgr.add_message(session_id, sender="bot", text=refusal_text, intent=out_of_scope_intent)

            return ChatResponse(
                response=refusal_text,
                intent=out_of_scope_intent,
                data=None,
                confidence=1.0,
                session_id=session_id,
            )

        # 3. Detect user intent
        detection_result = self.intent_det.detect_intent(clean_text)
        intent_str = detection_result.get("intent", Intent.UNKNOWN.value)
        confidence = float(detection_result.get("confidence", 0.0))

        try:
            intent_enum = Intent(intent_str)
        except ValueError:
            intent_enum = Intent.UNKNOWN

        # 4. Check active session context for follow-up condition refinement & memory
        active_context = self.conv_mgr.get_prediction_context(session_id)
        lower_msg = clean_text.lower()
        req_context = dict(request.context or {})

        if active_context and active_context.get("intent"):
            last_intent_str = active_context["intent"]
            is_why_followup = any(kw in lower_msg for kw in ["why", "factor", "cause", "reason", "explain"])
            is_later_followup = any(kw in lower_msg for kw in ["later", "peak", "future", "forecast", "ahead"])
            is_condition_followup = any(kw in lower_msg for kw in ["evening", "morning", "afternoon", "tonight", "night", "tomorrow", "today", "what about"])

            if (intent_enum == Intent.UNKNOWN or confidence < 0.85) and (is_why_followup or is_later_followup or is_condition_followup):
                try:
                    intent_enum = Intent(last_intent_str)
                    confidence = 0.90
                    logger.info(f"Session {session_id} - Inherited intent '{intent_enum.value}' from active session context for follow-up query.")
                except ValueError:
                    pass

                if is_why_followup:
                    req_context["query_type"] = "explanation"
                elif is_later_followup:
                    req_context["query_type"] = "future"

                features = dict(req_context.get("features", {}))
                if "evening" in lower_msg:
                    req_context["time_window"] = "evening"
                    features["hour_of_day"] = 18
                elif "morning" in lower_msg:
                    req_context["time_window"] = "morning"
                    features["hour_of_day"] = 9
                elif "afternoon" in lower_msg:
                    req_context["time_window"] = "afternoon"
                    features["hour_of_day"] = 14
                elif "night" in lower_msg or "tonight" in lower_msg:
                    req_context["time_window"] = "night"
                    features["hour_of_day"] = 22

                req_context["features"] = features
                request.context = req_context

        # 5. Route Query Category via QueryRouter
        query_category = self.router.route_query(intent_enum, clean_text, confidence)
        logger.info(f"Session {session_id} - Resolved Intent: {intent_enum.value} | Priority Category: {query_category.value} (confidence: {confidence:.2f})")

        # Record user message in history
        self.conv_mgr.add_message(
            session_id=session_id,
            sender="user",
            text=clean_text,
            intent=intent_enum.value,
        )

        prediction_result = None
        data_payload = None
        reply_text = None

        # =========================================================================
        # PRIORITY 1: REAL-TIME OPERATIONAL / PREDICTION QUESTIONS (ML Models)
        # =========================================================================
        if query_category == QueryCategory.OPERATIONAL_PREDICTION:
            validation = self.validator.validate_prediction_input(intent_enum, request.context or {})
            if not validation.is_valid:
                reply_text = validation.clarification_message or validation.error_message or "Invalid model input parameters provided."
                self.conv_mgr.add_message(session_id=session_id, sender="bot", text=reply_text, intent=intent_enum.value)
                return ChatResponse(
                    response=reply_text,
                    intent=intent_enum.value,
                    data={"validation_failed": True, "clarification_needed": bool(validation.clarification_message)},
                    confidence=round(confidence, 2),
                    session_id=session_id,
                )

            pred_req = PredictionRequest(
                intent=intent_enum,
                input_data=validation.validated_input,
                parameters=request.context or {},
            )
            prediction_result = self.pred_service.get_prediction(pred_req)
            if prediction_result.is_available and prediction_result.payload is not None:
                data_payload = prediction_result.payload
                self.conv_mgr.update_prediction_context(
                    session_id=session_id,
                    intent=intent_enum.value,
                    inputs=request.context or {},
                    payload=data_payload,
                    time_window=(request.context or {}).get("time_window"),
                )

            reply_text = self.resp_gen.generate_response(
                intent=intent_enum,
                prediction_result=prediction_result,
                context=request.context,
            )

        # =========================================================================
        # PRIORITY 2: KNOWLEDGE-BASED QUESTIONS (ChromaDB RAG Retrieval)
        # =========================================================================
        elif query_category == QueryCategory.KNOWLEDGE_BASE:
            rag_context = ""
            citations = []
            max_score = 0.0

            # Safe deployment toggle: check RAG_ENABLED environment setting (useful for 512MB RAM free instances)
            is_rag_enabled = getattr(rag_settings, "RAG_ENABLED", True) if rag_settings else True

            if is_rag_enabled and retriever is not None:
                try:
                    rag_context, citations, max_score = retriever.retrieve_context(clean_text, top_k=2)
                except Exception as e:
                    # Priority 5 Safeguard: Log RAG exception and prevent app crash
                    logger.error(f"[RAG Failure Safeguard] Session {session_id} - Vector store or retriever exception: {e}. Executing safe fallback to CATEGORY 3.")
            elif not is_rag_enabled:
                logger.info(f"Session {session_id} - RAG disabled via RAG_ENABLED=false env setting. Executing safe fallback to CATEGORY 3.")

            if rag_context and max_score >= 0.15:
                unique_sources = list(dict.fromkeys([c["source"] for c in citations if c.get("source")]))
                sources_formatted = "\n".join([f"- {src}" for src in unique_sources]) if unique_sources else "- Knowledge Base Document"
                
                reply_text = f"{rag_context}\n\n**Sources:**\n{sources_formatted}"
                data_payload = {
                    "rag_retrieval": True,
                    "confidence_score": max_score,
                    "sources": unique_sources,
                    "citations": citations,
                }
                intent_enum = Intent.KNOWLEDGE_QUERY
                confidence = max(confidence, max_score)
            else:
                # Priority 4 Fallback: No matching knowledge found or similarity below threshold
                logger.warning(f"[RAG Fallback] Session {session_id} - RAG retrieval found no matching passages (score: {max_score:.2f}). Gracefully falling back to CATEGORY 3.")
                query_category = QueryCategory.GENERAL_CONVERSATIONAL

        # =========================================================================
        # PRIORITY 3 & FALLBACKS: GENERAL CONVERSATIONAL QUESTIONS
        # =========================================================================
        if query_category == QueryCategory.GENERAL_CONVERSATIONAL or reply_text is None:
            reply_text = self.resp_gen.generate_response(
                intent=intent_enum,
                prediction_result=None,
                context=request.context,
            )

        # 7. Record bot message in history
        self.conv_mgr.add_message(
            session_id=session_id,
            sender="bot",
            text=reply_text,
            intent=intent_enum.value,
        )

        # 8. Return response
        return ChatResponse(
            response=reply_text,
            intent=intent_enum.value,
            data=data_payload,
            confidence=round(confidence, 2),
            session_id=session_id,
        )


# Global singleton instance
chatbot_service = ChatbotService()
