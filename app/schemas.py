from pydantic import BaseModel
from typing import List

class DispatchZone(BaseModel):
    cluster_id: int
    primary_police_station: str
    center_lat: float
    center_lon: float
    total_vehicles_involved: int
    total_severity_score: float
    heavy_count: int
    medium_count: int
    light_count: int

class DispatchResponse(BaseModel):
    status: str
    active_hotspots_count: int
    zones: List[DispatchZone]

class TelemetryData(BaseModel):
    latitude: float
    longitude: float
    vehicle_type: str
    junction_name: str
    police_station: str

class DispatchRequest(BaseModel):
    cluster_id: int
    police_station: str
    heavy_tow_trucks: int
    patrol_units: int
