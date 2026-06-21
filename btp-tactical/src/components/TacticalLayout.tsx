/**
 * @file TacticalLayout.tsx
 * @description Layout wrapper for the PROJECT THRINETHRA dashboard.
 *
 * Manages the CSS grid skeleton that houses the three-panel dashboard:
 * - **Left (25%):** SidebarQueue (hotspot list + terminal)
 * - **Center (50%):** Map viewport with sandbox overlay
 * - **Right (25%):** XAI explainability panel
 *
 * This component owns no state. It accepts pre-rendered children via named
 * slots and enforces the tactical dark theme and header layout.
 */
"use client";

import React from 'react';
import { Siren, RefreshCw, AlertTriangle } from 'lucide-react';

/** Props accepted by the TacticalLayout component. */
interface TacticalLayoutProps {
  /** The active temporal window label displayed in the header subtitle. */
  timeLabel: string;
  /** Whether a data fetch is currently in progress (spins the refresh icon). */
  loading: boolean;
  /** Whether the backend connection is offline (triggers full-screen overlay). */
  connectionOffline: boolean;
  /** Callback to manually trigger a data refresh. */
  onRefresh: () => void;
  /** The TemporalSlicer bar rendered between header and main grid. */
  slicerBar: React.ReactNode;
  /** Left panel content (SidebarQueue). */
  leftPanel: React.ReactNode;
  /** Center panel content (Map + Sandbox overlay). */
  centerPanel: React.ReactNode;
  /** Right panel content (XAI + Dispatch directives). */
  rightPanel: React.ReactNode;
}

/**
 * TacticalLayout — Full-screen shell for the BTP dashboard.
 *
 * @param props - {@link TacticalLayoutProps}
 * @returns A flex-column layout filling the viewport with header, slicer bar,
 *          and a three-panel horizontal main area.
 */
export default function TacticalLayout({
  timeLabel,
  loading,
  connectionOffline,
  onRefresh,
  slicerBar,
  leftPanel,
  centerPanel,
  rightPanel,
}: TacticalLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-mono overflow-hidden">
      {/* ── HEADER ── */}
      <header className="flex justify-between items-center px-6 py-2.5 border-b border-zinc-900 bg-zinc-950/90 z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-rose-950/30 border border-rose-500/30 p-1.5 rounded text-rose-500 animate-pulse">
            <Siren className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-widest text-zinc-50 flex items-center gap-2">
              PROJECT THRINETHRA
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                SECURE FEED
              </span>
            </h1>
            <p className="text-[9px] text-zinc-500 font-sans tracking-wide">
              Spatial Density &amp; Adaptive Chokepoint Override — <span className="text-emerald-400">{timeLabel}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded transition-all font-mono text-[10px]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </header>

      {/* ── OFFLINE OVERLAY ── */}
      {connectionOffline && (
        <div className="absolute inset-0 bg-zinc-950/95 z-50 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md">
          <AlertTriangle className="w-14 h-14 text-rose-500 animate-bounce mb-4" />
          <h2 className="text-base font-extrabold tracking-widest text-rose-500 mb-2">SYSTEM OFFLINE</h2>
          <p className="text-[10px] text-zinc-400 max-w-sm font-sans mb-4">
            Cannot reach the telemetry registry. Ensure the FastAPI backend is running.
          </p>
          <button
            onClick={onRefresh}
            className="px-5 py-1.5 bg-rose-950 border border-rose-500 text-rose-400 font-bold hover:bg-rose-900/40 rounded transition-all tracking-wider text-[10px]"
          >
            RETRY LINK
          </button>
        </div>
      )}

      {/* ── TEMPORAL SLICER ── */}
      {slicerBar}

      {/* ── MAIN GRID ── */}
      <main className="flex-1 flex overflow-hidden w-full relative">
        {leftPanel}
        {centerPanel}
        {rightPanel}
      </main>
    </div>
  );
}
