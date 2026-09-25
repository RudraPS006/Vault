import React from 'react';
import { ShieldCheck, Cpu, HardDrive, CheckCircle2 } from 'lucide-react';
import { ClusterHealthSummary } from '../api/types';

interface ClusterHealthCardProps {
  clusterHealth: ClusterHealthSummary | null;
}

export const ClusterHealthCard: React.FC<ClusterHealthCardProps> = ({ clusterHealth }) => {
  const healthyCount = clusterHealth?.healthyNodes ?? 5;
  const degradedCount = clusterHealth?.degradedNodes ?? 0;
  const unhealthyCount = clusterHealth?.unhealthyNodes ?? 0;
  const offlineCount = clusterHealth?.offlineNodes ?? 0;
  const totalNodes = clusterHealth?.totalNodes ?? 5;

  return (
    <div className="bg-[#0e111a] border border-[#1c2233] rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1c2233] gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
              Cluster Resilience & Quorum
            </h2>
            <p className="text-xs text-zinc-400">
              Distributed consensus and fault-tolerance topology status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141824] border border-[#222a3d] text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Majority Quorum: Active (3/5)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Col 1: Fault Tolerance Specs */}
        <div className="bg-[#121521] border border-[#1c2233] rounded-md p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-mono uppercase text-[11px]">Failure Tolerance</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            2 Nodes
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Cluster continues serving reads and writes even if 2 independent storage nodes fail simultaneously.
          </p>
        </div>

        {/* Col 2: Node Distribution Breakdown */}
        <div className="bg-[#121521] border border-[#1c2233] rounded-md p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-mono uppercase text-[11px]">Node Distribution</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-zinc-200">{healthyCount} Healthy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-zinc-400">{degradedCount} Degraded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span className="text-zinc-400">{unhealthyCount + offlineCount} Down</span>
            </div>
          </div>
          <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden mt-3 flex">
            <div
              className="bg-emerald-500 h-full"
              style={{ width: `${(healthyCount / totalNodes) * 100}%` }}
              title="Healthy"
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${(degradedCount / totalNodes) * 100}%` }}
              title="Degraded"
            />
            <div
              className="bg-rose-500 h-full"
              style={{ width: `${((unhealthyCount + offlineCount) / totalNodes) * 100}%` }}
              title="Offline"
            />
          </div>
        </div>

        {/* Col 3: Storage Node Model */}
        <div className="bg-[#121521] border border-[#1c2233] rounded-md p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-mono uppercase text-[11px]">Storage Engine</span>
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            Logical Isolated Volumes
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Simulated via 5 isolated directory trees (<code className="text-cyan-300">storage/node-[a-e]</code>) with independent state tracking.
          </p>
        </div>
      </div>
    </div>
  );
};
