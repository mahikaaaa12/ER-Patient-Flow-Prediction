"""
==============================================================================
Independent Knowledge Retriever Demonstration Utility
==============================================================================
Standalone CLI script to test and demonstrate semantic retrieval from the ChromaDB
vector database without modifying or connecting to the FastAPI backend or chatbot.

Demonstrates retrieval for 3 domain query categories:
1. ER Triage Protocols & ESI Levels
2. Patient Overcrowding & Surge Mitigation Policies
3. Emergency Department Operations & Machine Learning Architecture

Usage:
    python backend/rag/test_retriever.py
"""

import sys
import json
from pathlib import Path

# Add backend directory root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.rag.config import rag_settings
from backend.rag.retriever import retriever, Retriever
from backend.rag.vector_store import vector_store


def run_retrieval_demonstration():
    print("=" * 80)
    print("ERFlow RAG Subsystem - Standalone Semantic Retrieval Demonstration")
    print("=" * 80)

    print(f"\n[1] VECTOR DATABASE CHECK")
    print(f"    - Vector Database Path:  {rag_settings.VECTOR_STORE_DIR.resolve()}")
    print(f"    - Collection Name:       {rag_settings.COLLECTION_NAME}")
    print(f"    - Collection Has Data?:  {vector_store.has_data()}")
    print(f"    - Total Persistent Chunks: {vector_store.count()}")

    if not vector_store.has_data():
        print("\n[!] Vector store has no data. Running fast auto-ingestion for testing...")
        from backend.rag.ingest import run_ingestion
        run_ingestion()

    # Define test queries across the 3 required domain areas
    test_suite = [
        {
            "category": "1. ER TRIAGE PROTOCOLS",
            "query": "What are the Emergency Severity Index ESI level 1 and level 2 triage guidelines and target wait times?",
            "top_k": 2
        },
        {
            "category": "2. PATIENT OVERCROWDING & SURGE",
            "query": "What is the hospital diversion policy and full capacity protocol during critical ER crowding?",
            "top_k": 2
        },
        {
            "category": "3. EMERGENCY DEPARTMENT OPERATIONS & ML",
            "query": "How does the ERFlow machine learning system predict queue waiting times and patient volume forecasts?",
            "top_k": 2
        }
    ]

    print(f"\n[2] EXECUTING SEMANTIC RETRIEVAL TEST SUITE ({len(test_suite)} Domain Categories)")

    for idx, test_item in enumerate(test_suite, start=1):
        cat = test_item["category"]
        query_text = test_item["query"]
        top_k = test_item["top_k"]

        print("\n" + "=" * 80)
        print(f"CATEGORY {idx}: {cat}")
        print(f"Natural Language Query: \"{query_text}\"")
        print(f"Configured Top_K Limit:  {top_k} chunks")
        print("-" * 80)

        # Execute semantic vector search
        chunks = retriever.retrieve_chunks(query=query_text, top_k=top_k)

        if not chunks:
            print("  [!] No matching document chunks found for this query.")
            continue

        print(f"Retrieved {len(chunks)} Relevant Chunk(s):\n")

        for rank, chunk in enumerate(chunks, start=1):
            text = chunk.get("text", "")
            score = chunk.get("score", 0.0)
            meta = chunk.get("metadata", {})

            src_file = meta.get("source", "Unknown File")
            doc_title = meta.get("doc_title", "Unknown Title")
            sec_title = meta.get("section_title", "General")
            chunk_id = meta.get("chunk_id", "N/A")

            print(f"  --- Result #{rank} (Relevance Score: {score:.4f}) ---")
            print(f"  Source File:   {src_file}")
            print(f"  Doc Title:     {doc_title}")
            print(f"  Section Header: {sec_title}")
            print(f"  Chunk Identifier: {chunk_id}")
            
            clean_preview = text[:250].replace('\n', ' ')
            print(f"  Passage Snippet:")
            print(f"    \"{clean_preview}...\"\n")

    print("=" * 80)
    print("Semantic Retrieval Demonstration Completed Successfully!")
    print("=" * 80)


if __name__ == "__main__":
    run_retrieval_demonstration()
