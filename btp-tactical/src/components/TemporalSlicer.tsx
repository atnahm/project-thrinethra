/**
 * @file TemporalSlicer.tsx
 * @description Temporal windowing control bar for the PROJECT THRINETHRA.
 *
 * Renders a horizontal bar with a Time-of-Day slider (0–23h) and a
 * Day-of-Week button group. Adjusting either control updates the parent's
 * `timeWindow` state, which drives the temporal scaling factor applied to
 * incoming zone data (simulating a realistic 1-hour traffic slice from
 * the aggregated 5-month dataset).
 *
 * This component is purely presentational — it receives state and callbacks
 * via props and owns no data-fetching logic.
 */
"use client";

import React from 'react';
import { Clock, Calendar } from 'lucide-react';

/** Represents a single temporal filter window. */
export interface TimeWindow {
  /** Hour of day, 0–23. */
  hour: number;
  /** Day of week index, 0 = Sunday … 6 = Saturday. */
  dayIndex: number;
}

/** Props accepted by the TemporalSlicer component. */
interface TemporalSlicerProps {
  /** The currently active time window. */
  timeWindow: TimeWindow;
  /** Callback to update the time window in the parent state manager. */
  onTimeWindowChange: (tw: TimeWindow) => void;
  /** The multiplicative scale factor shown to the operator. */
  scaleFactor: number;
  /** Callback to append a log entry to the terminal feed. */
  addFeedLog: (log: string) => void;
}

/** Abbreviated day-of-week labels for the button group. */
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/**
 * TemporalSlicer — Horizontal control bar for time-windowing.
 *
 * @param props - {@link TemporalSlicerProps}
 * @returns A fixed-height bar rendered between the header and the dashboard grid.
 */
export default function TemporalSlicer({ timeWindow, onTimeWindowChange, scaleFactor, addFeedLog }: TemporalSlicerProps) {
  return (
    <div className="flex-shrink-0 border-b border-zinc-900 bg-zinc-950/60 px-6 py-2.5 flex items-center gap-6">
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold tracking-widest">
        <Clock className="w-3.5 h-3.5 text-cyan-500" />
        TEMPORAL SLICER
      </div>

      {/* Time-of-Day slider */}
      <div className="flex items-center gap-3 flex-1 max-w-xs">
        <span className="text-[10px] text-zinc-600 w-20">TIME OF DAY</span>
        <input
          type="range"
          min={0}
          max={23}
          value={timeWindow.hour}
          onChange={e => {
            const h = Number(e.target.value);
            onTimeWindowChange({ ...timeWindow, hour: h });
            addFeedLog(`[TEMPORAL] Slicing to ${String(h).padStart(2, '0')}:00 window.`);
          }}
          className="flex-1 cursor-pointer"
        />
        <span className="text-[11px] text-cyan-400 font-bold w-12 font-mono">
          {String(timeWindow.hour).padStart(2, '0')}:00
        </span>
      </div>

      {/* Day-of-Week selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-3 h-3 text-zinc-600" />
        <div className="flex gap-1">
          {DAYS_OF_WEEK.map((d, i) => (
            <button
              key={d}
              onClick={() => {
                onTimeWindowChange({ ...timeWindow, dayIndex: i });
                addFeedLog(`[TEMPORAL] Day filter set to ${d}.`);
              }}
              className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all ${
                timeWindow.dayIndex === i
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/50'
                  : 'bg-zinc-900/30 text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Scale factor badge */}
      <div className="ml-auto flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 px-3 py-1 rounded text-[9px] font-mono">
        <span className="text-zinc-500">SCALE</span>
        <span className="text-cyan-400 font-bold">×{scaleFactor} (1-HR SLICE)</span>
      </div>
    </div>
  );
}
