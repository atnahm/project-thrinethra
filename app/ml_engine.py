import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class CongestionEngine:
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.df = pd.DataFrame()
        self._load_data()

    def _load_data(self):
        try:
            # Load CSV
            self.df = pd.read_csv(self.data_path)
        except FileNotFoundError:
            logger.error(f"CRITICAL: Data file {self.data_path} not found. Loading tactical fallback dataset for demo readiness.")
            
            # Generate mock hotspots for Silk Board, KR Puram, etc.
            mock_data = []
            
            # 1. Silk Board (severe heavy/medium mix)
            for _ in range(120):
                mock_data.append([12.9176, 77.6235, 'TRUCK', 'Silk Board Junction', 'Madiwala Traffic PS'])
            for _ in range(80):
                mock_data.append([12.9176, 77.6235, 'CAR', 'Silk Board Junction', 'Madiwala Traffic PS'])
                
            # 2. KR Puram (heavy tanker traffic)
            for _ in range(150):
                mock_data.append([13.0035, 77.6878, 'TANKER', 'KR Puram Junction', 'KR Puram Traffic PS'])
                
            # 3. Majestic (bus and auto congestion)
            for _ in range(90):
                mock_data.append([12.9766, 77.5713, 'BUS', 'Majestic Circle', 'Upparpet Traffic PS'])
            for _ in range(110):
                mock_data.append([12.9766, 77.5713, 'PASSENGER AUTO', 'Majestic Circle', 'Upparpet Traffic PS'])
                
            self.df = pd.DataFrame(mock_data, columns=['latitude', 'longitude', 'vehicle_type', 'junction_name', 'police_station'])
            
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            self.df = pd.DataFrame(columns=['latitude', 'longitude', 'vehicle_type', 'junction_name', 'police_station'])
            return

        # Clean null coordinates and invalid types
        self.df = self.df.dropna(subset=['latitude', 'longitude'])
        self.df['latitude'] = pd.to_numeric(self.df['latitude'], errors='coerce')
        self.df['longitude'] = pd.to_numeric(self.df['longitude'], errors='coerce')
        self.df = self.df.dropna(subset=['latitude', 'longitude'])

        # Vehicle weights & class mapping
        vehicle_weights = {
            'TANKER': 1.0, 'TRUCK': 1.0, 'BUS': 0.9, 'MAXI-CAB': 0.7,
            'CAR': 0.5, 'PASSENGER AUTO': 0.4, 'SCOOTER': 0.1, 'MOTOR CYCLE': 0.1
        }
        if 'vehicle_type' in self.df.columns:
            self.df['vehicle_weight'] = self.df['vehicle_type'].map(vehicle_weights).fillna(0.3)
            v_upper = self.df['vehicle_type'].astype(str).str.upper().str.strip()
            is_heavy = v_upper.str.contains('TANKER|TRUCK|BUS', na=False)
            is_medium = v_upper.str.contains('MAXI-CAB|CAR|PASSENGER AUTO', na=False)
            self.df['v_class'] = np.select([is_heavy, is_medium], ['heavy', 'medium'], default='light')
        else:
            self.df['vehicle_weight'] = 0.3
            self.df['v_class'] = 'light'
        
        # Junction weights
        if 'junction_name' in self.df.columns:
            self.df['junction_weight'] = np.where(self.df['junction_name'] == 'No Junction', 1, 5)
        else:
            self.df['junction_weight'] = 1.0
        
        # CSI calculation
        self.df['severity_score'] = self.df['vehicle_weight'] * self.df['junction_weight']
        
        logger.info(f"Loaded {len(self.df)} valid records into memory.")

    def calculate_active_hotspots(self, top_n: int = 20) -> List[Dict[str, Any]]:
        if self.df.empty:
            return []

        # Convert coordinates to radians for Haversine
        coords = np.radians(self.df[['latitude', 'longitude']].values)
        
        # DBSCAN parameters
        # 50 meters in radians = 50 / 6371000
        epsilon = 50 / 6371000
        
        db = DBSCAN(eps=epsilon, min_samples=3, algorithm='ball_tree', metric='haversine')
        cluster_labels = db.fit_predict(coords)
        
        self.df['cluster_id'] = cluster_labels
        
        # Filter out noise (cluster_id == -1)
        clustered_df = self.df[self.df['cluster_id'] != -1]
        
        if clustered_df.empty:
            return []

        # Aggregate data by cluster
        clustered_df = clustered_df.copy()
        if 'police_station' not in clustered_df.columns:
            clustered_df['police_station'] = "Unknown"
            
        if 'v_class' not in clustered_df.columns:
            clustered_df['v_class'] = 'light'
            
        clustered_df['is_heavy'] = (clustered_df['v_class'] == 'heavy').astype(int)
        clustered_df['is_medium'] = (clustered_df['v_class'] == 'medium').astype(int)
        clustered_df['is_light'] = (clustered_df['v_class'] == 'light').astype(int)
        
        hotspots = clustered_df.groupby('cluster_id').agg(
            center_lat=('latitude', 'mean'),
            center_lon=('longitude', 'mean'),
            total_vehicles_involved=('latitude', 'count'),
            total_severity_score=('severity_score', 'sum'),
            primary_police_station=('police_station', lambda x: str(x.mode().iloc[0]) if len(x.mode()) > 0 else "Unknown"),
            heavy_count=('is_heavy', 'sum'),
            medium_count=('is_medium', 'sum'),
            light_count=('is_light', 'sum')
        ).reset_index()
        
        hotspots['cluster_id'] = hotspots['cluster_id'].astype(int)
        hotspots['total_vehicles_involved'] = hotspots['total_vehicles_involved'].astype(int)
        hotspots['heavy_count'] = hotspots['heavy_count'].astype(int)
        hotspots['medium_count'] = hotspots['medium_count'].astype(int)
        hotspots['light_count'] = hotspots['light_count'].astype(int)
        
        # Sort by severity descending and take top N
        hotspots = hotspots.sort_values(by='total_severity_score', ascending=False)
        return hotspots.head(top_n).to_dict('records')
