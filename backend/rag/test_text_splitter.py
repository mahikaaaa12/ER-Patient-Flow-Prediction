"""
==============================================================================
Independent Text Splitter Demonstration Utility
==============================================================================
Standalone CLI script to test and demonstrate document loading and text chunking
for the ERFlow RAG subsystem without creating or populating a ChromaDB database.

Demonstrates:
- Total number of documents loaded
- Total number of text chunks generated
- Configurable chunk_size and chunk_overlap settings
- Example metadata payload structure for generated chunks
- Preview of chunk content and overlap context

Usage:
    python backend/rag/test_text_splitter.py
"""

import sys
import json
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.rag.document_loader import document_loader
from backend.rag.text_splitter import TextSplitter, text_splitter


def run_demonstration():
    print("=" * 75)
    print("ERFlow RAG Subsystem - Standalone Text Chunking & Metadata Demonstration")
    print("=" * 75)

    # 1. Load Knowledge Base Documents
    documents = document_loader.load_documents()
    num_docs = len(documents)

    print(f"\n[1] DOCUMENT LOADING")
    print(f"    - Target Directory:       {document_loader.docs_dir.resolve()}")
    print(f"    - Total Documents Loaded: {num_docs}")

    for idx, doc in enumerate(documents, start=1):
        print(f"      {idx}. {doc.source} ({doc.doc_title}) - {doc.file_size_bytes} bytes")

    if num_docs == 0:
        print("\nNo knowledge documents found to split!")
        return

    # 2. Configure Text Splitter Settings
    # Demonstrating custom chunk size (150 words) and overlap (30 words)
    custom_chunk_size = 150
    custom_chunk_overlap = 30

    demo_splitter = TextSplitter(
        chunk_size=custom_chunk_size,
        chunk_overlap=custom_chunk_overlap
    )

    print(f"\n[2] CHUNKING CONFIGURATION")
    print(f"    - Strategy:              Section-aware Markdown Header + Word Window")
    print(f"    - Configured Chunk Size: {demo_splitter.chunk_size} words max per chunk")
    print(f"    - Configured Overlap:    {demo_splitter.chunk_overlap} words overlap")

    # 3. Generate Chunks
    chunks = demo_splitter.split_documents(documents)
    num_chunks = len(chunks)

    print(f"\n[3] CHUNKING RESULTS SUMMARY")
    print(f"    - Total Documents Processed: {num_docs}")
    print(f"    - Total Chunks Generated:    {num_chunks}")
    print(f"    - Average Chunks per Document: {num_chunks / num_docs:.2f}")

    # 4. Display Example Metadata Structure
    print(f"\n[4] EXAMPLE CHUNK METADATA STRUCTURE (Sample Chunk #1)")
    print("-" * 75)

    if chunks:
        sample_chunk = chunks[0]
        print(f"Chunk ID:     {sample_chunk.chunk_id}")
        print(f"Chunk Index:  {sample_chunk.chunk_index}")
        print(f"Word Count:   {sample_chunk.metadata.get('word_count')} words")
        print(f"Char Count:   {sample_chunk.metadata.get('char_count')} chars")
        print(f"\nMetadata Payload Dictionary:")
        print(json.dumps(sample_chunk.metadata, indent=4))

        preview_text = sample_chunk.text[:200].replace('\n', ' ')
        print(f"\nChunk Content Preview (First 200 chars):")
        print(f'"{preview_text}..."')

    print("-" * 75)

    # 5. Display Breakdown of Generated Chunks per Source Document
    print(f"\n[5] CHUNK BREAKDOWN BY SOURCE DOCUMENT")
    docs_breakdown = {}
    for c in chunks:
        src = c.metadata.get("source", "Unknown")
        docs_breakdown[src] = docs_breakdown.get(src, 0) + 1

    for src, count in docs_breakdown.items():
        print(f"    - {src}: {count} chunk(s) generated")

    print("\n" + "=" * 75)
    print("Text Chunking Demonstration Completed Successfully! (No database created)")
    print("=" * 75)


if __name__ == "__main__":
    run_demonstration()
