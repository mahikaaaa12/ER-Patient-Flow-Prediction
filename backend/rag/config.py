"""
==============================================================================
RAG Subsystem Configuration
==============================================================================
Manages paths, vector database parameters, chunking settings, embedding models,
and retrieval thresholds for the ERFlow RAG knowledge retrieval engine.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base backend directory reference
BACKEND_DIR = Path(__file__).resolve().parent.parent


class RAGSettings(BaseSettings):
    """
    Pydantic settings configuration for the RAG knowledge retrieval subsystem.
    """
    RAG_ENABLED: bool = True
    
    # Knowledge base document directory
    KNOWLEDGE_BASE_DIR: Path = BACKEND_DIR / "knowledge_base" / "documents"
    
    # Vector store persistence directory
    VECTOR_STORE_DIR: Path = BACKEND_DIR / "knowledge_base" / "vector_db"
    
    # Vector DB Collection identifier
    COLLECTION_NAME: str = "erflow_knowledge_base"
    
    # Embedding Model Settings
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    
    # Text chunking settings
    CHUNK_SIZE: int = 400
    CHUNK_OVERLAP: int = 80
    
    # Search retrieval settings
    TOP_K_RESULTS: int = 3
    MIN_SIMILARITY_SCORE: float = 0.15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Singleton settings instance
rag_settings = RAGSettings()
