/**
 * @file SidebarQueue.tsx
 * @description Left-panel component for the PROJECT THRINETHRA.
 *
 * Renders three vertically stacked sections:
 * 1. **Search Filter** — Text input to filter hotspots by police station name.
 * 2. **Hotspot Queue** — Scrollable list of dispatch zone cards. Each card
 *    shows station name, cluster ID, CSI score badge, vehicle volume, and
 *    a compact icon-only dispatch button (reveals label on hover).
 * 3. **Terminal Feed** — Live timestamped log of system actions, with
 *    color-coded entries (rose for errors, cyan for temporal, emerald for dispatch).
 *
 * This component is purely presentational and owns no data-fetching logic.
 */
"use client";

import React from 'react';
import { Activity, Search, CornerDownRight, Crosshair, CheckCircle } from 'lucide-react';
import { DispatchZone } from './TacticalMapplsCanvas';

/** Props accepted by the SidebarQueue component. */
interface SidebarQueueProps {
  /** Temporally-scaled list of dispatch zones. */
  zones: DispatchZone[];
  /** Currently selected zone (highlighted in the queue). */
  selectedZone: DispatchZone | null;
  /** Whether the initial data load is still in progress. */
  loading: boolean;
  /** Current search filter string. */
  searchTerm: string;
  /** Map of cluster IDs that have already been dispatched. */
  dispatchedClusters: Record<number, boolean>;
  /** Live terminal feed log entries (most recent first). */
  terminalFeed: string[];
  /** Callback fired when the operator selects a zone. */
  onSelectZone: (zone: DispatchZone) => void;
  /** Callback fired when the search input changes. */
  onSearchChange: (term: string) => void;
  /** Callback fired when the dispatch button is pressed for a zone. */
  onDispatch: (clusterId: number, station: string) => void;
  /** Callback to append a log entry to the terminal feed. */
  addFeedLog: (log: string) => void;
}

/**
 * Determines the CSS classes for the CSI severity badge.
 *
 * @param score - The Congestion Severity Index score.
 * @param isResolved - Whether the cluster has been dispatched to.
 * @returns Tailwind class string for the badge.
 */
function getBadgeClass(score: number, isResolved: boolean): string {
  if (isResolved) return 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20';
  if (score > 15) return 'bg-rose-950/20 text-rose-400 border-rose-500/20';
  return 'bg-amber-950/20 text-amber-400 border-amber-500/20';
}

/**
 * Determines the color class for a terminal log entry based on its content.
 *
 * @param log - The raw log string.
 * @returns Tailwind color class for the log text.
 */
function getLogColor(log: string): string {
  if (log.includes('[ERROR]')) return 'text-rose-400';
  if (log.includes('[TEMPORAL]') || log.includes('[TEMPORAL_MATRIX]')) return 'text-cyan-400';
  if (log.includes('[DISPATCH]')) return 'text-emerald-400';
  if (log.includes('[SANDBOX]')) return 'text-amber-400';
  return 'text-zinc-400';
}

/**
 * Parses a terminal log entry into a dimmed timestamp and the action text.
 *
 * @param log - Raw log string, e.g. "[09:30:15] [DISPATCH] Unit sent..."
 * @returns Object with `timestamp` and `action` strings.
 */
function parseLogParts(log: string): { timestamp: string; action: string } {
  const match = log.match(/^(\[[^\]]+\])\s*(.*)$/);
  if (match) return { timestamp: match[1], action: match[2] };
  return { timestamp: '', action: log };
}

/**
 * SidebarQueue — Left panel containing the hotspot queue and terminal.
 *
 * @param props - {@link SidebarQueueProps}
 * @returns A flex-column section occupying the left 25% of the dashboard.
 */
