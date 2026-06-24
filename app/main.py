from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional, List
from app.ml_engine import CongestionEngine
from app.schemas import DispatchResponse, DispatchZone, TelemetryData, DispatchRequest
import os
import json
import asyncio
import logging

# Global instance
engine = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

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

@app.post("/api/v1/ingest")
async def ingest_telemetry(data: TelemetryData):
    if not engine:
        raise HTTPException(status_code=503, detail="Engine not initialized")

    engine.add_telemetry(data.model_dump() if hasattr(data, 'model_dump') else data.dict())

    # Broadcast new dispatch zones after ingestion
    hotspots = engine.calculate_active_hotspots()
    zones = [DispatchZone(**h).model_dump() if hasattr(DispatchZone(**h), 'model_dump') else DispatchZone(**h).dict() for h in hotspots]
    response = {
        "status": "success",
        "active_hotspots_count": len(zones),
        "zones": zones
    }
    asyncio.create_task(manager.broadcast(json.dumps(response)))

    return {"status": "success", "message": "Data ingested successfully"}

@app.post("/api/v1/dispatch")
async def process_dispatch(dispatch_req: DispatchRequest):
    # Simulated production-grade dispatch logic
    # In a real system, this would call an external API (e.g., GPS tracking, pager system)
    logger = logging.getLogger(__name__)

    # Example logic: refine resource allocation
    # e.g., verifying availability from a DB, recording dispatch history
    station = dispatch_req.police_station.replace(' Traffic PS', '')
    tow_trucks = dispatch_req.heavy_tow_trucks
    patrols = dispatch_req.patrol_units

    message = f"Dispatching {tow_trucks} tow trucks and {patrols} patrol units to {station} (Cluster {dispatch_req.cluster_id})."
    logger.info(f"DISPATCH INITIATED: {message}")

    return {
        "status": "success",
        "message": message,
        "dispatch_id": f"D-{dispatch_req.cluster_id}-{asyncio.get_event_loop().time()}"
    }

@app.websocket("/api/v1/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
