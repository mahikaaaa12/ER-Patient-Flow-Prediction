from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class HospitalState(BaseModel):
    """Current snapshot of Emergency Room operational variables."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "hour_of_day": 18,
                "day_of_week": 4,
                "month": 7,
                "arrival_rate": 28.0,
                "available_beds": 8.0,
                "available_doctors": 5.0,
                "available_nurses": 9.0,
                "patients_waiting": 24.0,
                "severity_level": 3.0,
                "occupancy_percent": 78.0
            }
        }
    )

    hour_of_day: int = Field(default=18, ge=0, le=23, description="Hour of the day (0-23)")
    day_of_week: int = Field(default=4, ge=0, le=6, description="Day of week (0=Mon, 6=Sun)")
    is_weekend: Optional[int] = Field(default=None, ge=0, le=1, description="1 if weekend else 0")
    month: int = Field(default=7, ge=1, le=12, description="Month of year (1-12)")
    season: Optional[str] = Field(default=None, description="Summer, Fall, Winter, Spring")
    time_period: Optional[str] = Field(default=None, description="Morning, Afternoon, Evening, Night")

    arrival_rate: float = Field(default=28.0, ge=0.0, description="Current patient arrivals per hour")
    available_beds: float = Field(default=8.0, ge=0.0, description="Available staffed ER beds")
    available_doctors: float = Field(default=5.0, ge=0.0, description="Currently active physicians")
    available_nurses: float = Field(default=9.0, ge=0.0, description="Currently active nursing staff")
    patients_waiting: float = Field(default=24.0, ge=0.0, description="Patients waiting in triage/queue")
    severity_level: float = Field(default=3.0, ge=1.0, le=5.0, description="Average acuity/severity (1-5)")
    occupancy_percent: float = Field(default=78.0, ge=0.0, le=100.0, description="ER bed occupancy rate (0-100%)")
    waiting_time_minutes: Optional[float] = Field(default=None, ge=0.0, description="Known or current wait time in min")

    recent_arrival_history: Optional[List[float]] = Field(
        default=None,
        description="Optional list of consecutive past hourly arrival rates for LSTM sequencing"
    )
