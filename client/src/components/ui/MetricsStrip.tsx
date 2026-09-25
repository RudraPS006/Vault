import React from 'react';
import { ClusterHealthSummary, StoredObject } from '../../api/types';
import { computeIntegrityStatus } from '../../utils/integrity';

interface MetricsStripProps {
  clusterHealth: ClusterHealthSummary | null;
  objects?: StoredObject[];
  loading?: boolean;
}

export const MetricsStrip: React.FC<MetricsStripProps> = ({
  clusterHealth,
  objects = [],
  loading
}) => {
  const totalNodes = clusterHealth?.totalNodes ?? 5;
  const healthyNodes = clusterHealth?.healthyNodes ?? 5;
  const totalObjects = clusterHealth?.totalObjects ?? 0;
  const totalReplicas = clusterHealth?.totalReplicas ?? 0;

  const allOperational = healthyNodes === totalNodes && totalNodes > 0;
  const nodesStatusText = allOperational
    ? 'All operational'
    : `${healthyNodes}/${totalNodes} online`;

  const integrity = computeIntegrityStatus(objects, clusterHealth);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 px-5 rounded-lg border border-white/[0.08] bg-[#0d0f15]">
      {/* 1. Nodes */}
      <div className="space-y-1">
        <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-sans">
          {loading && !clusterHealth ? '—' : totalNodes}
        </div>
        <div className="text-xs font-semibold text-zinc-300">Nodes</div>
        <div className="text-[11px] text-zinc-500">{nodesStatusText}</div>
      </div>

      {/* 2. Objects */}
      <div className="space-y-1 border-l border-white/[0.06] pl-6">
        <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-sans">
          {loading && !clusterHealth ? '—' : totalObjects}
        </div>
        <div className="text-xs font-semibold text-zinc-300">Objects</div>
        <div className="text-[11px] text-zinc-500">Stored</div>
      </div>

      {/* 3. Replicas */}
      <div className="space-y-1 border-l border-white/[0.06] pl-6">
        <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-sans">
          {loading && !clusterHealth ? '—' : totalReplicas}
        </div>
        <div className="text-xs font-semibold text-zinc-300">Replicas</div>
        <div className="text-[11px] text-zinc-500">3× policy</div>
      </div>

      {/* 4. Integrity */}
      <div className="space-y-1 border-l border-white/[0.06] pl-6">
        <div
          className={`text-2xl lg:text-3xl font-bold tracking-tight ${integrity.colorClass} font-sans flex items-baseline gap-1`}
        >
          {loading && !clusterHealth ? '—' : integrity.displayValue}
        </div>
        <div className="text-xs font-semibold text-zinc-300">Integrity</div>
        <div className="text-[11px] text-zinc-500">{integrity.statusLabel}</div>
      </div>
    </div>
  );
};

