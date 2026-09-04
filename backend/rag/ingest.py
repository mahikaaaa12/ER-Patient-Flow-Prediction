"""
==============================================================================
Standalone RAG Ingestion Command & Script
==============================================================================
CLI script to build and update the ChromaDB vector database independently
from the FastAPI application server.

Workflow:
1. Loads knowledge base documents from backend/knowledge_base/documents/
2. Splits documents into overlapping text chunks with preserved metadata
3. Computes 384-dimensional SentenceTransformer embeddings
4. Upserts chunks into ChromaDB persistent storage at backend/knowledge_base/vector_db/
5. Verifies and displays ChromaDB collection metrics and chunk counts

Usage:
    python backend/rag/ingest.py
"""

import sys
import time
from pathlib import Path

# Add backend directory root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.rag.config import rag_settings
from backend.rag.document_loader import document_loader
from backend.rag.text_splitter import text_splitter
from backend.rag.vector_store import vector_store


def run_ingestion():
    start_time = time.time()

    print("=" * 75)
    print("ERFlow RAG Subsystem - Standalone Vector Database Ingestion Pipeline")
    print("=" * 75)

    print(f"\n[1] SYSTEM CONFIGURATION")
    print(f"    - Knowledge Base Path:   {rag_settings.KNOWLEDGE_BASE_DIR.resolve()}")
    print(f"    - Vector Database Path:  {rag_settings.VECTOR_STORE_DIR.resolve()}")
    print(f"    - Collection Identifier: {rag_settings.COLLECTION_NAME}")
    print(f"    - Embedding Model:       {rag_settings.EMBEDDING_MODEL_NAME} ({rag_settings.EMBEDDING_DIMENSION}d)")
    print(f"    - Pre-ingestion Data Check (has_data): {vector_store.has_data()} (Initial Count: {vector_store.count()})")

    # 1. Load Documents
    print(f"\n[2] LOADING KNOWLEDGE BASE DOCUMENTS")
    documents = document_loader.load_documents()
    print(f"    - Successfully Loaded {len(documents)} Knowledge Base Documents:")
    
    for i, doc in enumerate(documents, start=1):
        print(f"      {i}. {doc.source} [{doc.file_type}] - {doc.doc_title} ({doc.file_size_bytes} bytes)")

    if not documents:
        print("\n[!] Error: No documents found in knowledge base directory!")
        return

    # 2. Text Chunking
    print(f"\n[3] GENERATING OVERLAPPING TEXT CHUNKS")
    chunks = text_splitter.split_documents(documents)
    print(f"    - Total Chunks Generated: {len(chunks)}")
    print(f"    - Configured Chunk Size: {text_splitter.chunk_size} words max | Overlap: {text_splitter.chunk_overlap} words")

    # 3. Vector Database Ingestion (ChromaDB)
    print(f"\n[4] COMPUTING EMBEDDINGS & UPSERTING INTO CHROMADB")
    added_count = vector_store.add_chunks(chunks)
    
    # 4. Verify Database Persistence & Final Counts
    print(f"\n[5] VERIFYING CHROMADB DATA PERSISTENCE")
    has_data_flag = vector_store.has_data()
    final_count = vector_store.count()
    elapsed = time.time() - start_time

    print(f"    - Status:                  SUCCESS")
    print(f"    - Collection Has Data?:   {has_data_flag}")
    print(f"    - Chunks Added/Updated:   {added_count}")
    print(f"    - Total Persistent Count: {final_count} entries")
    print(f"    - Ingestion Time:         {elapsed:.2f} seconds")

    print("\n" + "=" * 75)
    print(f"ChromaDB Ingestion Complete! Vector DB updated at: {rag_settings.VECTOR_STORE_DIR.resolve()}")
    print("=" * 75)


if __name__ == "__main__":
    run_ingestion()
