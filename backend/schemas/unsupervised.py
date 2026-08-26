from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class ClusterCoordinate(BaseModel):
    x: float
    y: float
    cluster_id: int


class FlowPatternResponse(BaseModel):
    pattern_name: str = Field(description="Identified pattern (e.g. High Demand, Medium Demand, Low Demand)")
    confidence: float = Field(description="Confidence percentage (0-100%)")
    cluster_id: int = Field(description="Assigned KMeans cluster integer")
    description: str = Field(description="Clinical description of the pattern")
    current_point: Dict[str, float] = Field(description="Current 2D PCA point {x, y}")
    model_name: str = Field(default="K-Means Clustering")


class SurgeDetectionResponse(BaseModel):
    is_surge: bool = Field(description="True if abnormal operational strain or spike detected")
    status: str = Field(description="Human-readable status banner")
    severity: str = Field(description="Low, Moderate, High")
    current_arrival_rate: float
    normal_arrival_rate: str
    deviation_percent: str
    detected_at: str
    description: str
    model_name: str = Field(default="DBSCAN Anomaly Detector")


class UnsupervisedPredictionResponse(BaseModel):
    flow_pattern: FlowPatternResponse
    surge_detection: SurgeDetectionResponse
