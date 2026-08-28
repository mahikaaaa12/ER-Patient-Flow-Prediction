# ERFlow AI Assistant Chatbot Microservice Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001 \
    USE_MOCK_MODE=false \
    USE_MOCK_MODELS=false

WORKDIR /app

# Install system dependencies required for ML model adapters
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy chatbot requirements and install dependencies
COPY chatbot/requirements.txt /app/chatbot/requirements.txt
RUN pip install --no-cache-dir -r /app/chatbot/requirements.txt

# Copy chatbot source code and trained ML model artifacts
COPY chatbot /app/chatbot
COPY ml_model /app/ml_model

ENV PYTHONPATH=/app/chatbot:/app

EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/api/health')" || exit 1

CMD ["uvicorn", "main:app", "--app-dir", "/app/chatbot", "--host", "0.0.0.0", "--port", "8001"]
