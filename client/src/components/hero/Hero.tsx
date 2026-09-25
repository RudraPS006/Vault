import React from 'react';
import { StorageNode, StoredObject, ClusterHealthSummary } from '../../api/types';
import { StorageFabricGraph } from './StorageFabricGraph';
import { computeIntegrityStatus } from '../../utils/integrity';
import { UploadCloud, BookOpen, ArrowRight } from 'lucide-react';

interface HeroProps {
  nodes: StorageNode[];
  objects: StoredObject[];
  clusterHealth: ClusterHealthSummary | null;
  corruptedNodes?: Set<string>;
  isRepairing?: boolean;
  loading?: boolean;
  onUploadClick: () => void;
  onRunWalkthrough: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  nodes,
  objects,
  clusterHealth,
  corruptedNodes = new Set(),
  isRepairing = false,
  loading = false,
  onUploadClick,
  onRunWalkthrough
}) => {
  const totalNodes = clusterHealth?.totalNodes ?? nodes.length;
  const healthyNodes = clusterHealth?.healthyNodes ?? nodes.filter((n) => n.status === 'HEALTHY').length;
  const totalObjects = clusterHealth?.totalObjects ?? objects.length;
  const totalReplicas = clusterHealth?.totalReplicas ?? objects.reduce((acc, o) => acc + o.replicaCount, 0);

  const allOperational = healthyNodes === totalNodes && totalNodes > 0;
  const nodesStatusText = allOperational
    ? 'All operational'
    : `${healthyNodes}/${totalNodes} online`;

  const integrity = computeIntegrityStatus(objects, clusterHealth);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0c0f18] to-[#08090d] p-6 lg:p-8 space-y-8 overflow-hidden relative shadow-2xl">
      {/* Background Ambient Glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-96 h-96 bg-blue-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Top Split: Text & Interactive Topology */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left Column: Headlines & CTAs */}
        <div className="lg:col-span-6 space-y-5">
          {/* Top Identifier */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.07] text-[11px] font-sans">
            <span className="font-bold text-white tracking-wider font-sans">VAULT</span>
            <span className="text-cyan-400 font-mono">/ storage</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 uppercase tracking-widest text-[10px] font-mono">
              Distributed Object Storage
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-sans leading-[1.1]">
            Built to survive failure.
          </h1>

          {/* Supporting Text */}
          <p className="text-sm sm:text-base text-zinc-400 font-sans leading-relaxed max-w-lg">
            Vault replicates, verifies and repairs objects across independently failing storage nodes.
          </p>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              onClick={onUploadClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs sm:text-sm font-semibold transition-all duration-150 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/20 active:scale-[0.98]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload object</span>
            </button>

            <button
              onClick={onRunWalkthrough}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 border border-white/[0.1] text-xs sm:text-sm font-medium transition-all duration-150 active:scale-[0.98]"
            >
              <BookOpen className="w-4 h-4 text-zinc-400" />
              <span>Run walkthrough</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Right Column: Animated Storage Fabric Visualization */}
        <div className="lg:col-span-6 flex justify-center">
          <StorageFabricGraph
            nodes={nodes}
            objects={objects}
            corruptedNodes={corruptedNodes}
            isRepairing={isRepairing}
          />
        </div>
      </div>

      {/* Hero Bottom: Dynamic Infrastructure Metrics Row */}
      <div className="pt-6 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
        {/* Metric 1: Nodes */}
        <div className="space-y-1">
          <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-sans">
            {loading && !clusterHealth ? '—' : totalNodes}
          </div>
          <div className="text-xs font-semibold text-zinc-300 font-sans">Nodes</div>
          <div className="text-[11px] text-zinc-500 font-sans">{nodesStatusText}</div>
        </div>

        {/* Metric 2: Objects */}
        <div className="space-y-1 border-l border-white/[0.06] pl-6">
          <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-sans">
            {loading && !clusterHealth ? '—' : totalObjects}
          </div>
          <div className="text-xs font-semibold text-zinc-300 font-sans">Objects</div>
          <div className="text-[11px] text-zinc-500 font-sans">Stored in catalog</div>
        </div>

        {/* Metric 3: Replicas */}
        <div className="space-y-1 border-l border-white/[0.06] pl-6">
          <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-sans">
            {loading && !clusterHealth ? '—' : totalReplicas}
          </div>
          <div className="text-xs font-semibold text-zinc-300 font-sans">Replicas</div>
          <div className="text-[11px] text-zinc-500 font-sans">3× policy</div>
        </div>

        {/* Metric 4: Integrity (Dynamic) */}
        <div className="space-y-1 border-l border-white/[0.06] pl-6">
          <div
            className={`text-2xl lg:text-3xl font-bold tracking-tight ${integrity.colorClass} font-sans flex items-baseline gap-1`}
          >
            {loading && !clusterHealth ? '—' : integrity.displayValue}
          </div>
          <div className="text-xs font-semibold text-zinc-300 font-sans">Integrity</div>
          <div className="text-[11px] text-zinc-500 font-sans">{integrity.statusLabel}</div>
        </div>
      </div>
    </div>
  );
};
