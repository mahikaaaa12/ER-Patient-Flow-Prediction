from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ForecastHorizon(BaseModel):
    id: str
    label: str
    value: float
    unit: str = "patients"


class TimeSeriesPoint(BaseModel):
    t: str
    value: float
    kind: str = "forecast"  # observed | forecast


class ArrivalForecastResponse(BaseModel):
    horizon: str = Field(default="24h", description="Selected forecast horizon (24h, 7d, 30d)")
    horizons: Dict[str, Any] = Field(description="Cumulative or aggregated arrival metrics for the horizon")
    forecast_cards: List[ForecastHorizon] = Field(description="Pre-formatted forecast metric cards")
    predicted_peak_time: str = Field(description="Predicted peak arrival time or day")
    predicted_peak_rate: float = Field(description="Highest forecasted arrivals per hour or day")
    trend: str = Field(description="Increasing, Stable, Decreasing")
    series: List[TimeSeriesPoint] = Field(description="Timeline projection for requested horizon")
    model_name: str = Field(default="2-Layer LSTM Neural Network")
    data_source: Optional[str] = Field(default="REAL HISTORICAL DATA (ER_dataset.csv)")
    validation_metrics: Optional[Dict[str, Any]] = Field(default=None)
