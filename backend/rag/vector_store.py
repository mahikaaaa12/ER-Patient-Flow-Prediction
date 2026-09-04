"""
==============================================================================
Vector Store Module (ChromaDB Integration)
==============================================================================
Manages local persistent vector database storage (ChromaDB) for knowledge base
document passages and embeddings.

Features:
- Configurable collection name via RAGSettings (default: erflow_knowledge_base)
- Isolated persistent directory at backend/knowledge_base/vector_db
- Metadata preservation for every chunk (source, doc_title, section_title, etc.)
- Duplicate prevention via deterministic chunk IDs and ChromaDB upsert operations
- Data presence check methods (has_data, count)
- Standalone execution support decoupled from FastAPI application startup
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

from .config import rag_settings
from .embeddings import embedding_engine, EmbeddingEngine
from .text_splitter import TextChunk

logger = logging.getLogger("erflow.rag.vector_store")


class VectorStore:
    """
    Persistent ChromaDB vector database manager for RAG document chunk storage and retrieval.
    """

    def __init__(
        self,
        collection_name: Optional[str] = None,
        persist_dir: Optional[Path] = None,
        embedder: Optional[EmbeddingEngine] = None,
    ):
        self.collection_name = collection_name or rag_settings.COLLECTION_NAME
        self.persist_dir = persist_dir or rag_settings.VECTOR_STORE_DIR
        self.embedder = embedder or embedding_engine
        
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        
        self.chroma_client = None
        self.collection = None
        self._use_fallback = False
        
        # Fallback storage objects (TF-IDF vectorizer if ChromaDB is unavailable)
        self.fallback_chunks: List[TextChunk] = []
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None

        self.get_or_create_collection(self.collection_name)

    def get_or_create_collection(self, collection_name: Optional[str] = None) -> Any:
        """
        1. Creates or loads the ChromaDB collection.
        """
        target_collection_name = collection_name or self.collection_name
        self.collection_name = target_collection_name

        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self.chroma_client = chromadb.PersistentClient(
                path=str(self.persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False)
            )

            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "ERFlow Emergency Department Knowledge Base"}
            )
            logger.info(f"[VectorStore] Successfully initialized ChromaDB collection '{self.collection_name}' at {self.persist_dir}")
            return self.collection

        except Exception as e:
            logger.warning(
                f"[VectorStore] ChromaDB native initialization skipped ({e}). "
                f"Activating fallback TF-IDF vector similarity engine."
            )
            self._use_fallback = True
            return None

    def add_chunks(
        self,
        chunks: List[TextChunk],
        embeddings: Optional[List[List[float]]] = None,
    ) -> int:
        """
        2. Adds or updates document chunks in the vector database.
        Prevents duplicate entries by using deterministic chunk IDs and upsert operations.

        Args:
            chunks (List[TextChunk]): List of TextChunk objects to ingest.
            embeddings (Optional[List[List[float]]]): Optional pre-computed embedding vectors.

        Returns:
            int: Number of chunks successfully added/updated.
        """
        if not chunks:
            logger.warning("[VectorStore] No chunks provided for vector database insertion.")
            return 0

        ids = [c.chunk_id for c in chunks]
        documents = [c.text for c in chunks]
        metadatas = [c.metadata for c in chunks]

        # Use ChromaDB if active
        if not self._use_fallback and self.collection is not None:
            try:
                if embeddings is None:
                    # Generate dense vectors via embedding engine
                    logger.info(f"[VectorStore] Computing embeddings for {len(chunks)} text chunks...")
                    embeddings = self.embedder.embed_documents(documents)

                self.collection.upsert(
                    ids=ids,
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas
                )
                self.persist()
                logger.info(f"[VectorStore] Successfully upserted {len(chunks)} chunks into ChromaDB collection '{self.collection_name}'.")
                return len(chunks)
            except Exception as e:
                logger.error(f"[VectorStore] ChromaDB upsert error: {e}. Falling back to in-memory similarity index.")
                self._use_fallback = True

        # Fallback TF-IDF vector store path
        self.fallback_chunks = chunks
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.tfidf_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(documents)
        logger.info(f"[VectorStore] Fallback TF-IDF store indexed {len(chunks)} chunks.")
        return len(chunks)

    def persist(self) -> bool:
        """
        3. Persists embeddings to disk.
        (Note: ChromaDB PersistentClient automatically flushes state on upsert).
        """
        try:
            if self.persist_dir and self.persist_dir.exists():
                logger.info(f"[VectorStore] Persisted vector storage to disk at {self.persist_dir}")
                return True
        except Exception as e:
            logger.error(f"[VectorStore] Persistence check error: {e}")
        return False

    def has_data(self) -> bool:
        """
        4. Checks whether the knowledge base vector collection currently contains data.

        Returns:
            bool: True if item count > 0, False otherwise.
        """
        return self.count() > 0

    def count(self) -> int:
        """
        Returns total number of document chunks indexed in the collection.
        """
        if not self._use_fallback and self.collection is not None:
            try:
                return self.collection.count()
            except Exception as e:
                logger.error(f"[VectorStore] Failed to query ChromaDB count: {e}")

        return len(self.fallback_chunks)

    def similarity_search(
        self,
        query: str,
        top_k: Optional[int] = None,
        min_score: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes semantic vector similarity search against the persistent database.
        """
        top_k = top_k or rag_settings.TOP_K_RESULTS
        min_score = min_score if min_score is not None else rag_settings.MIN_SIMILARITY_SCORE

        if not query or not query.strip():
            return []

        # Query ChromaDB collection
        if not self._use_fallback and self.collection is not None:
            try:
                query_vector = self.embedder.embed_text(query)
                results = self.collection.query(
                    query_embeddings=[query_vector],
                    n_results=top_k
                )

                search_results = []
                if results and results.get("documents") and results["documents"][0]:
                    docs = results["documents"][0]
                    metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                    distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)

                    for doc, meta, dist in zip(docs, metas, distances):
                        # Distance to similarity mapping
                        score = max(0.0, 1.0 - (dist / 2.0))
                        if score >= min_score:
                            search_results.append({
                                "text": doc,
                                "metadata": meta,
                                "score": round(score, 4),
                                "source": meta.get("source", "Knowledge Base")
                            })
                return search_results

            except Exception as e:
                logger.error(f"[VectorStore] ChromaDB search query failed: {e}. Executing fallback similarity search.")
                self._use_fallback = True

        # Fallback TF-IDF similarity search
        if not self.fallback_chunks or self.tfidf_vectorizer is None:
            return []

        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity
        query_vec = self.tfidf_vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        top_indices = np.argsort(similarities)[::-1][:top_k]
        search_results = []

        for idx in top_indices:
            score = float(similarities[idx])
            if score >= min_score:
                chunk = self.fallback_chunks[idx]
                search_results.append({
                    "text": chunk.text,
                    "metadata": chunk.metadata,
                    "score": round(score, 4),
                    "source": chunk.metadata.get("source", "Knowledge Base")
                })

        return search_results


# Global singleton instance
vector_store = VectorStore()
