/**
 * @file InferenceGraph.tsx
 * @description Explainable AI (XAI) pipeline visualisation for a selected hotspot.
 *
 * Uses React Flow to render a 4-node directed graph that maps the algorithmic
 * decision path from raw telemetry ingest through geospatial weighting to
 * final severity classification. Each node is styled as a compact military
 * diagnostic card with neon status borders.
 *
 * The graph is locked (no pan, no zoom) so it behaves as a fixed embedded
 * diagnostic widget inside the right-side panel. When no zone is selected,
 * a terminal-style standby message is shown.
 */
"use client";

import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  MarkerType,
  Node,
  Edge,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DispatchZone } from './TacticalMapplsCanvas';

/** Props accepted by InferenceGraph. */
interface InferenceGraphProps {
  /** The currently locked dispatch zone, or null if none selected. */
  selectedZone: DispatchZone | null;
}

/**
 * TacticalNode — Custom React Flow node renderer.
 *
 * Renders a compact diagnostic card with:
 * - A tracking-widest uppercase title
 * - A teal-colored value line
 * - An optional subtext in dimmed zinc
 * - An optional severity badge (CRITICAL / MODERATE)
 * - Neon border glow when critical or warning
 *
 * @param props - React Flow node data payload.
 */
interface TacticalNodeData {
  id: string;
  title: string;
  value: string;
  subtext?: string;
  badge?: string;
  isCritical?: boolean;
  isWarning?: boolean;
}

const TacticalNode = ({ data }: { data: TacticalNodeData }) => {
  let borderClass = 'border-zinc-700/60';
  let shadowClass = '';
  let valueColorClass = 'text-teal-400';
  let badgeClass = '';

  if (data.isCritical) {
    borderClass = 'border-rose-500/80';
    shadowClass = 'shadow-[0_0_10px_rgba(244,63,94,0.4)]';
    valueColorClass = 'text-rose-400';
    badgeClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
  } else if (data.isWarning) {
    borderClass = 'border-amber-500/70';
    shadowClass = 'shadow-[0_0_10px_rgba(245,158,11,0.35)]';
    valueColorClass = 'text-amber-400';
    badgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
  }

  return (
    <div className={`px-3 py-2 rounded border bg-zinc-900/80 backdrop-blur min-w-[200px] font-mono transition-all ${borderClass} ${shadowClass}`}>
      {data.id !== '1' && <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-zinc-600 border-none" />}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase">{data.title}</span>
          {data.badge && (
            <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold leading-none ${badgeClass}`}>
              {data.badge}
            </span>
          )}
        </div>
        <div className={`text-[10px] font-bold tracking-wide ${valueColorClass}`}>
          {data.value}
        </div>
        {data.subtext && (
          <div className="text-[9px] text-zinc-500 leading-tight">
            {data.subtext}
          </div>
        )}
      </div>
      {data.id !== '4' && <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-zinc-600 border-none" />}
    </div>
  );
};

/** React Flow custom node type registry. */
const nodeTypes = { tactical: TacticalNode };

/**
 * InferenceGraph — XAI pipeline visualisation.
 *
 * @param props - {@link InferenceGraphProps}
 * @returns A fixed React Flow canvas showing the 4-step inference pipeline,
 *          or a standby message when no zone is selected.
 */
export default function InferenceGraph({ selectedZone }: InferenceGraphProps) {
  const flowData = useMemo(() => {
    if (!selectedZone) return { nodes: [], edges: [] };

    const stationName = selectedZone.primary_police_station.replace(" Traffic PS", "");
    const totalVehicles = selectedZone.total_vehicles_involved;
    const severity = selectedZone.total_severity_score;

    const isMajorJunction = /junction|circle|board/i.test(stationName);
    const junctionMultiplier = isMajorJunction ? 5.0 : 1.0;

    // Threshold adjusted for 0.5% temporal scale: 50000 * 0.005 = 250
    const isCritical = severity > 250;

    const nodes: Node[] = [
      {
        id: '1', type: 'tactical', position: { x: 20, y: 10 },
        data: { id: '1', title: 'Telemetry Ingest', value: `${totalVehicles} Vehicles`, subtext: `CLUSTER_${selectedZone.cluster_id}` },
      },
      {
        id: '2', type: 'tactical', position: { x: 20, y: 90 },
        data: { id: '2', title: 'Geospatial Context', value: `${stationName}`, subtext: `Junction Impact: ×${junctionMultiplier.toFixed(1)}` },
      },
      {
        id: '3', type: 'tactical', position: { x: 20, y: 170 },
        data: { id: '3', title: 'CSI Calculation', value: '(Mass) × (Junction)', subtext: 'Weighted aggregation' },
      },
      {
        id: '4', type: 'tactical', position: { x: 20, y: 250 },
        data: { id: '4', title: 'Severity Output', value: `SCORE: ${severity.toFixed(2)}`, badge: isCritical ? 'CRITICAL' : 'MODERATE', isCritical, isWarning: !isCritical },
      },
    ];

    const edgeStyle = { stroke: '#14b8a6', strokeWidth: 1.5, strokeDasharray: '5,4' };
    const markerEnd = { type: MarkerType.ArrowClosed, color: '#14b8a6' };

    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2', animated: true, style: edgeStyle, markerEnd },
      { id: 'e2-3', source: '2', target: '3', animated: true, style: edgeStyle, markerEnd },
      { id: 'e3-4', source: '3', target: '4', animated: true, style: edgeStyle, markerEnd },
    ];

    return { nodes, edges };
  }, [selectedZone]);

  if (!selectedZone) {
    return (
      <div className="w-full h-[280px] bg-zinc-950 border border-zinc-900 rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px]" />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-zinc-800 border-t-zinc-600 animate-spin" />
          <span className="text-[9px] text-zinc-600 font-mono tracking-widest animate-pulse">STANDBY: AWAITING TARGET</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[320px] bg-zinc-950 border border-zinc-900 rounded-lg overflow-hidden relative shadow-inner">
      <ReactFlow
        nodes={flowData.nodes}
        edges={flowData.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
      >
        <Background color="#27272a" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
