"""
==============================================================================
ERFlow RAG (Retrieval-Augmented Generation) Subsystem
==============================================================================
Provides a modular, isolated knowledge retrieval system for ER triage protocols,
hospital crowding mitigation policies, and ERFlow operational system documentation.

This module operates independently from the existing ML prediction pipeline.
"""

from .config import RAGSettings, rag_settings
from .document_loader import DocumentLoader, document_loader
from .text_splitter import TextSplitter, text_splitter
from .embeddings import EmbeddingEngine, embedding_engine
from .vector_store import VectorStore, vector_store
from .retriever import Retriever, retriever
from .rag_service import RAGService, rag_service

__all__ = [
    "RAGSettings",
    "rag_settings",
    "DocumentLoader",
    "document_loader",
    "TextSplitter",
    "text_splitter",
    "EmbeddingEngine",
    "embedding_engine",
    "VectorStore",
    "vector_store",
    "Retriever",
    "retriever",
    "RAGService",
    "rag_service",
]
