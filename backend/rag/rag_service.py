"""
==============================================================================
RAG Service Coordinator Module
==============================================================================
Provides an independent, high-level API service layer for executing knowledge
retrieval and synthesizing grounded answers from the knowledge base with clean
human-readable document sources.
"""

import logging
from typing import Dict, Any, List
from .config import rag_settings
from .retriever import retriever, Retriever

logger = logging.getLogger("erflow.rag.rag_service")


class RAGService:
    """
    High-level service interface for RAG-based knowledge retrieval.
    """
    def __init__(self, knowledge_retriever: Retriever = None):
        self.retriever = knowledge_retriever or retriever

    def query(self, question: str) -> Dict[str, Any]:
        """
        Queries the knowledge base for a natural language question.

        Returns:
            dict: {
                "answer": str,
                "confidence": float,
                "found": bool,
                "citations": List[Dict[str, Any]],
                "sources": List[str]
            }
        """
        if not question or not question.strip():
            return {
                "answer": "Please provide a query regarding ER triage protocols, crowding policies, or operational guidelines.",
                "confidence": 0.0,
                "found": False,
                "citations": [],
                "sources": []
            }

        context_text, citations, max_score = self.retriever.retrieve_context(question)

        if not context_text or max_score < rag_settings.MIN_SIMILARITY_SCORE:
            return {
                "answer": "No specific matching protocol or policy found in the hospital knowledge base.",
                "confidence": round(max_score, 2),
                "found": False,
                "citations": [],
                "sources": []
            }

        # Deduplicate and extract clean document filenames
        sources_list = list(dict.fromkeys([c["source"] for c in citations if c.get("source")]))
        sources_formatted = "\n".join([f"- {src}" for src in sources_list]) if sources_list else "- Knowledge Base Document"

        formatted_answer = f"{context_text}\n\n**Sources:**\n{sources_formatted}"

        return {
            "answer": formatted_answer,
            "confidence": round(max_score, 2),
            "found": True,
            "citations": citations,
            "sources": sources_list
        }


# Singleton service instance
rag_service = RAGService()
