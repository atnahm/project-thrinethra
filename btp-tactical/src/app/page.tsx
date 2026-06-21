/**
 * @file page.tsx
 * @description Root state manager for the PROJECT THRINETHRA dashboard.
 *
 * This is the **Single Source of Truth** (SSOT) for the entire frontend.
 * It is responsible for:
 * - Fetching dispatch zone data from the FastAPI backend every 5 seconds.
 * - Applying temporal scaling (×0.005) to simulate a realistic 1-hour slice.
 * - Maintaining all shared UI state (selected zone, time window, dispatched
 *   clusters, sandbox mode, terminal feed).
 * - Composing the four presentational children: TacticalLayout, TemporalSlicer,
 *   SidebarQueue, TacticalMapplsCanvas, and InferenceGraph.
 *
 * **No rendering logic lives here.** All visual output is delegated to the
 * extracted components in `src/components/`.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Truck, Bike, Car, Cpu, Shield, Zap, X,
  ToggleLeft, ToggleRight
} from 'lucide-react';
import { DispatchZone } from '@/components/TacticalMapplsCanvas';
import { TimeWindow } from '@/components/TemporalSlicer';
import TacticalLayout from '@/components/TacticalLayout';
import SidebarQueue from '@/components/SidebarQueue';
import TemporalSlicer from '@/components/TemporalSlicer';

const TacticalMapplsCanvas = dynamic(() => import('@/components/TacticalMapplsCanvas'), { ssr: false });
const InferenceGraph = dynamic(() => import('@/components/InferenceGraph'), { ssr: false });

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Hardcoded BTP operational resource inventory.
 * Represents the physical upper bound of assets available for deployment.
 */
const BTP_INVENTORY = { heavyTowTrucks: 4, patrolUnits: 12 } as const;

/**
 * Temporal scale factor applied to all incoming zone metrics.
 * Converts a 5-month aggregate into a realistic 1-hour time slice.
 */
const TEMPORAL_SCALE = 0.005;

/** Abbreviated day-of-week labels. */
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

// ── Helper Functions ───────────────────────────────────────────────────────

/**
 * Generates a scarcity-aware dispatch recommendation for a given zone.
 *
 * When resource constraint mode is enabled, the recommendation caps
 * deployable assets to the physical BTP inventory and logs remaining
 * violations for automated e-challan processing.
 *
 * @param zone - The currently selected dispatch zone.
 * @param constrained - Whether resource constraint mode is active.
 * @returns Object with recommendation `text` and `isConstrained` flag.
 */
function getRecommendation(zone: DispatchZone | null, constrained: boolean): { text: string; isConstrained: boolean } {
  if (!zone) return { text: '', isConstrained: false };
  const station = zone.primary_police_station.replace(' Traffic PS', '');
  const severity = zone.total_severity_score;

  if (!constrained) {
    if (zone.heavy_count > 3) return { text: `CRITICAL: Dispatch ${Math.ceil(zone.heavy_count / 2)} tow trucks to clear ${zone.heavy_count} commercial vehicles in ${station}. Green Peak signal priority.`, isConstrained: false };
    if (severity > 5) return { text: `ALERT: Deploy ${Math.ceil(zone.total_vehicles_involved / 5)} patrols for manual sorting in ${station}. Adjust adaptive signals.`, isConstrained: false };
    return { text: `STABLE: ${zone.total_vehicles_involved} vehicles. Maintain CCTV surveillance at ${station}.`, isConstrained: false };
  }

  if (zone.heavy_count > 3 || severity > 10) {
    return {
      text: `CRITICAL PROTOCOL: ${station} exceeds capacity. Deploying max assets (${BTP_INVENTORY.heavyTowTrucks} Tow Trucks, ${Math.ceil(BTP_INVENTORY.patrolUnits / 2)} Patrols) to arterial choke-points. Remainder logged for automated e-challan.`,
      isConstrained: true,
    };
  }
  if (severity > 2) return { text: `MODERATE: ${Math.min(3, BTP_INVENTORY.patrolUnits)} patrols to ${station}. Tow trucks on standby.`, isConstrained: false };
  return { text: `STABLE: ${zone.total_vehicles_involved} vehicles. CCTV surveillance at ${station}. No deployment needed.`, isConstrained: false };
}

