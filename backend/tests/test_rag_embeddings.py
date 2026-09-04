import pytest
from backend.rag.embeddings import EmbeddingEngine, embedding_engine
from backend.rag.config import rag_settings

def test_embedding_engine_dimension():
    vec = embedding_engine.embed_text("Emergency room crowding and queue waiting time.")
    assert isinstance(vec, list)
    assert len(vec) == rag_settings.EMBEDDING_DIMENSION, f"Embedding dimension must match configured {rag_settings.EMBEDDING_DIMENSION}"

def test_embedding_batch_documents():
    texts = [
        "Patient triage protocol for level 1 emergency.",
        "Crowding mitigation action thresholds for hospital capacity.",
        "Deep learning LSTM patient arrival volume forecast."
    ]
    vectors = embedding_engine.embed_documents(texts)
    assert len(vectors) == 3
    for v in vectors:
        assert len(v) == 384

def test_semantic_similarity_comparison():
    q = "What is the waiting time for ESI 3 patients?"
    related = "ESI 3 urgent patients have a target wait time of 30 to 60 minutes."
    unrelated = "The weather tomorrow is predicted to be sunny and warm."

    sim_related = embedding_engine.compute_similarity(q, related)
    sim_unrelated = embedding_engine.compute_similarity(q, unrelated)

    assert sim_related > sim_unrelated, f"Related similarity ({sim_related:.4f}) must be higher than unrelated ({sim_unrelated:.4f})"
