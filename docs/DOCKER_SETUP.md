# ERFlow Docker Deployment & Containerization Guide

This document details the production-style containerization architecture for ERFlow, orchestrating the React/Vite frontend, FastAPI ML inference backend, and FastAPI chatbot microservice.

---

## 1. Container Architecture Overview

```
                         ┌─────────────────────────────┐
                         │       User Web Browser      │
                         │   http://localhost:5173     │
                         └──────────────┬──────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
             ▼                                                     ▼
  ┌──────────────────────┐                             ┌──────────────────────┐
  │  erflow-frontend     │                             │  erflow-chatbot      │
  │  (Nginx SPA Container│                             │  (FastAPI Microserv.)│
  │   Port 80 -> 5173)   │                             │   Port 8001:8001     │
  └──────────────────────┘                             └──────────┬───────────┘
             │                                                    │
             │        ┌──────────────────────────────┐            │
             └───────►│  erflow-ml-backend           │◄───────────┘
                      │  (FastAPI Inference Engine)  │
                      │   Port 8000:8000             │
                      └──────────────┬───────────────┘
                                     │
                      ┌──────────────┴───────────────┐
                      │  Trained ML Artifacts        │
                      │  (XGBoost / LSTM / K-Means)  │
                      └──────────────────────────────┘
```

| Service | Container Name | Image / Build Base | Published Port | Health Check Endpoint |
|---|---|---|---|---|
| **`frontend`** | `erflow-frontend` | `node:20-alpine` $\rightarrow$ `nginx:alpine` | `5173:80` | `http://localhost:5173/` |
| **`ml-backend`** | `erflow-ml-backend` | `python:3.11-slim` | `8000:8000` | `http://localhost:8000/api/health` |
| **`chatbot`** | `erflow-chatbot` | `python:3.11-slim` | `8001:8001` | `http://localhost:8001/api/health` |

---

## 2. Prerequisites

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+ (included in Docker Desktop)
- Minimum RAM allocation: **4 GB** (for loading TensorFlow LSTM & XGBoost model memory buffers)

---

## 3. Environment Variables (`.env`)

Configuration is managed via `.env` (copied from `.env.example`):

```bash
# Application Environment
APP_ENV=production
DEBUG=false

# ML Inference Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
VITE_API_BASE_URL=http://localhost:8000

# Chatbot Microservice
CHATBOT_HOST=0.0.0.0
CHATBOT_PORT=8001
VITE_CHATBOT_API_URL=http://localhost:8001
USE_MOCK_MODE=false
USE_MOCK_MODELS=false

# Frontend Configuration
FRONTEND_PORT=5173
```

---

## 4. Startup, Stopping & Maintenance Commands

### A. One-Command Build & Startup
To build and start all 3 services in orchestrated order:
```bash
docker compose up --build
```
Or run in detached background mode:
```bash
docker compose up -d --build
```

### B. Accessing Running Applications
- **Dashboard UI**: [http://localhost:5173](http://localhost:5173)
- **ML Backend Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Chatbot API Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)

### C. Stopping Services
```bash
docker compose down
```

### D. Rebuilding Individual Services
If modifying only backend code:
```bash
docker compose build ml-backend
docker compose up -d ml-backend
```

---

## 5. End-to-End Verification Matrix

| Verification Path | Verification Action | Expected Result | Status |
|---|---|---|---|
| **Frontend $\rightarrow$ Backend** | `GET http://localhost:8000/api/health` | Status 200 `{"status": "healthy"}` | **PASS** |
| **Backend $\rightarrow$ Models** | `POST http://localhost:8000/api/overview` | Evaluates live XGBoost & LSTM predictions | **PASS** |
| **Frontend $\rightarrow$ Chatbot** | `POST http://localhost:8001/api/chat` | Natural-language query returns grounded answer | **PASS** |
| **Chatbot $\rightarrow$ ML Services** | Ask: *"What is the wait time?"* | Returns model wait estimate (e.g. 67 min) | **PASS** |
| **Offline Fallback** | Stop `ml-backend` (`docker compose stop ml-backend`) | UI cleanly displays "Prediction Unavailable" banner | **PASS** |

---

## 6. Troubleshooting

1. **Backend Health Check Timeout**:
   - Verify Python model artifacts exist in `/app/ml_model`.
   - Ensure Docker container has at least 4 GB RAM allocated.
2. **CORS Connection Refused**:
   - Check that `VITE_API_BASE_URL` is set to `http://localhost:8000` in `.env` before running `docker compose up --build`.
