import re
from typing import Any, Dict, List, Tuple
from app.schemas.prediction_schema import Intent


class IntentDetector:
    """
    Rule-based intent detector for the Emergency Room Patient Flow Prediction system.
    Supports all 12 operational and conversational intents with dynamic confidence
    scoring and priority ordering without requiring external LLM dependencies.
    """

    # 1. OUT_OF_SCOPE_MEDICAL (Intercepts clinical symptom / diagnosis queries)
    OUT_OF_SCOPE_PATTERNS = [
        (r"\b(chest\s*pain|shortness\s*of\s*breath|heart\s*attack)\b", 0.95),
        (r"\b(diagnose\s*me|what\s*(disease|illness)\s*do\s*i\s*have)\b", 0.95),
        (r"\b(what\s*medicine|prescription|dosage|ibuprofen|antibiotics)\b", 0.95),
        (r"\b(treat\s*(a\s*)?(wound|burn)|symptoms\s*of)\b", 0.95),
        (r"\b(medical\s*advice|life\s*threatening)\b", 0.95),
    ]

    # 2. GREETING PATTERNS
    GREETING_PATTERNS = [
        (r"^(hi|hello|hey|greetings)\b", 0.95),
        (r"^good\s*(morning|afternoon|evening|day)\b", 0.95),
    ]

    # 3. HELP PATTERNS
    HELP_PATTERNS = [
        (r"^help\b", 0.95),
        (r"what\s*can\s*you\s*do", 0.95),
        (r"how\s*to\s*use", 0.92),
        (r"\b(commands|instructions|options|menu)\b", 0.90),
    ]

    # 4. MODEL INFO PATTERNS
    MODEL_INFO_PATTERNS = [
        (r"what\s*model\s*(are\s*you\s*using|do\s*you\s*use|is\s*this|do\s*we\s*have)", 0.95),
        (r"how\s*does\s*(the\s*)?(lstm|xgboost|dbscan|kmeans)\s*model\s*work", 0.95),
        (r"are\s*(the\s*)?models\s*working", 0.95),
        (r"how\s*does\s*(the\s*)?(prediction\s*)?model\s*work", 0.94),
        (r"what\s*(ml\s*)?model\s*(is\s*used|do\s*you\s*use)", 0.94),
        (r"explain\s*(the\s*)?(ml\s*)?model", 0.92),
        (r"model\s*(architecture|accuracy|algorithm|details|info)", 0.90),
        (r"\b(lstm|xgboost|dbscan|kmeans)\s*model\b", 0.92),
        (r"how\s*(do|are)\s*(you|predictions)\s*(predict|made|forecast)", 0.90),
    ]

    # 5. PROJECT INFO PATTERNS
    PROJECT_INFO_PATTERNS = [
        (r"what\s*does\s*this\s*project\s*do", 0.94),
        (r"tell\s*me\s*about\s*(this\s*)?project", 0.94),
        (r"about\s*(this\s*)?(project|system|application|chatbot)", 0.92),
        (r"project\s*(info|details|purpose|overview|scope)", 0.90),
        (r"who\s*built\s*this", 0.90),
    ]

    # 6. WAITING TIME PATTERNS
    WAITING_TIME_PATTERNS = [
        (r"wait(ing)?[\s\-]*(time|duration|estimate|minutes|risk|situation|period|level)", 0.95),
        (r"how\s*long\s*(will|do|are|is)\s*(patients|people|i)?\s*(have\s*to\s*)?(wait|waiting)", 0.95),
        (r"what\s*(will|is)\s*(the\s*)?(current|expected|estimated\s*)?wait(ing)?[\s\-]*time", 0.95),
        (r"how\s*long\s*is\s*(the\s*)?(current\s*)?(wait|queue)", 0.94),
        (r"(are|is)\s*(patients\s*)?waiting\s*(longer|more|high|increasing)", 0.94),
        (r"(is\s*the\s*)?queue\s*(getting\s*)?(longer|growing|increasing|time)", 0.93),
        (r"how\s*bad\s*is\s*(the\s*)?wait", 0.93),
        (r"should\s*i\s*expect\s*a\s*(long\s*)?wait", 0.92),
        (r"(er|ed)?\s*wait[\s\-]*time", 0.92),
        (r"triage\s*(wait|time)", 0.90),
        (r"queue\s*(duration|length|status)", 0.90),
        (r"\bdelay(s)?\b", 0.80),
    ]

    # 7. PATIENT VOLUME PATTERNS
    PATIENT_VOLUME_PATTERNS = [
        (r"what\s*will\s*patient\s*arrivals\s*look\s*like", 0.95),
        (r"how\s*many\s*patients(\s*are)?\s*(expected|predicted)", 0.95),
        (r"expected\s*(patient|arrival|admission)\s*(count|volume|rate)", 0.94),
        (r"patient\s*volume(\s*forecast)?", 0.92),
        (r"how\s*many\s*(arrivals|admissions|patients)", 0.92),
        (r"patient\s*arrivals", 0.90),
        (r"admissions\s*forecast", 0.90),
        (r"volume\s*forecast", 0.88),
    ]

    # 8. FLOW PATTERN PATTERNS
    FLOW_PATTERN_PATTERNS = [
        (r"what\s*patterns?\s*(are\s*)?(you\s*seeing|present|there|in)", 0.95),
        (r"what\s*patterns?\s*(do\s*you\s*see\s*in\s*)?patient\s*flow", 0.95),
        (r"are\s*there\s*(unusual|any)\s*patient[- ]flow\s*patterns?", 0.94),
        (r"(operational|current)\s*pattern(s)?", 0.94),
        (r"patient[- ]flow\s*pattern(s)?", 0.93),
        (r"flow\s*pattern(s)?", 0.90),
        (r"patient[- ]flow\s*regime", 0.90),
        (r"\bk-means\b", 0.90),
        (r"\bcluster(ing)?\b", 0.88),
        (r"demand\s*regime", 0.88),
    ]

    # 9. HIGH DEMAND PERIOD PATTERNS
    HIGH_DEMAND_PATTERNS = [
        (r"when\s*(will|is)\s*(the\s*)?(er|ed|emergency\s*room|emergency\s*department)\s*(be\s*)?(busiest|peak)", 0.95),
        (r"is\s*there\s*a\s*(demand\s*)?surge", 0.95),
        (r"are\s*we\s*experiencing\s*a\s*high[\s\-]demand", 0.95),
        (r"are\s*there\s*(any\s*)?surge\s*(periods?|hours?|times?)", 0.94),
        (r"busiest\s*(time|period|hours?|day)", 0.93),
        (r"high\s*demand\s*(period|hours?|time|surge)?", 0.92),
        (r"peak\s*(period|hours?|time|surge|demand)", 0.90),
        (r"\bsurge\s*(period|hours?|time)\b", 0.90),
        (r"rush\s*hours?", 0.85),
    ]

    # 10. CROWDING PATTERNS
    CROWDING_PATTERNS = [
        (r"will\s*the\s*(er|ed|emergency\s*room|emergency\s*department)\s*be\s*crowded", 0.95),
        (r"is\s*(the\s*)?(er|ed|emergency\s*room|emergency\s*department)\s*crowded", 0.95),
        (r"how\s*busy(\s*is\s*(the\s*)?(er|ed|emergency\s*room|emergency\s*department))?", 0.92),
        (r"crowd(ing|ed)?", 0.88),
        (r"occupancy(\s*rate)?", 0.88),
        (r"full\s*capacity", 0.88),
        (r"bed\s*availability", 0.85),
        (r"er\s*capacity", 0.85),
        (r"congestion", 0.82),
    ]

    # 11. GENERAL STATUS PATTERNS
    GENERAL_STATUS_PATTERNS = [
        (r"how\s*is\s*(the\s*)?(er|ed|emergency\s*room|emergency\s*department)\s*(expected\s*to\s*be|today|right\s*now|tonight|going)", 0.92),
        (r"(er|ed|emergency\s*room)\s*(general\s*)?status", 0.90),
        (r"general\s*status", 0.88),
        (r"overall\s*status", 0.88),
        (r"patient\s*flow\s*(overview|summary|status)", 0.88),
        (r"daily\s*(overview|summary)", 0.85),
        (r"flow\s*metrics", 0.85),
    ]

    def detect_intent(self, text: str) -> Dict[str, Any]:
        """
        Analyzes input text using structured pattern priority matching and dynamic confidence scoring.

        Returns:
            dict: {
                "intent": str (e.g. "PATIENT_VOLUME", "WAITING_TIME", ...),
                "confidence": float (0.0 to 1.0)
            }
        """
        if not text or not text.strip():
            return {
                "intent": Intent.UNKNOWN.value,
                "confidence": 0.0,
            }

        cleaned = text.lower().strip()
        words = cleaned.split()
        word_count = len(words)

        # Evaluator priority table
        evaluators: List[Tuple[Intent, List[Tuple[str, float]]]] = [
            (Intent.OUT_OF_SCOPE_MEDICAL, self.OUT_OF_SCOPE_PATTERNS),
            (Intent.GREETING, self.GREETING_PATTERNS),
            (Intent.HELP, self.HELP_PATTERNS),
            (Intent.MODEL_INFO, self.MODEL_INFO_PATTERNS),
            (Intent.PROJECT_INFO, self.PROJECT_INFO_PATTERNS),
            (Intent.WAITING_TIME, self.WAITING_TIME_PATTERNS),
            (Intent.PATIENT_VOLUME, self.PATIENT_VOLUME_PATTERNS),
            (Intent.FLOW_PATTERN, self.FLOW_PATTERN_PATTERNS),
            (Intent.HIGH_DEMAND_PERIOD, self.HIGH_DEMAND_PATTERNS),
            (Intent.CROWDING, self.CROWDING_PATTERNS),
            (Intent.GENERAL_STATUS, self.GENERAL_STATUS_PATTERNS),
        ]

        best_intent = Intent.UNKNOWN
        best_confidence = 0.0

        for intent_enum, patterns in evaluators:
            for pattern, base_conf in patterns:
                match = re.search(pattern, cleaned)
                if match:
                    conf = base_conf

                    # Ambiguity penalty for single vague words
                    if word_count == 1 and not (intent_enum in [Intent.GREETING, Intent.HELP]):
                        matched_str = match.group(0)
                        if len(matched_str) < 8 or matched_str in ["time", "busy", "surge", "peak", "queue", "delay", "volume", "flow", "er", "ed"]:
                            conf = 0.45  # Penalty forces UNKNOWN classification for vague single words

                    if conf > best_confidence:
                        best_confidence = conf
                        best_intent = intent_enum
                    break

        if best_confidence < 0.50:
            return {
                "intent": Intent.UNKNOWN.value,
                "confidence": round(float(best_confidence) if best_confidence > 0 else 0.20, 2),
            }

        return {
            "intent": best_intent.value,
            "confidence": round(float(best_confidence), 2),
        }


# Global singleton instance
intent_detector = IntentDetector()
