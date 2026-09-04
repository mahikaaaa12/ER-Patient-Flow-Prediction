# ERFlow System Architecture & Predictive Machine Learning Documentation

## 1. System Overview
ERFlow is an AI-driven Emergency Room Patient Flow Prediction system providing real-time operational decision support for hospital administrators, triage nurses, and ER clinical directors.

The system combines 3 machine learning pillars:
1. **Supervised Learning (XGBoost Regressor & Classifier)**: Predicts waiting times in minutes and assesses ED crowding risk categories (LOW, MODERATE, HIGH, CRITICAL).
2. **Unsupervised Learning (K-Means, PCA, DBSCAN)**: Discovers operational patient flow patterns and detects abnormal arrival surges / demand anomalies.
3. **Deep Learning (TensorFlow/Keras LSTM)**: Forecasts hourly patient arrival volumes over multi-hour horizons (1h, 3h, 6h, 12h, 24h).

---

## 2. Model Specifications & Inputs

### Supervised XGBoost Models
- **XGBoost Regressor**: Target is queue waiting time in minutes. Features include patients waiting, triage acuity, arrival velocity, hour of day, day of week, and bed occupancy percentage.
- **XGBoost Classifier**: Target is crowding risk category (LOW, MODERATE, HIGH, CRITICAL). Features include waiting room occupancy, available beds, and hourly arrival velocity.

### Unsupervised Flow & Surge Models
- **K-Means Clustering + PCA**: Clusters multi-dimensional hospital operational states into 4 distinct flow regimes.
- **DBSCAN Anomaly Detector**: Identifies spatial density outliers in arrival rates and door-to-bed times to flag emergency department surge anomalies.

### Deep Learning LSTM Engine
- **LSTM Neural Network**: 2-layer Recurrent Neural Network with dropout regularization. Uses historical 168-hour arrival sequences, cyclical temporal embeddings (sin/cos for hour/day/month), and rolling 3h/6h/24h statistics to project cumulative patient arrivals.
