"""
==============================================================================
Independent Embedding Engine Demonstration Utility
==============================================================================
Standalone CLI script to test and demonstrate SentenceTransformers embedding
generation, vector dimensions, lazy initialization, and semantic similarity search.

Demonstrates:
1. Embedding generation for sample text passages.
2. Vector dimension verification (384 dimensions).
3. Semantic similarity comparison between related vs unrelated text samples.

Usage:
    python backend/rag/test_embeddings.py
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.rag.embeddings import embedding_engine, EmbeddingEngine
from backend.rag.config import rag_settings


def run_demonstration():
    print("=" * 75)
    print("ERFlow RAG Subsystem - Standalone Embedding Engine Demonstration")
    print("=" * 75)

    print(f"\n[1] CONFIGURATION & LAZY INITIALIZATION")
    print(f"    - Target Model Name:     {rag_settings.EMBEDDING_MODEL_NAME}")
    print(f"    - Expected Dimension:    {rag_settings.EMBEDDING_DIMENSION}")
    print(f"    - Model Currently Loaded: {embedding_engine.is_loaded} (False before first call)")

    # 1. Sample Texts
    text_a = "What are the Emergency Severity Index ESI level 1 triage guidelines?"
    text_b = "ESI Level 1 indicates an immediate life-threatening emergency requiring resuscitation."
    text_c = "Baking a chocolate cake requires flour, sugar, cocoa powder, and eggs."

    print(f"\n[2] GENERATING SAMPLE EMBEDDINGS")
    print(f"    - Sample Passage 1: \"{text_a}\"")
    print(f"    - Sample Passage 2: \"{text_b}\"")
    print(f"    - Sample Passage 3: \"{text_c}\"")

    # Generate vector embeddings
    vec_a = embedding_engine.embed_text(text_a)
    vec_b = embedding_engine.embed_text(text_b)
    vec_c = embedding_engine.embed_text(text_c)

    print(f"\n[3] VECTOR DIMENSION VERIFICATION")
    print(f"    - Model Loaded State:     {embedding_engine.is_loaded} (True after first call)")
    print(f"    - Vector 1 Length:        {len(vec_a)} dimensions")
    print(f"    - Vector 2 Length:        {len(vec_b)} dimensions")
    print(f"    - Vector 3 Length:        {len(vec_c)} dimensions")
    print(f"    - Vector 1 First 5 Values: {[round(x, 4) for x in vec_a[:5]]}...")

    assert len(vec_a) == rag_settings.EMBEDDING_DIMENSION, f"Vector dimension should be {rag_settings.EMBEDDING_DIMENSION}"

    # 2. Semantic Similarity Comparisons
    sim_a_b = embedding_engine.compute_similarity(text_a, text_b)
    sim_a_c = embedding_engine.compute_similarity(text_a, text_c)

    print(f"\n[4] SEMANTIC SIMILARITY COMPARISONS")
    print(f"    - Similarity(Passage 1 [Triage Q], Passage 2 [Triage Ans]):   {sim_a_b:.4f} (High Similarity)")
    print(f"    - Similarity(Passage 1 [Triage Q], Passage 3 [Cake Recipe]):  {sim_a_c:.4f} (Low Similarity)")

    assert sim_a_b > sim_a_c, "Semantically related texts should have significantly higher similarity score!"

    print("\n" + "=" * 75)
    print("Embedding Engine Demonstration Completed Successfully!")
    print("=" * 75)


if __name__ == "__main__":
    run_demonstration()
