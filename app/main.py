from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional
from app.ml_engine import CongestionEngine
from app.schemas import DispatchResponse, DispatchZone
import os

# Global instance
engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    data_path = os.getenv("BTP_DATA_PATH", "data/violations.csv")
    engine = CongestionEngine(data_path=data_path)
    yield
    # Cleanup if necessary
    engine = None

app = FastAPI(
    title="BTP Congestion Dispatch API",
    description="API for Bangalore Traffic Police to extract spatial hotspots",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/dispatch-zones", response_model=DispatchResponse)
async def get_dispatch_zones(limit: int = Query(20, ge=1, le=100)):
    if not engine:
        return DispatchResponse(status="error", active_hotspots_count=0, zones=[])
        
    hotspots = engine.calculate_active_hotspots(top_n=limit)
    
    zones = [DispatchZone(**h) for h in hotspots]
    
    return DispatchResponse(
        status="success",
        active_hotspots_count=len(zones),
        zones=zones
    )
