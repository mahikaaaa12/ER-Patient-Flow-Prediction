import pytest
from backend.rag.document_loader import document_loader
from backend.rag.text_splitter import TextSplitter, TextChunk, text_splitter

def test_text_splitter_generates_chunks_from_loaded_docs():
    docs = document_loader.load_documents()
    assert len(docs) > 0
    
    chunks = text_splitter.split_documents(docs)
    assert isinstance(chunks, list)
    assert len(chunks) >= len(docs), "Chunks generated should be equal to or greater than the number of documents"

def test_text_chunk_metadata_preservation():
    docs = document_loader.load_documents()
    chunks = text_splitter.split_documents(docs)
    
    for chunk in chunks:
        assert isinstance(chunk, TextChunk)
        assert chunk.chunk_id is not None
        assert chunk.text != ""
        meta = chunk.metadata
        assert "source" in meta
        assert "doc_title" in meta
        assert "section_title" in meta
        assert "word_count" in meta
        assert "char_count" in meta
        assert "chunk_id" in meta
        assert "chunk_index" in meta

def test_configurable_chunk_size_and_overlap():
    docs = document_loader.load_documents()
    small_splitter = TextSplitter(chunk_size=50, chunk_overlap=10)
    large_splitter = TextSplitter(chunk_size=300, chunk_overlap=50)
    
    small_chunks = small_splitter.split_documents(docs)
    large_chunks = large_splitter.split_documents(docs)
    
    assert len(small_chunks) > len(large_chunks), "Smaller chunk_size should produce a greater number of total chunks"
