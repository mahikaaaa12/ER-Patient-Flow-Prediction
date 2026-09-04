import pytest
from pathlib import Path
from backend.rag.document_loader import DocumentLoader, Document, document_loader

def test_document_loader_scans_knowledge_base():
    docs = document_loader.load_documents()
    assert isinstance(docs, list)
    assert len(docs) > 0, "Document loader should find knowledge documents in backend/knowledge_base/documents"

def test_document_metadata_preservation():
    docs = document_loader.load_documents()
    for doc in docs:
        assert isinstance(doc, Document)
        assert doc.source is not None
        assert doc.file_type in [".md", ".txt", ".pdf"]
        assert doc.file_size_bytes > 0
        assert "source" in doc.metadata
        assert "doc_title" in doc.metadata
        assert "file_type" in doc.metadata
        assert "file_size_bytes" in doc.metadata

def test_document_loader_graceful_handling_missing_dir(tmp_path):
    missing_dir = tmp_path / "non_existent_knowledge_dir"
    loader = DocumentLoader(docs_dir=missing_dir)
    docs = loader.load_documents()
    assert docs == []
    assert missing_dir.exists(), "Document loader should gracefully create missing directory without crashing"

def test_document_loader_graceful_handling_invalid_file(tmp_path):
    # Create zero byte file
    empty_file = tmp_path / "empty.md"
    empty_file.write_text("")
    
    loader = DocumentLoader(docs_dir=tmp_path)
    docs = loader.load_documents()
    assert docs == [], "Empty 0-byte files should be skipped gracefully"
