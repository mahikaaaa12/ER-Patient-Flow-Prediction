import pytest
from backend.rag.document_loader import document_loader
from backend.rag.text_splitter import text_splitter
from backend.rag.vector_store import vector_store, VectorStore
from backend.rag.config import rag_settings

def test_vector_store_get_or_create_collection():
    vs = VectorStore(collection_name="test_erflow_collection")
    assert vs.collection_name == "test_erflow_collection"

def test_vector_store_ingestion_and_has_data():
    docs = document_loader.load_documents()
    chunks = text_splitter.split_documents(docs)
    
    count_added = vector_store.add_chunks(chunks)
    assert count_added > 0
    assert vector_store.has_data() is True
    assert vector_store.count() >= count_added

def test_vector_store_similarity_search():
    results = vector_store.similarity_search("What is the ESI level 1 triage protocol?", top_k=2)
    assert isinstance(results, list)
    assert len(results) > 0
    assert "text" in results[0]
    assert "metadata" in results[0]
    assert "score" in results[0]

def test_vector_store_persistence():
    persisted = vector_store.persist()
    assert persisted is True
