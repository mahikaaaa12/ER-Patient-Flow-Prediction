from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ForecastHorizon(BaseModel):
    id: str
    label: str
    value: int
    unit: str = "patients"


class TimeSeriesPoint(BaseModel):
    t: str
    value: float
    kind: str = "forecast"  # observed | forecast


class ArrivalForecastResponse(BaseModel):
    horizons: Dict[str, int] = Field(description="Arrivals at 1h, 3h, 6h, 24h")
    forecast_cards: List[ForecastHorizon] = Field(description="Pre-formatted forecast metric cards")
    predicted_peak_time: str = Field(description="Predicted peak arrival time")
    predicted_peak_rate: int = Field(description="Highest forecasted arrivals/hour")
    trend: str = Field(description="Increasing, Stable, Decreasing")
    series: List[TimeSeriesPoint] = Field(description="24-hour timeline projection")
    model_name: str = Field(default="LSTM Neural Network")
    data_source: Optional[str] = Field(default="REAL HISTORICAL DATA (ER_dataset.csv)")
    validation_metrics: Optional[Dict[str, Any]] = Field(default=None)
