# ERFlow Patient Surge & Anomaly Detection Audit Report

**Date**: 2026-08-26  
**Target Component**: Surge & Demand Anomaly Detection Module (`high_demand_model` / `detect_surge`)  
**Scope**: Verification of DBSCAN training artifacts vs. Production inference implementation  

---

## Executive Summary

An audit of the ERFlow surge detection implementation revealed a discrepancy between the system documentation/naming and the actual production execution:

- **Documented System Name**: Unsupervised DBSCAN Density Anomaly Detector.
- **Actual Production Execution**: A **hybrid operational anomaly detector** combining Euclidean distance to fitted **K-Means cluster centroids** (`kmeans_model.joblib`) with **Z-score parametric statistical thresholds** ($>1.96\sigma$) and **clinical occupancy rules** ($>85-88\%$).
- **Status of DBSCAN Artifact**: Only a hyperparameter metadata file ([`ml_model/unsupervised/dbscan_params.json`](file:///d:/Downloads/erflow_project/ml_model/unsupervised/dbscan_params.json)) is saved. No serialized, fitted `scikit-learn` DBSCAN estimator exists in the repository.

---

## 1. Technical Audit Matrix

| Metric / Dimension | Training & Artifact Specs | Production Inference Implementation | Discrepancy Status |
|---|---|---|---|
| **Model Type** | DBSCAN Density Clustering | K-Means Centroid Distance + Parametric Z-Score | **Discrepancy** (K-Means + Rule Engine used) |
| **Artifact Path** | `ml_model/unsupervised/dbscan_params.json` | `dbscan_params.json`, `kmeans_model.joblib`, `unsupervised_scaler.joblib` | **Discrepancy** (JSON metadata only) |
| **Hyperparameters** | `eps = 0.8`, `min_samples = 10` | Unused in execution (Loaded as dict metadata) | **Discrepancy** (`eps` not evaluated) |
| **Features Expected** | 6 Features (`arrival_rate`, `waiting_time_minutes`, `severity_level`, `occupancy_percent`, `patients_per_bed`, `patients_per_staff`) | 6 Features in `unsupervised_service.py`; 3 Features in `HighDemandModelAdapter` | **Partial** (Backend uses 6; Chatbot uses 3) |
| **Preprocessing** | `StandardScaler` (`unsupervised_scaler.joblib`) | `StandardScaler.transform()` | **Identical** |
| **Algorithm Class** | Transductive Density Clustering | Distance to Nearest K-Means Center (`np.linalg.norm`) | **Discrepancy** (Distance-to-Centroid used) |
| **Output Schema** | `is_surge: bool`, `status: str`, `severity: str` | `is_surge: bool`, `status: str`, `severity: str` | **Identical** |

---

## 2. Detailed Findings

### 1. Was a Fitted DBSCAN Model Trained?
- **No serialized DBSCAN model object exists.** In `scikit-learn`, `DBSCAN` is a non-parametric, transductive algorithm designed for cluster assignment on a fixed dataset. It does not provide an out-of-sample `.predict()` method for new inference vectors.

### 2. Artifact Storage
- Only hyperparameter metadata is saved at [`ml_model/unsupervised/dbscan_params.json`](file:///d:/Downloads/erflow_project/ml_model/unsupervised/dbscan_params.json):
  ```json
  {
    "eps": 0.8,
    "min_samples": 10,
    "features": [
      "arrival_rate",
      "waiting_time_minutes",
      "severity_level",
      "occupancy_percent",
      "patients_per_bed",
      "patients_per_staff"
    ]
  }
  ```

### 3. Preprocessing & Feature Transformation
- Uses `unsupervised_scaler.joblib` (`StandardScaler` fitted on the 6 operational features). Mean vector: `[18.32, 43.35, 3.00, 57.63, 1.24, 1.52]`. Standard deviations: `[8.94, 30.16, 1.41, 32.85, 1.05, 1.23]`.

### 4. Production Inference Mechanics
Production inference runs in two backend locations:

#### A. Backend Microservice ([`backend/services/unsupervised_service.py`](file:///d:/Downloads/erflow_project/backend/services/unsupervised_service.py))
1. Standardizes 6 input features via `unsupervised_scaler.joblib`.
2. Calculates Euclidean distance to nearest K-Means cluster center:
   $$\text{min\_dist} = \min_{k} \| \mathbf{C}_k - \mathbf{X}_{\text{scaled}} \|_2$$
3. Evaluates surge anomaly status using combined criteria:
   $$\text{is\_surge} = (\text{arrival\_rate} > \text{normal\_max} \times 1.3) \lor (\text{min\_dist} > 1.4) \lor (\text{occupancy\_percent} > 88.0\%)$$

#### B. Chatbot Microservice Adapter ([`chatbot/app/ml_service/model_adapters.py`](file:///d:/Downloads/erflow_project/chatbot/app/ml_service/model_adapters.py))
1. Extracts `arrival_rate`, `occupancy_percent`, and `hour_of_day`.
2. Computes Z-score deviation against diurnal mean ($18.0 \pm 4.5$ pts/hr):
   $$\text{deviation} = \frac{\text{arrival\_rate} - \mu}{\mu} \times 100\%$$
3. Evaluates anomaly trigger:
   $$\text{is\_surge} = (\text{arrival\_rate} > \mu + 1.96\sigma) \lor (\text{occupancy\_percent} > 85.0\%)$$

---

## 3. What Does "Surge Detected" Actually Mean?

A `"ANOMALOUS SURGE DETECTED"` result means that current emergency room operational demand exceeds normal baseline volume by at least **$1.96$ standard deviations** (or $>30\%$ above diurnal baseline), or that bed occupancy exceeds **85–88%**, or that the operational state vector lies beyond standard K-Means cluster boundaries ($\text{distance} > 1.4$).

---

## 4. Known Discrepancies

1. **Algorithm Mismatch**: System documentation labels the model as "DBSCAN Density Anomaly", whereas production code uses K-Means cluster distance and Z-score statistical rules.
2. **Artifact Discrepancy**: `dbscan_params.json` stores `eps = 0.8` and `min_samples = 10`, but neither hyperparameter is used during inference.
3. **Feature Count Discrepancy**: `dbscan_params.json` lists 6 features, `unsupervised_service.py` uses all 6, but `HighDemandModelAdapter` in the chatbot service uses 3 features.

---

## 5. Recommended Implementation Options

### Option A: Implement Genuine Out-of-Sample DBSCAN Anomaly Detection
- **Approach**: Load the baseline dataset (`ER_dataset.csv`), fit `DBSCAN(eps=0.8, min_samples=10)` on `X_scaled`, and store core sample vectors. For new inference samples, compute distance to nearest core sample: if $\min \| \mathbf{X}_{\text{new}} - \mathbf{X}_{\text{core}} \| > \epsilon$, classify as anomaly (noise point).
- **Pros**: Matches exact mathematical definition of DBSCAN anomaly detection.
- **Cons**: Requires loading core samples during inference; sensitive to scaling.

### Option B (RECOMMENDED): Reframe System as "Hybrid Operational Surge & Anomaly Detector"
- **Approach**: Maintain the existing, highly reliable K-Means centroid distance + statistical Z-score threshold pipeline, and update documentation and model labels to **"Hybrid K-Means & Statistical Anomaly Detector"**.
- **Pros**: Requires zero architectural changes; preserve 100% test suite compatibility; accurately reflects actual production execution.
- **Cons**: Requires documentation update.
