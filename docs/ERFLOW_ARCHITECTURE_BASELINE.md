# ERFlow Project Architecture Baseline

**Date**: 2026-08-26  
**System**: Emergency Room Patient Flow & Operational AI Platform  
**Backend Host**: `http://localhost:8000`  
**Frontend Host**: `http://localhost:5173` (Vite / React)  

---

## Executive System Overview

The ERFlow platform is an end-to-end Emergency Department (ED) AI system designed to forecast patient arrival volume, estimate triage waiting times, predict department crowding risk, detect patient volume surges, discover flow pattern regimes, and provide a natural language conversational AI assistant.

---

## 1. System Architecture Map

```
[React / Vite Frontend (erflow_project)]
  ├── Dashboard Pages (Overview, WaitingTime, Crowding, Forecast, Flow, Surge, AI)
  ├── ModeContext (REAL ML MODE vs DEMO MODE)
  └── services/api.js (erflowApi HTTP Client)
       │
       ▼ (HTTP REST Requests)
[FastAPI Backend Microservice (chatbot/app)]
  ├── app/api/dashboard_routes.py (Dashboard API Endpoints)
  ├── app/api/chat_routes.py (AI Assistant Chat Endpoint)
  │
  ├── Chatbot & Natural Language Pipeline
  │     ├── SafetyGuard (Medical Refusal Gate)
  │     ├── IntentDetector (Rule-based Regex Priority Evaluator)
  │     ├── InputValidator (Param Verification & Clarification)
  │     ├── ResponseGenerator (Grounded Text Formatting)
  │     └── ConversationManager (Session Context Tracking)
  │
  └── ML Service & Adapter Layer
        ├── PredictionService (Unified Dispatcher)
        ├── ModelRegistry (Singleton Adapter Container)
        │
        ├── WaitingTimeModelAdapter (Supervised XGBoost Regressor)
        ├── CrowdingModelAdapter (Supervised XGBoost Classifier)
        ├── SurgeModelAdapter (Unsupervised DBSCAN Anomaly)
        ├── FlowPatternModelAdapter (Unsupervised K-Means + PCA)
        └── ArrivalForecastModelAdapter (2-Layer LSTM Neural Net)
              │
              ▼
[Trained Model Artifacts (ml_model / backend/artifacts)]
  ├── supervised/ (final_xgb_regressor.pkl, final_xgb_classifier.pkl, preprocessor_reg.pkl)
  ├── unsupervised/ (kmeans_model.joblib, pca_model.joblib, unsupervised_scaler.joblib)
  └── deep_learning/ (er_patient_arrival_lstm.keras, er_feature_scaler.pkl, er_target_scaler.pkl)
```

---

## 2. Core Architecture Pipelines

### A. Dashboard Inference Data Flow
```
Frontend (React Pages)
  ↓ [http://localhost:8000/api/...]
FastAPI Backend (app/api/dashboard_routes.py)
  ↓
Model Services (app/ml_service/prediction_service.py)
  ↓
Model Registry & Adapters (app/ml_service/model_adapters.py)
  ↓
ML Trained Artifacts (ml_model/*.pkl, *.joblib, *.keras)
```

### B. AI Assistant Chatbot Data Flow
```
Frontend (AiAssistant.jsx)
  ↓ [POST /api/chat]
Chatbot Gateway (app/api/chat_routes.py)
  ↓
Safety Check (SafetyGuard -> Refuse Clinical Diagnosis)
  ↓
Intent Detection (IntentDetector -> 12 Intents including WAITING_TIME)
  ↓
Model Routing (PredictionService -> ModelRegistry)
  ↓
ML Model Inference (WaitingTimeModelAdapter -> XGBoost Regressor)
  ↓
Grounded Response Generation (ResponseGenerator)
```

---

## 3. Key Component Inventory

### A. Entry Points
- **Frontend Entry Point**: [`d:\Downloads\erflow_project\erflow_project\src\main.jsx`](file:///d:/Downloads/erflow_project/erflow_project/src/main.jsx)
- **Backend & Chatbot Entry Point**: [`d:\Downloads\erflow_project\chatbot\main.py`](file:///d:/Downloads/erflow_project/chatbot/main.py)

### B. Core Services & Routers
- **Frontend API Client**: [`d:\Downloads\erflow_project\erflow_project\src\services\api.js`](file:///d:/Downloads/erflow_project/erflow_project/src/services/api.js)
- **Frontend Mock Data**: [`d:\Downloads\erflow_project\erflow_project\src\dashboard\mockData.js`](file:///d:/Downloads/erflow_project/erflow_project/src/dashboard/mockData.js)
- **Frontend Mode Context**: [`d:\Downloads\erflow_project\erflow_project\src\context\ModeContext.jsx`](file:///d:/Downloads/erflow_project/erflow_project/src/context/ModeContext.jsx)
- **Dashboard API Routes**: [`d:\Downloads\erflow_project\chatbot\app\api\dashboard_routes.py`](file:///d:/Downloads/erflow_project/chatbot/app/api/dashboard_routes.py)
- **Chatbot API Routes**: [`d:\Downloads\erflow_project\chatbot\app\api\chat_routes.py`](file:///d:/Downloads/erflow_project/chatbot/app/api/chat_routes.py)

### C. ML Service Layer
- **Model Loading & Initialization**: `app/ml_service/model_adapters.py`
- **Model Registry Singleton**: `app/ml_service/model_registry.py`
- **Prediction Dispatcher Service**: `app/ml_service/prediction_service.py`

### D. Trained Model Artifact Locations (`ml_model/`)
1. **Supervised Models**:
   - `supervised/final_xgb_regressor.pkl` (XGBoost Waiting Time Regressor)
   - `supervised/final_xgb_classifier.pkl` (XGBoost Crowding Classifier)
   - `supervised/preprocessor_reg.pkl` (RobustScaler Feature Preprocessor)
   - `supervised/label_encoder.pkl` (Crowding Class Encoder)
2. **Unsupervised Models**:
   - `unsupervised/kmeans_model.joblib` (K-Means Flow Pattern Clustering)
   - `unsupervised/pca_model.joblib` (PCA 2D Spatial Reduction)
   - `unsupervised/unsupervised_scaler.joblib` (StandardScaler Feature Scaler)
   - `unsupervised/dbscan_params.json` (DBSCAN Anomaly Thresholds)
3. **Deep Learning Models**:
   - `deep_learning/er_patient_arrival_lstm.keras` (2-Layer LSTM Sequence Network)
   - `deep_learning/er_feature_scaler.pkl` (MinMaxScaler Feature Scaler)
   - `deep_learning/er_target_scaler.pkl` (MinMaxScaler Target Scaler)

---

## 4. Test Suite Inventory

- **Pytest Suite Location**: [`d:\Downloads\erflow_project\chatbot\tests`](file:///d:/Downloads/erflow_project/chatbot/tests)
  - `test_chatbot.py`: Core chatbot orchestrator unit tests.
  - `test_chatbot_flow.py`: Full multi-turn conversational session flow tests.
  - `test_dashboard_routes.py`: Dashboard FastAPI endpoint tests.
  - `test_intent_detector.py`: Intent detection regex rules & priority tests.
  - `test_mock_models.py`: Fallback and mock model adapter tests.
  - `test_model_adapters.py`: Inference transformation & target un-centering tests.
  - `test_real_model_audit.py`: Real model artifact load and evaluation tests.
  - `test_response_generator.py`: Grounded text generator formatting tests.
  - `test_safety_guard.py`: Clinical refusal and safety gate tests.
