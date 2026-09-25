import React, { useState, useEffect } from 'react';
import { StorageNode, StoredObject } from '../../api/types';
import { HardDrive, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

interface StorageFabricGraphProps {
  nodes: StorageNode[];
  objects: StoredObject[];
  corruptedNodes?: Set<string>;
  isRepairing?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  nodeReplicasCount?: Record<string, number>;
}

interface NodeCoord {
  id: string;
  name: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}

export const StorageFabricGraph: React.FC<StorageFabricGraphProps> = ({
  nodes,
  objects,
  corruptedNodes = new Set(),
  isRepairing = false,
  selectedNodeId,
  onSelectNode,
  nodeReplicasCount = {}
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Organic coordinates in 540x380 SVG canvas
  const nodeCoords: NodeCoord[] = [
    { id: 'node-a', name: 'Node A', x: 270, y: 52, labelX: 270, labelY: 26 },
    { id: 'node-b', name: 'Node B', x: 110, y: 150, labelX: 110, labelY: 122 },
    { id: 'node-c', name: 'Node C', x: 430, y: 142, labelX: 430, labelY: 114 },
    { id: 'node-d', name: 'Node D', x: 165, y: 310, labelX: 165, labelY: 345 },
    { id: 'node-e', name: 'Node E', x: 375, y: 320, labelX: 375, labelY: 355 }
  ];

  const centerX = 270;
  const centerY = 195;

  const getNodeState = (nodeId: string) => {
    const nodeObj = nodes.find(
      (n) => n.id.toLowerCase() === nodeId || n.name.toLowerCase() === nodeId
    );
    const isCorrupted = corruptedNodes.has(nodeId.toLowerCase());
    const isFailed = nodeObj?.status === 'FAILED';
    const isHealthy = !isFailed && !isCorrupted;

    return {
      nodeObj,
      isFailed,
      isCorrupted,
      isHealthy,
      statusText: isCorrupted
        ? 'CORRUPTED'
        : isFailed
        ? 'FAILED'
        : 'HEALTHY'
    };
  };

  const nodeA = getNodeState('node-a');
  const nodeB = getNodeState('node-b');
  const nodeC = getNodeState('node-c');
  const nodeD = getNodeState('node-d');
  const nodeE = getNodeState('node-e');

  const anyFailed = nodes.some((n) => n.status === 'FAILED');
  const anyCorrupted = corruptedNodes.size > 0;
  const hasObjects = objects.length > 0;

  // Path definitions for SVG
  const pathAB = 'M 270,52 Q 180,92 110,150';
  const pathAC = 'M 270,52 Q 360,86 430,142';
  const pathCenterA = 'M 270,195 L 270,52';
  const pathCenterB = 'M 270,195 L 110,150';
  const pathCenterC = 'M 270,195 L 430,142';
  const pathCenterD = 'M 270,195 L 165,310';
  const pathCenterE = 'M 270,195 L 375,320';
  const pathBD = 'M 110,150 Q 125,235 165,310';
  const pathCE = 'M 430,142 Q 415,235 375,320';
  const pathDE = 'M 165,310 Q 270,340 375,320';

  const isLinkActive = (state1: ReturnType<typeof getNodeState>, state2: ReturnType<typeof getNodeState>) => {
    return !state1.isFailed && !state2.isFailed;
  };

  const getLinkStroke = (state1: ReturnType<typeof getNodeState>, state2: ReturnType<typeof getNodeState>) => {
    if (state1.isFailed || state2.isFailed) {
      return 'rgba(244, 63, 94, 0.15)';
    }
    if (state1.isCorrupted || state2.isCorrupted) {
      return 'rgba(245, 158, 11, 0.3)';
    }
    return 'rgba(255, 255, 255, 0.08)';
  };

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      {/* Topology Status Overlay Badge */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {isRepairing ? (
          <div className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>REPAIRING REPLICAS</span>
          </div>
        ) : anyCorrupted ? (
          <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>SHA-256 MISMATCH DETECTED</span>
          </div>
        ) : anyFailed ? (
          <div className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>FABRIC DEGRADED</span>
          </div>
        ) : (
          <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>3× REPLICATION HEALTHY</span>
          </div>
        )}
      </div>

      {/* Main SVG Visualization Canvas */}
      <svg
        viewBox="0 0 540 380"
        className="w-full h-auto overflow-visible"
        aria-label="Vault Distributed Storage Fabric Topology"
      >
        <defs>
          {/* Subtle Ambient Radial Glow for Nodes */}
          <radialGradient id="healthyGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="failedGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="corruptGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Center Glow */}
        <circle cx={centerX} cy={centerY} r="90" fill="url(#centerGlow)" />

        {/* ============================================================ */}
        {/* Connection Paths (Background Layer) */}
        {/* ============================================================ */}
        <g className="transition-opacity duration-300">
          {/* Core Radiating Links */}
          <path
            d={pathCenterA}
            stroke={getLinkStroke(nodeA, nodeA)}
            strokeWidth="1.5"
            strokeDasharray={nodeA.isFailed ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathCenterB}
            stroke={getLinkStroke(nodeB, nodeB)}
            strokeWidth="1.5"
            strokeDasharray={nodeB.isFailed ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathCenterC}
            stroke={getLinkStroke(nodeC, nodeC)}
            strokeWidth="1.5"
            strokeDasharray={nodeC.isFailed ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathCenterD}
            stroke={getLinkStroke(nodeD, nodeD)}
            strokeWidth="1.5"
            strokeDasharray={nodeD.isFailed ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathCenterE}
            stroke={getLinkStroke(nodeE, nodeE)}
            strokeWidth="1.5"
            strokeDasharray={nodeE.isFailed ? '4 4' : 'none'}
            fill="none"
          />

          {/* Peer-to-Peer Replication Paths */}
          <path
            d={pathAB}
            stroke={getLinkStroke(nodeA, nodeB)}
            strokeWidth="1.5"
            strokeDasharray={!isLinkActive(nodeA, nodeB) ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathAC}
            stroke={getLinkStroke(nodeA, nodeC)}
            strokeWidth="1.5"
            strokeDasharray={!isLinkActive(nodeA, nodeC) ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathBD}
            stroke={getLinkStroke(nodeB, nodeD)}
            strokeWidth="1.2"
            strokeDasharray={!isLinkActive(nodeB, nodeD) ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathCE}
            stroke={getLinkStroke(nodeC, nodeE)}
            strokeWidth="1.2"
            strokeDasharray={!isLinkActive(nodeC, nodeE) ? '4 4' : 'none'}
            fill="none"
          />
          <path
            d={pathDE}
            stroke={getLinkStroke(nodeD, nodeE)}
            strokeWidth="1.2"
            strokeDasharray={!isLinkActive(nodeD, nodeE) ? '4 4' : 'none'}
            fill="none"
          />
        </g>

        {/* ============================================================ */}
        {/* Animated Particles Along Active Paths (When Motion Allowed) */}
        {/* ============================================================ */}
        {!reducedMotion && (
          <g className="pointer-events-none">
            {/* 1. Intake flow to Node A */}
            {isLinkActive(nodeA, nodeA) && (
              <circle r="2.5" fill="#38bdf8" opacity="0.9">
                <animateMotion
                  path={pathCenterA}
                  dur="3.2s"
                  repeatCount="indefinite"
                  keyPoints="0;1"
                  keyTimes="0;1"
                />
              </circle>
            )}

            {/* 2. 3-Way Replication from Node A to Node B */}
            {isLinkActive(nodeA, nodeB) && (
              <circle r="2.5" fill="#38bdf8" opacity="0.8">
                <animateMotion
                  path={pathAB}
                  dur={hasObjects ? '3.8s' : '5s'}
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* 3. 3-Way Replication from Node A to Node C */}
            {isLinkActive(nodeA, nodeC) && (
              <circle r="2.5" fill="#38bdf8" opacity="0.8">
                <animateMotion
                  path={pathAC}
                  dur={hasObjects ? '4.2s' : '5.5s'}
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* 4. Ambient Fabric Sync between B & D */}
            {isLinkActive(nodeB, nodeD) && (
              <circle r="2" fill="#0284c7" opacity="0.6">
                <animateMotion path={pathBD} dur="6.5s" repeatCount="indefinite" />
              </circle>
            )}

            {/* 5. Ambient Fabric Sync between C & E */}
            {isLinkActive(nodeC, nodeE) && (
              <circle r="2" fill="#0284c7" opacity="0.6">
                <animateMotion path={pathCE} dur="6.2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* 6. Active Repair Flow toward Destination Node */}
            {isRepairing && (
              <circle r="3.5" fill="#22d3ee" opacity="0.95">
                <animateMotion path={pathCenterD} dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )}

        {/* ============================================================ */}
        {/* Central Data Core Representation */}
        {/* ============================================================ */}
        <g transform={`translate(${centerX}, ${centerY})`} className="cursor-default">
          {/* Outer ring */}
          <circle
            r="32"
            fill="#090c14"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1.5"
            strokeDasharray={anyFailed ? '4 3' : 'none'}
          />
          {/* Inner core */}
          <circle
            r="24"
            fill="#0f1422"
            stroke={anyFailed ? '#f43f5e' : anyCorrupted ? '#f59e0b' : '#06b6d4'}
            strokeWidth="1.5"
            opacity="0.9"
          />
          <text
            textAnchor="middle"
            y="-4"
            className="text-[9px] font-mono font-bold fill-white tracking-widest select-none"
          >
            OBJECT
          </text>
          <text
            textAnchor="middle"
            y="9"
            className="text-[8px] font-mono fill-cyan-400 select-none"
          >
            FABRIC
          </text>
          <text
            textAnchor="middle"
            y="18"
            className="text-[7px] font-mono fill-zinc-500 select-none"
          >
            3× RF
          </text>
        </g>

        {/* ============================================================ */}
        {/* Storage Nodes (5 Independent Nodes) */}
        {/* ============================================================ */}
        {nodeCoords.map((coord) => {
          const state = getNodeState(coord.id);
          const isHovered = hoveredNode === coord.id;
          const isSelected = selectedNodeId === coord.id;

          const glowFill = state.isFailed
            ? 'url(#failedGlow)'
            : state.isCorrupted
            ? 'url(#corruptGlow)'
            : isSelected
            ? 'url(#centerGlow)'
            : 'url(#healthyGlow)';

          const strokeColor = state.isFailed
            ? '#f43f5e'
            : state.isCorrupted
            ? '#f59e0b'
            : isSelected
            ? '#38bdf8'
            : isHovered
            ? '#38bdf8'
            : 'rgba(255, 255, 255, 0.14)';

          const statusDotColor = state.isFailed
            ? '#f43f5e'
            : state.isCorrupted
            ? '#f59e0b'
            : '#10b981';

          const replicas = nodeReplicasCount[coord.id];

          return (
            <g
              key={coord.id}
              transform={`translate(${coord.x}, ${coord.y})`}
              onClick={() => onSelectNode?.(coord.id)}
              onMouseEnter={() => setHoveredNode(coord.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer transition-transform duration-200"
            >
              {/* Outer ambient glow */}
              <circle r="36" fill={glowFill} />

              {/* Selection ring if active */}
              {isSelected && (
                <circle
                  r="30"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />
              )}

              {/* Node background circle */}
              <circle
                r="24"
                fill="#0d101a"
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                className="transition-colors duration-200"
              />

              {/* Node Name */}
              <text
                textAnchor="middle"
                y="-4"
                className="text-[10px] font-sans font-bold fill-white tracking-wider select-none"
              >
                {coord.name.toUpperCase()}
              </text>

              {/* Status Indicator & Dot */}
              <g transform="translate(0, 9)">
                <circle cx="-16" cy="-2.5" r="2.5" fill={statusDotColor} />
                <text
                  x="-10"
                  y="0"
                  className="text-[8px] font-mono font-medium fill-zinc-400 select-none"
                >
                  {state.statusText}
                </text>
              </g>

              {/* Capacity or status pill */}
              {state.isFailed ? (
                <g>
                  <rect
                    x="-28"
                    y="26"
                    width="56"
                    height="14"
                    rx="3"
                    fill="rgba(244, 63, 94, 0.15)"
                    stroke="rgba(244, 63, 94, 0.3)"
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    y="36"
                    className="text-[7.5px] font-mono fill-rose-400 font-semibold select-none"
                  >
                    OFFLINE
                  </text>
                </g>
              ) : state.isCorrupted ? (
                <g>
                  <rect
                    x="-32"
                    y="26"
                    width="64"
                    height="14"
                    rx="3"
                    fill="rgba(245, 158, 11, 0.15)"
                    stroke="rgba(245, 158, 11, 0.3)"
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    y="36"
                    className="text-[7.5px] font-mono fill-amber-300 font-semibold select-none"
                  >
                    MISMATCH
                  </text>
                </g>
              ) : replicas !== undefined ? (
                <g>
                  <rect
                    x="-26"
                    y="26"
                    width="52"
                    height="14"
                    rx="3"
                    fill={isSelected ? "rgba(56, 189, 248, 0.15)" : "rgba(6, 182, 212, 0.1)"}
                    stroke={isSelected ? "rgba(56, 189, 248, 0.4)" : "rgba(6, 182, 212, 0.2)"}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    y="36"
                    className={`text-[7.5px] font-mono font-semibold select-none ${
                      isSelected ? 'fill-sky-300' : 'fill-cyan-400'
                    }`}
                  >
                    {replicas} {replicas === 1 ? 'REPLICA' : 'REPLICAS'}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Visual Legend / Flow Hint */}
      <div className="flex items-center justify-between text-[11px] font-sans text-zinc-500 pt-2 px-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ingest (Node A) → Replicate (B, C) → Verify (SHA-256)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Healthy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Failed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Corrupted
          </span>
        </div>
      </div>
    </div>
  );
};