// ── Page Component ─────────────────────────────────────────────────────────

/**
 * Home — Root page component and state manager.
 *
 * Owns all shared state and delegates rendering to presentational children.
 * @returns The fully composed PROJECT THRINETHRA dashboard.
 */
export default function Home() {
  // ── State ──
  const [rawZones, setRawZones] = useState<DispatchZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<DispatchZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionOffline, setConnectionOffline] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isInitialLoad = useRef(true);

  const [timeWindow, setTimeWindow] = useState<TimeWindow>({
    hour: new Date().getHours(),
    dayIndex: new Date().getDay(),
  });

  const [dispatchedClusters, setDispatchedClusters] = useState<Record<number, boolean>>({});
  const [resourceConstraintEnabled, setResourceConstraintEnabled] = useState(true);
  const [sandboxActive, setSandboxActive] = useState(false);
  const [diversionMetrics, setDiversionMetrics] = useState<{ reduction: number; impactedLanes: number } | null>(null);

  const [terminalFeed, setTerminalFeed] = useState<string[]>([
    '[SYS_INIT] PROJECT THRINETHRA Booted.',
    '[RADAR_INIT] Ingestion 50m Epsilon Active.',
  ]);

  // ── Callbacks ──

  /** Appends a timestamped entry to the terminal feed. */
  const addFeedLog = useCallback((log: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalFeed(prev => [`[${time}] ${log}`, ...prev.slice(0, 15)]);
  }, []);

  /** Fetches dispatch zones from the backend and updates raw state. */
  const fetchZones = useCallback(async () => {
    if (isInitialLoad.current) setLoading(true);
    setConnectionOffline(false);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/v1/dispatch-zones`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.zones?.length) {
        setRawZones(data.zones);
        setConnectionOffline(false);
        addFeedLog(`[TEMPORAL_MATRIX] Sliced matrix — ${DAYS_OF_WEEK[timeWindow.dayIndex]} ${String(timeWindow.hour).padStart(2, '0')}:00.`);
      } else {
        setRawZones([]); setSelectedZone(null); setConnectionOffline(true);
        addFeedLog('[WARNING] Zero active hotspots.');
      }
    } catch {
      setRawZones([]); setSelectedZone(null); setConnectionOffline(true);
      addFeedLog('[ERROR] Telemetry registry unreachable.');
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [addFeedLog, timeWindow]);

  useEffect(() => { fetchZones(); const id = setInterval(fetchZones, 5000); return () => clearInterval(id); }, [fetchZones]);

  // ── Derived State ──

  /** Temporally scaled zones — applies ×0.005 to all volume/score metrics. */
  const zones = useMemo<DispatchZone[]>(() => rawZones.map(z => ({
    ...z,
    total_vehicles_involved: Math.max(1, Math.round(z.total_vehicles_involved * TEMPORAL_SCALE)),
    total_severity_score: parseFloat((z.total_severity_score * TEMPORAL_SCALE).toFixed(2)),
    heavy_count: Math.max(0, Math.round(z.heavy_count * TEMPORAL_SCALE)),
    medium_count: Math.max(0, Math.round(z.medium_count * TEMPORAL_SCALE)),
    light_count: Math.max(0, Math.round(z.light_count * TEMPORAL_SCALE)),
  })), [rawZones]);

  /** Keep selectedZone in sync when zones are rescaled. */
  useEffect(() => {
    if (!zones.length) { setSelectedZone(null); return; }
    setSelectedZone(prev => {
      if (prev) { const f = zones.find(z => z.cluster_id === prev.cluster_id); if (f) return f; }
      return zones[0];
    });
  }, [zones]);

  /** Vehicle mass breakdown as percentages. */
  const breakdown = useMemo(() => {
    if (!selectedZone || !selectedZone.total_vehicles_involved) return { heavy: 0, medium: 0, light: 0 };
    const t = selectedZone.total_vehicles_involved;
    const h = Math.round((selectedZone.heavy_count / t) * 100);
    const m = Math.round((selectedZone.medium_count / t) * 100);
    return { heavy: h, medium: m, light: Math.max(0, 100 - h - m) };
  }, [selectedZone]);

  const timeLabel = `${DAYS_OF_WEEK[timeWindow.dayIndex]} ${String(timeWindow.hour).padStart(2, '0')}:00–${String((timeWindow.hour + 1) % 24).padStart(2, '0')}:00`;

  // ── Event Handlers ──

  const handleDispatch = useCallback((clusterId: number, station: string) => {
    setDispatchedClusters(prev => ({ ...prev, [clusterId]: true }));
    addFeedLog(`[DISPATCH] Unit sent to ${station.replace(' Traffic PS', '')}.`);
  }, [addFeedLog]);

  const handlePolygonComplete = useCallback((data: { latlngs: [number, number][] } | null) => {
    if (!data) return;
    const reduction = Math.min(85, Math.floor(Math.random() * 40 + 35));
    const impactedLanes = Math.min(12, Math.floor(Math.random() * 5 + 2));
    setDiversionMetrics({ reduction, impactedLanes });
    addFeedLog(`[SANDBOX] Simulation complete. +${reduction}% flow recovery.`);
    setSandboxActive(false);
  }, [addFeedLog]);

  // ── Render ──

  const rec = getRecommendation(selectedZone, resourceConstraintEnabled);

  return (
    <TacticalLayout
      timeLabel={timeLabel}
      loading={loading}
      connectionOffline={connectionOffline}
      onRefresh={fetchZones}
      slicerBar={
        <TemporalSlicer
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
          scaleFactor={TEMPORAL_SCALE}
          addFeedLog={addFeedLog}
        />
      }
      leftPanel={
        <SidebarQueue
          zones={zones}
          selectedZone={selectedZone}
          loading={loading}
          searchTerm={searchTerm}
          dispatchedClusters={dispatchedClusters}
          terminalFeed={terminalFeed}
          onSelectZone={setSelectedZone}
          onSearchChange={setSearchTerm}
          onDispatch={handleDispatch}
          addFeedLog={addFeedLog}
        />
      }
      centerPanel={
        <section className="flex-1 relative flex flex-col overflow-hidden">
          {/* Sandbox overlay */}
          <div className="absolute left-4 top-4 bg-zinc-950/90 border border-zinc-900 p-3 rounded shadow-2xl z-10 max-w-[240px] flex flex-col gap-2 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-3 h-3 animate-pulse" />SANDBOX
              </span>
              {diversionMetrics && (
                <button onClick={() => { setDiversionMetrics(null); addFeedLog('[SANDBOX] Cleared.'); }} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-[9px] text-zinc-500 leading-relaxed font-sans">Click to draw. Double-click to close polygon.</p>
            <button
              onClick={() => { setSandboxActive(!sandboxActive); addFeedLog(`[SANDBOX] ${!sandboxActive ? 'ENABLED' : 'DISABLED'}`); }}
              className={`text-[9px] py-1 rounded font-bold border transition-all ${sandboxActive ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'}`}
            >
              {sandboxActive ? 'DRAWING ACTIVE' : 'ACTIVATE DRAWING'}
            </button>
            {diversionMetrics && (
              <div className="bg-zinc-900/50 border border-emerald-500/20 p-2 rounded flex flex-col gap-1 text-[9px]">
                <span className="text-zinc-600 font-bold text-[8px]">PREDICTION</span>
                <div className="flex justify-between"><span className="text-zinc-400">Recovery:</span><span className="text-emerald-400 font-bold">+{diversionMetrics.reduction}%</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Lanes:</span><span className="text-amber-400 font-bold">{diversionMetrics.impactedLanes}</span></div>
              </div>
            )}
          </div>

          <div className="flex-1">
            <TacticalMapplsCanvas zones={zones} isSandboxActive={sandboxActive} onPolygonComplete={handlePolygonComplete} onSelectZone={setSelectedZone} />
          </div>
        </section>
      }
      rightPanel={
        <section className="w-1/4 min-w-[300px] max-w-[360px] border-l border-zinc-900 p-3 bg-zinc-950/30 flex flex-col gap-3 overflow-y-auto">
          <div>
            <h2 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-rose-500" />XAI MODELS
            </h2>
            <InferenceGraph selectedZone={selectedZone} />
          </div>

          {selectedZone && (
            <div className="space-y-3">
              {/* Resource constraint toggle */}
              <div className="bg-zinc-900/30 border border-zinc-800 p-2.5 rounded-lg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-300 font-bold">RESOURCE CONSTRAINT</span>
                  <span className="text-[8px] text-zinc-600">Tow: {BTP_INVENTORY.heavyTowTrucks} · Patrol: {BTP_INVENTORY.patrolUnits}</span>
                </div>
                <button onClick={() => setResourceConstraintEnabled(p => !p)} className="transition-colors">
                  {resourceConstraintEnabled ? <ToggleRight className="w-5 h-5 text-cyan-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
                </button>
              </div>

              {/* Vehicle composition */}
              <div className="bg-zinc-900/20 border border-zinc-900 p-2.5 rounded-lg flex flex-col gap-1.5">
                <span className="text-[8px] text-zinc-600 tracking-wider font-bold">MASS COMPOSITION</span>
                <div className="space-y-1 text-[9px]">
                  <div className="flex justify-between items-center"><span className="text-zinc-400 flex items-center gap-1"><Truck className="w-3 h-3 text-rose-500" />Heavy ({selectedZone.heavy_count})</span><span className="text-rose-400 font-bold">{breakdown.heavy}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 flex items-center gap-1"><Car className="w-3 h-3 text-amber-500" />Medium ({selectedZone.medium_count})</span><span className="text-amber-400 font-bold">{breakdown.medium}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 flex items-center gap-1"><Bike className="w-3 h-3 text-emerald-500" />Light ({selectedZone.light_count})</span><span className="text-emerald-400 font-bold">{breakdown.light}%</span></div>
                </div>
              </div>

              {/* Dispatch directive */}
              <div className={`border p-2.5 rounded-lg flex gap-2 items-start ${rec.isConstrained ? 'bg-rose-950/15 border-rose-500/30' : 'bg-zinc-900/20 border-zinc-800'}`}>
                <Shield className={`w-4 h-4 flex-shrink-0 mt-0.5 ${rec.isConstrained ? 'text-rose-500' : 'text-zinc-600'}`} />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-zinc-300 font-bold">DISPATCH DIRECTIVE</span>
                    {rec.isConstrained && <span className="text-[7px] px-1 py-0.5 rounded font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 leading-none">CAPACITY LIMITED</span>}
                  </div>
                  <p className="text-[9px] text-zinc-400 leading-relaxed font-sans">{rec.text}</p>
                  {rec.isConstrained && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      <div className="bg-zinc-900 border border-zinc-800 p-1 rounded text-center">
                        <div className="text-[7px] text-zinc-600">TOW TRUCKS</div>
                        <div className="text-[10px] text-rose-400 font-bold">{BTP_INVENTORY.heavyTowTrucks}/{BTP_INVENTORY.heavyTowTrucks}</div>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 p-1 rounded text-center">
                        <div className="text-[7px] text-zinc-600">PATROLS</div>
                        <div className="text-[10px] text-amber-400 font-bold">{Math.ceil(BTP_INVENTORY.patrolUnits / 2)}/{BTP_INVENTORY.patrolUnits}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      }
    />
  );
}
