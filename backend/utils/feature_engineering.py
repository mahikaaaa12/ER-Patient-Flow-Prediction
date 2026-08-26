"""
Feature engineering and transformation utilities for ERFlow ML models.
Reproduces exact preprocessing pipelines from:
- AIML_Supervised.ipynb (Supervised XGBoost)
- bootcampproject-lstm.ipynb (Deep Learning LSTM)
- Unsupervised_Learning_Aparupa.ipynb (Unsupervised KMeans & DBSCAN)
"""

import math
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np


def get_time_period(hour: int) -> str:
    """Classify hour of day into time period."""
    if 6 <= hour < 12:
        return "Morning"
    elif 12 <= hour < 18:
        return "Afternoon"
    elif 18 <= hour < 22:
        return "Evening"
    else:
        return "Night"


def get_season_from_month(month: int) -> str:
    """Derive meteorological season from month number (1-12)."""
    if month in [12, 1, 2]:
        return "Winter"
    elif month in [3, 4, 5]:
        return "Spring"
    elif month in [6, 7, 8]:
        return "Summer"
    else:
        return "Fall"


def engineer_supervised_features(state: Dict[str, Any]) -> pd.DataFrame:
    """
    Produce the 16 feature columns expected by preprocessor_reg.pkl:
    ['hour_of_day', 'day_of_week', 'is_weekend', 'month', 'arrival_rate',
     'available_beds', 'available_doctors', 'available_nurses',
     'patients_waiting', 'severity_level', 'occupancy_percent',
     'patients_per_bed', 'staff_total', 'patients_per_staff', 'season',
     'time_period']
    """
    hour = int(state.get("hour_of_day") if state.get("hour_of_day") is not None else 12)
    day = int(state.get("day_of_week") if state.get("day_of_week") is not None else 2)

    is_weekend_val = state.get("is_weekend")
    is_weekend = int(is_weekend_val) if is_weekend_val is not None else (1 if day in [5, 6] else 0)

    month = int(state.get("month") if state.get("month") is not None else 7)
    season = state.get("season") or get_season_from_month(month)
    time_period = state.get("time_period") or get_time_period(hour)

    arrival_rate = float(state.get("arrival_rate") if state.get("arrival_rate") is not None else 20.0)
    available_beds = float(state.get("available_beds") if state.get("available_beds") is not None else 10.0)
    available_doctors = float(state.get("available_doctors") if state.get("available_doctors") is not None else 5.0)
    available_nurses = float(state.get("available_nurses") if state.get("available_nurses") is not None else 8.0)
    patients_waiting = float(state.get("patients_waiting") if state.get("patients_waiting") is not None else 15.0)
    severity_level = float(state.get("severity_level") if state.get("severity_level") is not None else 3.0)
    occupancy_percent = float(state.get("occupancy_percent") if state.get("occupancy_percent") is not None else 70.0)

    patients_per_bed = patients_waiting / (available_beds + 1.0)
    staff_total = available_doctors + available_nurses
    patients_per_staff = patients_waiting / (staff_total + 1.0)

    data = {
        "hour_of_day": [hour],
        "day_of_week": [day],
        "is_weekend": [is_weekend],
        "month": [month],
        "arrival_rate": [arrival_rate],
        "available_beds": [available_beds],
        "available_doctors": [available_doctors],
        "available_nurses": [available_nurses],
        "patients_waiting": [patients_waiting],
        "severity_level": [severity_level],
        "occupancy_percent": [occupancy_percent],
        "patients_per_bed": [patients_per_bed],
        "staff_total": [staff_total],
        "patients_per_staff": [patients_per_staff],
        "season": [season],
        "time_period": [time_period],
    }

    feature_cols = [
        "hour_of_day", "day_of_week", "is_weekend", "month", "arrival_rate",
        "available_beds", "available_doctors", "available_nurses", "patients_waiting",
        "severity_level", "occupancy_percent", "patients_per_bed", "staff_total",
        "patients_per_staff", "season", "time_period"
    ]
    return pd.DataFrame(data)[feature_cols]