export default function SidebarQueue({
  zones,
  selectedZone,
  loading,
  searchTerm,
  dispatchedClusters,
  terminalFeed,
  onSelectZone,
  onSearchChange,
  onDispatch,
  addFeedLog,
}: SidebarQueueProps) {
  const filteredZones = zones.filter(z =>
    z.primary_police_station.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="w-1/4 min-w-[300px] max-w-[360px] border-r border-zinc-900 flex flex-col bg-zinc-950/30">
      {/* Search Filter */}
      <div className="p-3 border-b border-zinc-900 bg-zinc-950/50">
        <span className="text-[9px] text-zinc-500 tracking-wider font-bold block mb-1.5">TARGET SCAN FILTER</span>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3 h-3 text-zinc-600" />
          <input
            type="text"
            placeholder="Station search..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full bg-zinc-900/40 border border-zinc-800 text-[10px] rounded pl-7 pr-3 py-1.5 text-zinc-300 focus:outline-none focus:border-rose-500/50 transition-all font-mono"
          />
        </div>
      </div>

      {/* Hotspot Queue */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-zinc-900/20 border border-zinc-900/60 p-3 rounded space-y-2 animate-pulse">
              <div className="h-2.5 bg-zinc-800 rounded w-2/3" />
              <div className="h-2 bg-zinc-800 rounded w-1/2" />
            </div>
          ))
        ) : filteredZones.length === 0 ? (
          <div className="text-zinc-600 text-center py-10 text-[10px]">NO ACTIVE SECTOR THREATS DETECTED</div>
        ) : (
          filteredZones.map(zone => {
            const isSelected = selectedZone?.cluster_id === zone.cluster_id;
            const isResolved = dispatchedClusters[zone.cluster_id];
            return (
              <div
                key={zone.cluster_id}
                onClick={() => {
                  onSelectZone(zone);
                  addFeedLog(`[SCAN_LOCK] Locked telemetry on Cluster-${zone.cluster_id}.`);
                }}
                className={`p-2.5 rounded border transition-all duration-100 cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-rose-950/15 border-rose-500/50'
                    : 'bg-zinc-900/10 border-zinc-900/60 hover:border-zinc-800 hover:bg-zinc-900/20'
                }`}
              >
                {/* Row 1: Station name + CSI badge */}
                <div className="flex justify-between items-center">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-zinc-200 truncate">
                      {zone.primary_police_station.toUpperCase()}
                    </span>
                    <span className="text-[8px] text-zinc-600 mt-0.5">
                      CLUSTER_{zone.cluster_id}
                    </span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ml-2 flex-shrink-0 ${getBadgeClass(zone.total_severity_score, isResolved)}`}>
                    {isResolved ? 'RESOLVED' : `CSI ${zone.total_severity_score.toFixed(1)}`}
                  </span>
                </div>

                {/* Row 2: Volume + coords + dispatch icon */}
                <div className="flex justify-between items-center text-[9px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5 text-zinc-600" />
                    <strong className="text-zinc-300">{zone.total_vehicles_involved}</strong> vehicles
                  </span>

                  {/* Compact dispatch icon button — reveals text on hover */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onDispatch(zone.cluster_id, zone.primary_police_station);
                    }}
                    disabled={isResolved}
                    title={isResolved ? 'Unit dispatched' : 'Dispatch interceptor unit'}
                    className={`group flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                      isResolved
                        ? 'text-emerald-500 border-emerald-500/20 cursor-default'
                        : 'text-zinc-500 border-zinc-800 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-950/20'
                    }`}
                  >
                    {isResolved
                      ? <CheckCircle className="w-3 h-3" />
                      : <Crosshair className="w-3 h-3" />
                    }
                    <span className={`text-[8px] font-bold tracking-wider overflow-hidden transition-all ${
                      isResolved ? 'max-w-[60px]' : 'max-w-0 group-hover:max-w-[60px]'
                    }`}>
                      {isResolved ? 'SENT' : 'DISPATCH'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Terminal Feed */}
      <div className="h-40 border-t border-zinc-900 bg-zinc-950 p-2.5 flex flex-col gap-1.5 font-mono flex-shrink-0">
        <span className="text-[8px] text-zinc-600 tracking-widest font-bold">TERMINAL REALTIME OUT</span>
        <div className="flex-1 overflow-y-auto text-[9px] space-y-1 leading-relaxed">
          {terminalFeed.map((log, i) => {
            const { timestamp, action } = parseLogParts(log);
            return (
              <div key={i} className="flex gap-1 items-start">
                <CornerDownRight className="w-2 h-2 text-zinc-800 flex-shrink-0 mt-0.5" />
                {timestamp && <span className="text-zinc-600 flex-shrink-0">{timestamp}</span>}
                <span className={getLogColor(log)}>{action}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
