import logging
from app.chatbot.conversation_manager import conversation_manager
from app.chatbot.input_validator import input_validator
from app.chatbot.intent_detector import intent_detector
from app.chatbot.response_generator import response_generator
from app.chatbot.safety_guard import safety_guard
from app.ml_service.prediction_service import prediction_service
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.schemas.prediction_schema import Intent, PredictionRequest
from app.utils.helpers import sanitize_input

logger = logging.getLogger(__name__)


class ChatbotService:
    """
    Core Chatbot orchestrator coordinating:
    1. Input sanitization & conversation session tracking
    2. Medical safety and scope enforcement (SafetyGuard)
    3. Intent detection & session prediction context inheritance
    4. Strict input validation (InputValidator) before ML prediction
    5. Safe dispatching to ML Prediction Service
    6. Grounded response generation (ResponseGenerator)
    7. Session history and prediction context persistence (ConversationManager)
    """

    def __init__(self) -> None:
        self.conv_mgr = conversation_manager
        self.intent_det = intent_detector
        self.validator = input_validator
        self.pred_service = prediction_service
        self.resp_gen = response_generator
        self.safety_guard = safety_guard

    def process_message(self, request: ChatRequest) -> ChatResponse:
        """Process an incoming user message through the safety, intent, context, validation, prediction, and response pipeline."""
        # 1. Clean input & resolve session
        clean_text = sanitize_input(request.message)
        session_id = self.conv_mgr.get_or_create_session(request.session_id)

        # 2. Safety & Scope Check (Medical Diagnosis/Treatment Refusal Gate)
        safety_check = self.safety_guard.check_scope(clean_text)
        if not safety_check.is_safe:
            logger.warning(f"Session {session_id} - Out-of-scope clinical query intercepted: {safety_check.reason}")
            refusal_text = safety_check.refusal_message or self.safety_guard.SAFETY_REFUSAL_MESSAGE
            out_of_scope_intent = Intent.OUT_OF_SCOPE_MEDICAL.value

            # Record turn in conversation history
            self.conv_mgr.add_message(session_id, sender="user", text=clean_text, intent=out_of_scope_intent)
            self.conv_mgr.add_message(session_id, sender="bot", text=refusal_text, intent=out_of_scope_intent)

            return ChatResponse(
                response=refusal_text,
                intent=out_of_scope_intent,
                data=None,
                confidence=1.0,
                session_id=session_id,
            )

        # 3. Detect user intent for in-scope operational query
        detection_result = self.intent_det.detect_intent(clean_text)
        intent_str = detection_result.get("intent", Intent.UNKNOWN.value)
        confidence = float(detection_result.get("confidence", 0.0))

        try:
            intent_enum = Intent(intent_str)
        except ValueError:
            intent_enum = Intent.UNKNOWN

        # 4. Check active session context for follow-up condition refinement (e.g., "What about evening?")
        active_context = self.conv_mgr.get_prediction_context(session_id)
        if (intent_enum == Intent.UNKNOWN or confidence < 0.80) and active_context and active_context.get("intent"):
            last_intent_str = active_context["intent"]
            lower_msg = clean_text.lower()
            follow_up_keywords = ["evening", "morning", "afternoon", "tonight", "night", "tomorrow", "today", "urgent", "standard", "critical", "what about"]

            if any(kw in lower_msg for kw in follow_up_keywords):
                try:
                    intent_enum = Intent(last_intent_str)
                    confidence = 0.85
                    logger.info(f"Session {session_id} - Inherited intent '{intent_enum.value}' from active prediction context for follow-up query.")
                except ValueError:
                    pass

                req_context = dict(request.context or {})
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
                elif "tomorrow" in lower_msg:
                    req_context["time_window"] = "tomorrow"

                req_context["features"] = features
                request.context = req_context

        logger.info(f"Session {session_id} - Resolved Intent: {intent_enum.value} (confidence: {confidence:.2f})")

        # 5. Record user message in history with intent
        self.conv_mgr.add_message(
            session_id=session_id,
            sender="user",
            text=clean_text,
            intent=intent_enum.value,
        )

        # 6. Dispatch to ML Prediction Service ONLY if query is prediction-related
        prediction_result = None
        data_payload = None

        if intent_enum in [
            Intent.PATIENT_VOLUME,
            Intent.WAITING_TIME,
            Intent.CROWDING,
            Intent.HIGH_DEMAND_PERIOD,
            Intent.FLOW_PATTERN,
            Intent.GENERAL_STATUS,
        ]:
            # Strict Input Validation & Clarification Check
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
                # Update session prediction context for subsequent follow-up queries
                self.conv_mgr.update_prediction_context(
                    session_id=session_id,
                    intent=intent_enum.value,
                    inputs=request.context or {},
                    payload=data_payload,
                    time_window=(request.context or {}).get("time_window"),
                )

        # 7. Generate conversational response (handles unavailable models gracefully)
        reply_text = self.resp_gen.generate_response(
            intent=intent_enum,
            prediction_result=prediction_result,
            context=request.context,
        )

        # 8. Record bot message in history with intent
        self.conv_mgr.add_message(
            session_id=session_id,
            sender="bot",
            text=reply_text,
            intent=intent_enum.value,
        )

        # 9. Construct and return validated response schema
        return ChatResponse(
            response=reply_text,
            intent=intent_enum.value,
            data=data_payload,
            confidence=round(confidence, 2),
            session_id=session_id,
        )


# Global instance
chatbot_service = ChatbotService()
