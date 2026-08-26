from typing import Any, Dict, Optional
from app.schemas.prediction_schema import Intent, PredictionResult


class ResponseGenerator:
    """
    Transforms detected intent and structured prediction results into clear,
    conversational, and grounded user responses.

    Strict Grounding Rules:
    1. Never invent numerical values.
    2. Never invent probabilities.
    3. Never invent model confidence (omit if unavailable).
    4. Never claim certainty when the model provides a probabilistic prediction.
    5. Never invent explanations for why a model produced a prediction.
    6. Never change the model's predicted class or value.
    7. Never present mock data as real data.
    """

    UNAVAILABLE_MESSAGE = "The prediction is currently unavailable because the required model is not available yet."

    def _get_confidence_str(self, prediction_result: Optional[PredictionResult], payload: Dict[str, Any]) -> str:
        """
        Extracts model class probability or genuine confidence ONLY if actually present.
        Returns empty string if confidence is unavailable to avoid inventing unsupported values.
        """
        conf = None
        is_prob = False

        if prediction_result and prediction_result.raw_response and prediction_result.raw_response.confidence is not None:
            conf = prediction_result.raw_response.confidence
            meta = prediction_result.raw_response.metadata or {}
            is_prob = meta.get("is_probability", False)
        elif "class_probability" in payload and payload["class_probability"] is not None:
            conf = float(payload["class_probability"])
            is_prob = True
        elif "confidence" in payload and payload["confidence"] is not None:
            try:
                c = float(payload["confidence"])
                conf = c if c <= 1.0 else c / 100.0
            except (ValueError, TypeError):
                pass

        if conf is not None:
            pct = int(round(conf * 100))
            if is_prob:
                return f", with an estimated class probability of {pct}%"
            return f", with an estimated confidence of {pct}%"
        return ""

    def generate_response(
        self,
        intent: Intent | str,
        prediction_result: Optional[PredictionResult] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Converts detected intent and ML prediction result into a grounded user response.
        """
        context = context or {}

        # Normalize intent to Enum
        if isinstance(intent, str):
            try:
                intent_enum = Intent(intent)
            except ValueError:
                intent_enum = Intent.UNKNOWN
        else:
            intent_enum = intent

        # ==========================================================
        # 1. INFORMATIONAL INTENTS (Separate from ML predictions)
        # ==========================================================
        if intent_enum == Intent.GREETING:
            return (
                "Hello! I am your AI-powered Emergency Room Patient Flow Assistant. "
                "I can provide predictions on patient volume, waiting times, ED crowding, "
                "and high-demand surge periods. How can I assist you today?"
            )

        if intent_enum == Intent.HELP:
            return (
                "Here are the things I can help you with:\n"
                "- 📊 **Patient Volume**: Forecast incoming ER patient arrivals (`PATIENT_VOLUME`)\n"
                "- ⏱️ **Waiting Times**: Estimate wait durations by triage acuity (`WAITING_TIME`)\n"
                "- 🏥 **ED Crowding**: Check department occupancy and crowding status (`CROWDING`)\n"
                "- ⚡ **High Demand Surge**: Predict busiest upcoming periods (`HIGH_DEMAND_PERIOD`)\n"
                "- 🔄 **Flow Patterns**: Categorize operational flow regime (`FLOW_PATTERN`)\n"
                "- 📈 **General Status**: Get an overview of daily patient flow metrics (`GENERAL_STATUS`)\n"
                "- 🤖 **Model Info**: Details on underlying ML algorithms (`MODEL_INFO`)\n"
                "- ℹ️ **Project Info**: Overview of the ER Patient Flow Prediction project (`PROJECT_INFO`)"
            )

        if intent_enum == Intent.PROJECT_INFO:
            return (
                "ℹ️ **Project Overview**: This project is an **AI-Based Emergency Room Patient Flow Prediction** system. "
                "It uses machine learning to forecast patient arrival volume, triage waiting times, and department crowding "
                "to assist clinical staff and hospital management in proactive resource allocation."
            )

        if intent_enum == Intent.MODEL_INFO:
            return (
                "🤖 **Model Information**: The system utilizes predictive machine learning models (XGBoost Regressor & Classifier, "
                "DBSCAN Density Anomaly, K-Means + PCA Clustering, and 2-Layer LSTM Neural Network) trained on historical ER "
                "admission records, seasonal trends, day-of-week patterns, and triage acuity data."
            )

        if intent_enum == Intent.UNKNOWN:
            return (
                "I'm sorry, I couldn't quite understand your request. "
                "You can ask me about ER patient volume, wait times, department crowding, "
                "or high-demand surge periods. Type 'help' to see what I can do."
            )

        # ==========================================================
        # 2. MODEL UNAVAILABLE & MOCK MODE CHECKS
        # ==========================================================
        if prediction_result is None or not prediction_result.is_available or prediction_result.payload is None:
            return self.UNAVAILABLE_MESSAGE

        if prediction_result.is_mock:
            provider_name = prediction_result.model_name or "mock_provider"
            return (
                f"🧪 **Development Mock Result**: Pipeline test successful for intent **{intent_enum.value}** "
                f"via `{provider_name}`. *(Note: Development test result for architecture validation only; not a real prediction)*"
            )

        payload = prediction_result.payload
        conf_str = self._get_confidence_str(prediction_result, payload)

        # ==========================================================
        # 3. GROUNDED ML PREDICTION RESPONSES
        # ==========================================================

        # A. PATIENT VOLUME PREDICTION
        if intent_enum == Intent.PATIENT_VOLUME:
            volume = payload.get("predicted_volume")
            time_window = payload.get("time_window", "the requested period")
            if volume is not None:
                return f"The model forecasts approximately **{volume}** patient arrivals for **{time_window}**{conf_str}."
            return self.UNAVAILABLE_MESSAGE

        # B. WAITING TIME PREDICTION
        elif intent_enum == Intent.WAITING_TIME:
            wait_min = payload.get("estimated_wait_minutes")
            triage = payload.get("triage_level", "Standard")
            if wait_min is not None:
                return f"The waiting-time model estimates approximately **{wait_min} minutes** for **{triage}** triage{conf_str}."
            return self.UNAVAILABLE_MESSAGE

        # C. CROWDING PREDICTION
        elif intent_enum == Intent.CROWDING:
            level = payload.get("crowding_level")
            if level is not None:
                return f"The crowding model predicts **{level}** risk{conf_str}."
            return self.UNAVAILABLE_MESSAGE

        # D. HIGH DEMAND PERIOD PREDICTION
        elif intent_enum == Intent.HIGH_DEMAND_PERIOD:
            is_surge = payload.get("is_high_demand_expected")
            status = payload.get("status")
            severity = payload.get("severity") or payload.get("risk_level", "Normal")
            if is_surge is True:
                return f"High Demand Alert: The high-demand model predicts **{status or 'ANOMALOUS SURGE DETECTED'}** ({severity} demand risk){conf_str}."
            elif is_surge is False:
                return f"The high-demand model predicts **{status or 'NORMAL OPERATIONAL LOAD'}**{conf_str}."
            return self.UNAVAILABLE_MESSAGE

        # E. FLOW PATTERN PREDICTION
        elif intent_enum == Intent.FLOW_PATTERN:
            pname = payload.get("pattern_name")
            cid = payload.get("cluster_id")
            if pname is not None or cid is not None:
                name_str = pname or f"Cluster #{cid}"
                return f"The flow-pattern clustering model categorizes the current state as **{name_str}** (Cluster #{cid}){conf_str}."
            return self.UNAVAILABLE_MESSAGE

        # F. GENERAL ER STATUS PREDICTION
        elif intent_enum == Intent.GENERAL_STATUS:
            lines = ["📋 **Grounded Patient Flow Summary**:"]
            has_data = False

            if "volume" in payload and isinstance(payload["volume"], dict):
                v_val = payload["volume"].get("predicted_volume")
                if v_val is not None:
                    lines.append(f"- **Patient Volume**: {v_val} arrivals forecasted")
                    has_data = True

            if "waiting_time" in payload and isinstance(payload["waiting_time"], dict):
                w_val = payload["waiting_time"].get("estimated_wait_minutes")
                if w_val is not None:
                    lines.append(f"- **Waiting Time**: {w_val} minutes estimated")
                    has_data = True

            if "crowding" in payload and isinstance(payload["crowding"], dict):
                c_val = payload["crowding"].get("crowding_level")
                if c_val is not None:
                    lines.append(f"- **Crowding Risk**: {c_val}")
                    has_data = True

            if has_data:
                return "\n".join(lines)
            return self.UNAVAILABLE_MESSAGE

        return self.UNAVAILABLE_MESSAGE


# Global singleton instance
response_generator = ResponseGenerator()
