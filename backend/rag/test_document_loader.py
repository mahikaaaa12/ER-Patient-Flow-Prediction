"""
==============================================================================
Independent Document Loader Tester Script
==============================================================================
Executable utility script to test document loading, multi-format text extraction,
and metadata handling independently without starting FastAPI or ML prediction servers.

Usage:
    python backend/rag/test_document_loader.py
"""

import sys
from pathlib import Path

# Ensure backend root is on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.rag.document_loader import document_loader, DocumentLoader


def run_standalone_test():
    print("=" * 70)
    print("ERFlow RAG Subsystem - Independent Document Ingestion Test")
    print("=" * 70)

    loader = DocumentLoader()
    print(f"Target Knowledge Base Path: {loader.docs_dir.resolve()}")
    print(f"Supported File Formats: {', '.join(loader.SUPPORTED_EXTENSIONS)}")
    print(f"Auto-Ingest on Server Startup: {loader.auto_ingest_on_startup} (DISABLED for safety)\n")

    # Ingest documents
    documents = loader.load_documents()

    print(f"Total Successfully Ingested Documents: {len(documents)}\n")

    for i, doc in enumerate(documents, start=1):
        print(f"[{i}] Document: {doc.source}")
        print(f"    Title:        {doc.doc_title}")
        print(f"    File Type:    {doc.file_type}")
        print(f"    File Size:    {doc.file_size_bytes} bytes")
        print(f"    Page Count:   {doc.page_count}")
        print(f"    Content Preview ({min(120, len(doc.content))} chars):")
        preview = doc.content[:120].replace('\n', ' ')
        print(f"      \"{preview}...\"\n")
        print(f"    Metadata Payload: {doc.metadata}")
        print("-" * 70)

    print("\nDocument Ingestion Test Completed Successfully!")


if __name__ == "__main__":
    run_standalone_test()
