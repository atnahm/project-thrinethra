# PROJECT THRINETHRA

The **PROJECT THRINETHRA** is a high-performance spatial analytics platform designed for the Bangalore Traffic Police (BTP). It ingests telemetry data from road sensors/cameras, applies an algorithmic Congestion Severity Index (CSI) weighting to classify vehicle mass types, and uses DBSCAN clustering to identify active geographic gridlock hotspots. 

The system provides a WebGL-accelerated (via Leaflet.js) spatial dashboard for operators to dispatch tactical interception units and draw predictive geofences to simulate road closures.

##  Architecture

The application follows a decoupled microservice architecture:

### 1. Engine Backend (`/app`)
- **Framework:** FastAPI (Python 3.10)
- **Data Processor:** Pandas, Scikit-Learn
- **Core Logic (`ml_engine.py`):**
  - Ingests telemetry from `data/violations.csv`.
  - Calculates vehicle severity scores (e.g., Heavy Trucks x1.0, Scooters x0.1) and junction multipliers.
  - Clusters geographic points using **DBSCAN (Density-Based Spatial Clustering of Applications with Noise)** using the Haversine distance metric (50m epsilon).
  - Provides a graceful fallback dataset (Silk Board, KR Puram) if live telemetry goes offline.
- **Entry Point:** `run.py` (Uvicorn server running on `http://localhost:8000`)

### 2. Operations Dashboard (`/btp-tactical`)
- **Framework:** Next.js 14, React 18, Tailwind CSS
- **Mapping Engine:** Leaflet.js + CartoDB Dark Matter (Zero-dependency, high performance)
- **Key Features:**
  - **Single Source of Truth:** `page.tsx` polls the backend every 5 seconds and manages all state down to its children components to prevent race conditions.
  - **Tactical Map:** Renders live, glowing DOM markers indicating target congestion volume using custom Leaflet `divIcon`.
  - **Sandbox Geofencing:** Utilizes custom Leaflet event listeners, allowing operators to draw custom polygons on the map to mock road closures and generate predictive diversion metrics.
  - **Explainable AI (XAI) Node Graph:** Uses `reactflow` to render the pipeline logic (Telemetry -> Geospatial Context -> CSI Calculation -> Severity Output) visually to the operator.

---

##  Getting Started

The application is fully containerized using Docker and Docker Compose.

### Prerequisites
- Docker & Docker Compose
- Node.js (if running frontend manually)
- Python 3.10+ (if running backend manually)

### Running with Docker (Recommended)
1. Ensure Docker is running on your machine.
2. From the root directory, spin up the stack:
   ```bash
   docker-compose up -d --build
   ```
3. Access the Operations Dashboard at [http://localhost:3000](http://localhost:3000).
4. The Backend API will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### Running Manually
**Backend:**
```bash
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python run.py
```

**Frontend:**
```bash
cd btp-tactical
npm install
npm run dev
```

---

##  Environment Configuration

The frontend requires a `.env.local` file inside the `btp-tactical/` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

##  Codebase Structure
```text
/trafic-cogn
│── /app                   # FastAPI application logic
│   ├── main.py            # API Endpoints
│   ├── ml_engine.py       # DBSCAN and CSI logic
│   └── schemas.py         # Pydantic models
│── /data                  # Data directory (mounts violations.csv)
│── /btp-tactical          # Next.js Frontend App
│   ├── /src/app           # Next.js routing and SSOT (page.tsx)
│   ├── /src/components    # Map canvas and React Flow graphs
│   ├── Dockerfile         # Frontend container definition
│   └── .env.local         # Environment variables
│── Dockerfile.backend     # Backend container definition
│── docker-compose.yml     # Orchestration
│── requirements.txt       # Python dependencies
└── run.py                 # Backend entry script
```
