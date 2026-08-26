# AI-Based Emergency Room Patient Flow Prediction - Chatbot API

An intelligent conversational API module designed for Emergency Department (ED) staff and healthcare administrators to query real-time and forecasted patient flow metrics (patient volume, waiting times, ED crowding, and high-demand surge periods).

---

## ML Integration Layer Architecture

```
User Message ("How many patients are expected?")
       │
       ▼
[Safety Guard] ──► Checks scope (blocks medical diagnosis/prescriptions)
       │
       ▼
[Intent Detector] ──► Detects Intent (e.g. PATIENT_VOLUME)
       │
       ▼
[Prediction Service (prediction_service.py)]
       │
       ▼
[Model Adapters & Registry (model_registry.py / model_adapters.py)]
       ├─► PatientVolumeModelAdapter (XGBoost / Random Forest / LSTM / etc.)
       ├─► WaitingTimeModelAdapter (Gradient Boosting / Ridge / etc.)
       ├─► CrowdingModelAdapter (Neural Network / Classification / etc.)
       └─► HighDemandModelAdapter (Surge Classifier / Time Series / etc.)
       │
       ▼
[Response Generator (response_generator.py)]
       ├─► If model available: Formats prediction metrics into clinical summary
       └─► If model unavailable: Returns "The patient-volume prediction model is not available yet."
```

---

## How to Integrate a Trained ML Model

The chatbot utilizes an extensible **Model Adapter Pattern** ([`app/ml_service/model_adapters.py`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/model_adapters.py)).
The Prediction Service is completely agnostic to whether the underlying model was trained with **Scikit-learn, XGBoost, LightGBM, PyTorch, TensorFlow/Keras, ONNX, or custom pipelines**.

Follow these 5 steps to integrate any trained model:

### Step 1: Place Your Model Artifact in `models/`
Copy your trained model file into the configured models directory (e.g. `models/volume_model.pkl` or `models/volume_xgb.json`).

### Step 2: Load the Model Object
Load your trained model artifact using the framework of your choice:

```python
import joblib
# Or import torch, xgboost, keras, etc.
raw_model = joblib.load("models/volume_model.pkl")
```

### Step 3: Define Custom Input Feature Mapping (Optional)
If your model requires a specific numpy matrix, DataFrame, or feature list, define an input preprocessor:

```python
from app.schemas.prediction_schema import PredictionInputData

def extract_volume_features(input_data: PredictionInputData):
    # Extract standardized fields or custom features dictionary
    hist_count = input_data.historical_patient_count or 0
    day_num = 1 if input_data.day_of_week == "Monday" else 0
    return [[hist_count, day_num]]
```

### Step 4: Wrap the Model with the Task Adapter
Instantiate the task adapter ([`PatientVolumeModelAdapter`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/model_adapters.py), [`WaitingTimeModelAdapter`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/model_adapters.py), [`CrowdingModelAdapter`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/model_adapters.py), or [`HighDemandModelAdapter`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/model_adapters.py)):

```python
from app.ml_service.model_adapters import PatientVolumeModelAdapter

volume_adapter = PatientVolumeModelAdapter(
    model_artifact=raw_model,
    model_name="xgboost_er_volume",
    model_version="1.0.0",
    preprocessor=extract_volume_features,
)
```

### Step 5: Register the Adapter with `ModelRegistry`
Register the adapter instance into the global registry:

```python
from app.ml_service.model_registry import model_registry

model_registry.register_model("patient_volume_model", volume_adapter)
```

> [!TIP]
> **Zero API Refactoring**:
> Once registered, all chatbot API routes, intent dispatchers, response formatters, and session logs immediately start serving real predictions without modifying a single line of the Chatbot API or routing code.

---

## Development Mock Provider (`USE_MOCK_MODE`)

> [!IMPORTANT]
> **DEVELOPMENT / TESTING ONLY**:
> The mock providers in [`app/ml_service/mock_models.py`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/mock_models.py) are intended exclusively for offline architecture validation and CI/CD testing.
> They are **NOT** trained ML models and must **NEVER** be presented to users as real predictions. They do not generate fake numerical forecasts.

### Enabling Mock Mode for Local Pipeline Testing
In your `.env` file:
```env
USE_MOCK_MODE=true
```

When active, calls return clearly identified test indicators:
```json
{
  "prediction": null,
  "is_mock": true,
  "model_name": "mock_patient_volume_model"
}
```

### Production / Real Model Mode (Default)
In your `.env` file:
```env
USE_MOCK_MODE=false
```
When `USE_MOCK_MODE=false`, the chatbot exclusively queries the real [`ModelRegistry`](file:///d:/Projects/Bootcamp%20Project%20chatbot/chatbot/app/ml_service/model_registry.py). If model artifacts have not yet been placed in the models directory, it returns the standard unavailable response without crashing.

---

## Setup & Execution Guide

### 1. Creating a Virtual Environment

```bash
cd chatbot

# Create virtual environment
python -m venv venv

# Activate on Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Or activate on Windows (Command Prompt):
.\venv\Scripts\activate.bat

# Or activate on macOS/Linux:
source venv/bin/activate
```

### 2. Installing Dependencies

```bash
pip install -r requirements.txt
```

### 3. Starting the FastAPI Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **OpenAPI JSON Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

### 4. Running Automated Tests

```bash
pytest tests/ -v
```