def engineer_unsupervised_features(state: Dict[str, Any]) -> pd.DataFrame:
    """
    Produce the 6 feature columns for unsupervised clustering & anomaly detection:
    ['arrival_rate', 'waiting_time_minutes', 'severity_level',
     'occupancy_percent', 'patients_per_bed', 'patients_per_staff']
    """
    arrival_rate = float(state.get("arrival_rate") if state.get("arrival_rate") is not None else 20.0)
    waiting_time_minutes = float(state.get("waiting_time_minutes") if state.get("waiting_time_minutes") is not None else 45.0)
    severity_level = float(state.get("severity_level") if state.get("severity_level") is not None else 3.0)
    occupancy_percent = float(state.get("occupancy_percent") if state.get("occupancy_percent") is not None else 70.0)

    available_beds = float(state.get("available_beds") if state.get("available_beds") is not None else 10.0)
    available_doctors = float(state.get("available_doctors") if state.get("available_doctors") is not None else 5.0)
    available_nurses = float(state.get("available_nurses") if state.get("available_nurses") is not None else 8.0)
    patients_waiting = float(state.get("patients_waiting") if state.get("patients_waiting") is not None else 15.0)

    patients_per_bed = float(
        state.get("patients_per_bed")
        if state.get("patients_per_bed") is not None
        else (patients_waiting / (available_beds + 1.0))
    )
    staff_total = available_doctors + available_nurses
    patients_per_staff = float(
        state.get("patients_per_staff")
        if state.get("patients_per_staff") is not None
        else (patients_waiting / (staff_total + 1.0))
    )

    data = {
        "arrival_rate": [arrival_rate],
        "waiting_time_minutes": [waiting_time_minutes],
        "severity_level": [severity_level],
        "occupancy_percent": [occupancy_percent],
        "patients_per_bed": [patients_per_bed],
        "patients_per_staff": [patients_per_staff]
    }
    cols = [
        "arrival_rate", "waiting_time_minutes", "severity_level",
        "occupancy_percent", "patients_per_bed", "patients_per_staff"
    ]
    return pd.DataFrame(data)[cols]


def build_lstm_feature_row(
    arrival_rate: float,
    recent_arrivals: List[float],
    hour: int,
    day_of_week: int,
    month: int
) -> List[float]:
    """
    Build a single 17-feature vector for LSTM time step:
    ['arrival_rate', 'arrival_lag_1', 'arrival_lag_3', 'arrival_lag_6',
     'arrival_lag_12', 'arrival_lag_24', 'arrival_lag_168',
     'arrival_rolling_mean_3h', 'arrival_rolling_mean_6h',
     'arrival_rolling_mean_24h', 'arrival_rolling_std_24h',
     'hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'month_sin', 'month_cos']
    """
    n = len(recent_arrivals)
    lag_1 = recent_arrivals[-1] if n >= 1 else arrival_rate
    lag_3 = recent_arrivals[-3] if n >= 3 else lag_1
    lag_6 = recent_arrivals[-6] if n >= 6 else lag_3
    lag_12 = recent_arrivals[-12] if n >= 12 else lag_6
    lag_24 = recent_arrivals[-24] if n >= 24 else lag_12
    lag_168 = recent_arrivals[-168] if n >= 168 else lag_24

    arr_3 = recent_arrivals[-3:] if n >= 3 else [arrival_rate]
    arr_6 = recent_arrivals[-6:] if n >= 6 else arr_3
    arr_24 = recent_arrivals[-24:] if n >= 24 else arr_6

    rolling_mean_3h = float(np.mean(arr_3))
    rolling_mean_6h = float(np.mean(arr_6))
    rolling_mean_24h = float(np.mean(arr_24))
    rolling_std_24h = float(np.std(arr_24)) if len(arr_24) > 1 else 0.0

    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)
    day_sin = math.sin(2.0 * math.pi * day_of_week / 7.0)
    day_cos = math.cos(2.0 * math.pi * day_of_week / 7.0)
    month_sin = math.sin(2.0 * math.pi * month / 12.0)
    month_cos = math.cos(2.0 * math.pi * month / 12.0)

    return [
        arrival_rate,
        lag_1, lag_3, lag_6, lag_12, lag_24, lag_168,
        rolling_mean_3h, rolling_mean_6h, rolling_mean_24h, rolling_std_24h,
        hour_sin, hour_cos, day_sin, day_cos, month_sin, month_cos
    ]
