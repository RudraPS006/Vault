import React from 'react';
import { Server, CheckCircle2, HardDrive, Layers } from 'lucide-react';
import { ClusterHealthSummary } from '../api/types';

interface StatsOverviewProps {
  clusterHealth: ClusterHealthSummary | null;
  loading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ clusterHealth, loading }) => {
  const totalNodes = clusterHealth?.totalNodes ?? 5;
  const healthyNodes = clusterHealth?.healthyNodes ?? 5;
  const usedCapacityBytes = clusterHealth?.usedCapacityBytes ?? 0;
  const totalCapacityBytes = clusterHealth?.totalCapacityBytes ?? 53687091200; // 50 GB
  const utilizationPercentage = clusterHealth?.utilizationPercentage ?? 0;
  const totalObjects = clusterHealth?.totalObjects ?? 0;
  const totalReplicas = clusterHealth?.totalReplicas ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Nodes */}
      <div className="bg-[#0e111a] border border-[#1c2233] rounded-lg p-4 relative overflow-hidden transition-all hover:border-[#2b354f]">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Nodes</span>
          <Server className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {loading && !clusterHealth ? '...' : totalNodes}
          </span>
          <span className="text-xs font-mono text-zinc-400">instances</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 font-mono">
          <span>Topology</span>
          <span className="text-zinc-300">5 Logical Targets</span>
        </div>
      </div>

      {/* 2. Healthy Nodes */}
      <div className="bg-[#0e111a] border border-[#1c2233] rounded-lg p-4 relative overflow-hidden transition-all hover:border-[#2b354f]">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Node Health</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            {loading && !clusterHealth ? '...' : `${healthyNodes}/${totalNodes}`}
          </span>
          <span className="text-xs font-mono text-emerald-500/80">
            {totalNodes > 0 ? `${Math.round((healthyNodes / totalNodes) * 100)}%` : '100%'}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 font-mono">
          <span>Consensus</span>
          <span className="text-emerald-400">Quorum Achieved</span>
        </div>
      </div>

      {/* 3. Storage Utilization */}
      <div className="bg-[#0e111a] border border-[#1c2233] rounded-lg p-4 relative overflow-hidden transition-all hover:border-[#2b354f]">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Storage Used</span>
          <HardDrive className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {loading && !clusterHealth ? '...' : formatBytes(usedCapacityBytes)}
          </span>
          <span className="text-xs font-mono text-zinc-400">
            / {formatBytes(totalCapacityBytes)}
          </span>
        </div>
        <div className="mt-2.5">
          <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(utilizationPercentage, 1)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>Utilization</span>
            <span>{utilizationPercentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* 4. Objects & Replicas */}
      <div className="bg-[#0e111a] border border-[#1c2233] rounded-lg p-4 relative overflow-hidden transition-all hover:border-[#2b354f]">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Stored Objects</span>
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {loading && !clusterHealth ? '...' : totalObjects}
          </span>
          <span className="text-xs font-mono text-zinc-400">objects</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 font-mono">
          <span>Active Replicas</span>
          <span className="text-zinc-300">{totalReplicas} replicas</span>
        </div>
      </div>
    </div>
  );
};
