"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { Activity, MapPin } from 'lucide-react';

export interface DispatchZone {
  cluster_id: number;
  primary_police_station: string;
  center_lat: number;
  center_lon: number;
  total_vehicles_involved: number;
  total_severity_score: number;
  heavy_count: number;
  medium_count: number;
  light_count: number;
}

interface TacticalMapplsCanvasProps {
  zones: DispatchZone[];
  isSandboxActive: boolean;
  onPolygonComplete: (data: any) => void;
  onSelectZone?: (zone: DispatchZone) => void;
}

export default function TacticalMapplsCanvas({ 
  zones, 
  isSandboxActive, 
  onPolygonComplete, 
  onSelectZone 
}: TacticalMapplsCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const drawingRef = useRef<boolean>(false);
  const drawnPointsRef = useRef<[number, number][]>([]);
  const polylineRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize Leaflet map via CDN — fast, reliable, no API key required
  useEffect(() => {
    if (mapInstanceRef.current || !mapContainerRef.current) return;

    const initLeaflet = () => {
      const L = (window as any).L;
      if (!L || mapInstanceRef.current) return;

      // Dark tile layer using CartoDB dark matter — looks perfect for a tactical ops UI
      const map = L.map(mapContainerRef.current, {
        center: [12.9716, 77.5946],
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setIsMapLoaded(true);
    };

    // Inject Leaflet CSS + JS if not already present
    if (!(window as any).L) {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = initLeaflet;
        document.head.appendChild(script);
      }
    } else {
      initLeaflet();
    }

    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch { /* ignore */ }
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Sync zone markers — clears and redraws on every zone update
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current || !markersLayerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    markersLayerRef.current.clearLayers();

    zones.forEach((zone) => {
      const severity = zone.total_severity_score;

      let color = '#10b981';   // emerald = low
      let radius = 20;

      if (severity > 50) {
        color = '#f43f5e'; radius = 40;  // rose = critical
      } else if (severity > 20) {
        color = '#f59e0b'; radius = 30;  // amber = moderate
      }

      // Custom divIcon — glowing tactical pulsing dot
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:${radius}px;height:${radius}px;display:flex;align-items:center;justify-content:center;">
            <div style="
              position:absolute;inset:0;border-radius:50%;
              background:${color}40;
              animation:leaflet-ping 1.5s ease-out infinite;
            "></div>
            <div style="
              position:relative;
              width:${radius * 0.65}px;height:${radius * 0.65}px;
              border-radius:50%;
              background:${color};
              border:2px solid #fff;
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-family:monospace;font-size:${radius < 28 ? 8 : 10}px;font-weight:bold;
              box-shadow:0 0 10px ${color}99;
              cursor:pointer;
            ">${zone.total_vehicles_involved}</div>
          </div>
        `,
        iconSize: [radius, radius],
        iconAnchor: [radius / 2, radius / 2],
      });

      const marker = L.marker([zone.center_lat, zone.center_lon], { icon });

      marker.bindPopup(`
        <div style="background:#18181b;color:#f4f4f5;border:1px solid #3f3f46;border-radius:8px;padding:12px;min-width:230px;font-family:monospace;font-size:11px;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #27272a;padding-bottom:6px;margin-bottom:8px;">
            <strong style="color:${color};">CLUSTER ${zone.cluster_id}</strong>
            <span style="background:#27272a;padding:1px 8px;border-radius:4px;color:#a1a1aa;">${severity.toFixed(1)} SEV</span>
          </div>
          <div style="margin-bottom:3px;display:flex;justify-content:space-between;"><span style="color:#71717a;">STATION</span><span>${zone.primary_police_station}</span></div>
          <div style="margin-bottom:8px;display:flex;justify-content:space-between;"><span style="color:#71717a;">COORDS</span><span>${zone.center_lat.toFixed(4)}, ${zone.center_lon.toFixed(4)}</span></div>
          <div style="border-top:1px solid #27272a;padding-top:8px;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#a1a1aa;">HEAVY</span><span>${zone.heavy_count}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a1a1aa;">MEDIUM</span><span>${zone.medium_count}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a1a1aa;">LIGHT</span><span>${zone.light_count}</span></div>
          </div>
          <div style="margin-top:8px;background:#09090b;border:1px solid #27272a;padding:6px;border-radius:4px;text-align:center;">
            TOTAL: <strong style="color:#fff;">${zone.total_vehicles_involved}</strong>
          </div>
        </div>
      `, { className: 'leaflet-tactical-popup' });

      marker.on('click', () => onSelectZone?.(zone));
      markersLayerRef.current.addLayer(marker);
    });
  }, [zones, isMapLoaded, onSelectZone]);

  // Sandbox drawing — freehand polygon using Leaflet native click events
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;

    const cleanupDraw = () => {
      map.off('click');
      map.off('dblclick');
      drawingRef.current = false;
      drawnPointsRef.current = [];
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      map.getContainer().style.cursor = '';
    };

    if (isSandboxActive) {
      drawingRef.current = true;
      drawnPointsRef.current = [];
      map.getContainer().style.cursor = 'crosshair';

      polylineRef.current = L.polyline([], {
        color: '#10b981', weight: 3, dashArray: '8,4', opacity: 0.9
      }).addTo(map);

      map.on('click', (e: any) => {
        if (!drawingRef.current) return;
        drawnPointsRef.current.push([e.latlng.lat, e.latlng.lng]);
        polylineRef.current?.setLatLngs(drawnPointsRef.current);
      });

      map.on('dblclick', (e: any) => {
        e.originalEvent.preventDefault();
        const points = drawnPointsRef.current;
        if (points.length >= 3) {
          onPolygonComplete({ latlngs: points });
          // Draw closed filled polygon briefly
          const poly = L.polygon(points, {
            color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2
          }).addTo(map);
          setTimeout(() => map.removeLayer(poly), 4000);
        }
        cleanupDraw();
      });
    } else {
      cleanupDraw();
    }

    return cleanupDraw;
  }, [isSandboxActive, isMapLoaded, onPolygonComplete]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden border border-zinc-800 rounded-lg">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Status badge */}
      <div className="absolute top-3 right-3 z-[1000] pointer-events-none">
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 px-3 py-2 rounded-lg flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${isMapLoaded ? 'text-emerald-500 animate-pulse' : 'text-zinc-600'}`} />
          <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
            {isMapLoaded ? 'LIVE MAP ONLINE' : 'LOADING MAP...'}
          </span>
        </div>
      </div>

      {/* Loading overlay — disappears as soon as Leaflet fires */}
      {!isMapLoaded && (
        <div className="absolute inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-800 border-t-emerald-500 animate-spin" />
            <MapPin className="absolute inset-0 m-auto w-5 h-5 text-zinc-600" />
          </div>
          <span className="text-[10px] font-mono text-zinc-600 tracking-widest">LOADING MAP ENGINE...</span>
        </div>
      )}

      {/* Popup + ping animation styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes leaflet-ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .leaflet-tactical-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tactical-popup .leaflet-popup-tip {
          background: #18181b !important;
        }
        .leaflet-tactical-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-container {
          background: #09090b !important;
        }
        .leaflet-bar a {
          background: #18181b !important;
          color: #a1a1aa !important;
          border-color: #3f3f46 !important;
        }
        .leaflet-bar a:hover {
          background: #27272a !important;
          color: #f4f4f5 !important;
        }
      `}} />
    </div>
  );
}
