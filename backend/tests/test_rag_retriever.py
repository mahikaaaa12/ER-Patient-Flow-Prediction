import pytest
from backend.rag.retriever import Retriever, retriever
from backend.rag.config import rag_settings

def test_retriever_chunks_structure():
    chunks = retriever.retrieve_chunks("What are the ESI triage levels?", top_k=2)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    
    first = chunks[0]
    assert "text" in first
    assert "metadata" in first
    assert "score" in first
    assert first["score"] > 0.0

def test_retriever_configurable_top_k():
    chunks_top1 = retriever.retrieve_chunks("Crowding diversion policy", top_k=1)
    chunks_top3 = retriever.retrieve_chunks("Crowding diversion policy", top_k=3)
    
    assert len(chunks_top1) <= 1
    assert len(chunks_top3) <= 3

def test_retriever_context_formatting():
    context_str, citations, max_score = retriever.retrieve_context("Emergency room patient volume forecast")
    assert context_str != ""
    assert isinstance(citations, list)
    assert len(citations) > 0
    assert max_score > 0.0
    assert "source" in citations[0]
    assert "doc_title" in citations[0]
