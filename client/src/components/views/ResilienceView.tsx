import React, { useState, useEffect, useMemo } from 'react';
import {
  StorageNode,
  StoredObject,
  ClusterHealthSummary,
  SystemEvent,
  StoredObjectDetail
} from '../../api/types';
import { vaultApi } from '../../api/client';
import { computeIntegrityStatus } from '../../utils/integrity';
import { StorageFabricGraph } from '../hero/StorageFabricGraph';
import {
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Cpu,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Database,
  Clock,
  Radio
} from 'lucide-react';

interface ResilienceViewProps {
  nodes: StorageNode[];
  objects?: StoredObject[];
  clusterHealth: ClusterHealthSummary | null;
  loading: boolean;
  onFailNode: (id: string, name: string) => Promise<void>;
  onRecoverNode: (id: string, name: string) => Promise<void>;
  actionNodeId: string | null;
  corruptedNodes?: Set<string>;
  events?: SystemEvent[];
}

export const ResilienceView: React.FC<ResilienceViewProps> = ({
  nodes,
  objects = [],
  clusterHealth,
  loading: _loading,
  onFailNode,
  onRecoverNode,
  actionNodeId,
  corruptedNodes = new Set(),
  events = []
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-a');
  const [confirmFailNode, setConfirmFailNode] = useState<StorageNode | null>(null);
  const [objectDetails, setObjectDetails] = useState<Record<string, StoredObjectDetail>>({});
  const [isFetchingReplicas, setIsFetchingReplicas] = useState<boolean>(false);

  // Default selected node to first node if current selection is invalid
  useEffect(() => {
    if (nodes.length > 0 && !nodes.some((n) => n.id.toLowerCase() === selectedNodeId.toLowerCase() || n.name.toLowerCase() === selectedNodeId.toLowerCase())) {
      setSelectedNodeId(nodes[0].name.toLowerCase());
    }
  }, [nodes, selectedNodeId]);

  // Fetch full replica details for objects to compute accurate replica distribution per node
  useEffect(() => {
    if (objects.length === 0) {
      setObjectDetails({});
      return;
    }

    let isMounted = true;
    const fetchAllDetails = async () => {
      setIsFetchingReplicas(true);
      try {
        const details = await Promise.all(
          objects.map(async (obj) => {
            try {
              return await vaultApi.getObject(obj.id);
            } catch {
              return null;
            }
          })
        );
        if (isMounted) {
          const map: Record<string, StoredObjectDetail> = {};
          details.forEach((d) => {
            if (d) map[d.id] = d;
          });
          setObjectDetails(map);
        }
      } catch (err) {
        console.error('Failed to load object details in ResilienceView:', err);
      } finally {
        if (isMounted) setIsFetchingReplicas(false);
      }
    };

    fetchAllDetails();
    return () => {
      isMounted = false;
    };
  }, [objects]);

  // Compute replica count per node
  const nodeReplicasMap = useMemo(() => {
    const map: Record<string, number> = {
      'node-a': 0,
      'node-b': 0,
      'node-c': 0,
      'node-d': 0,
      'node-e': 0
    };

    Object.values(objectDetails).forEach((detail) => {
      detail.replicas?.forEach((rep) => {
        const key = rep.nodeName?.toLowerCase() || rep.nodeId?.toLowerCase();
        if (key && map[key] !== undefined) {
          map[key] += 1;
        }
      });
    });

    return map;
  }, [objectDetails]);

  // Derived metrics
  const totalNodes = nodes.length || 5;
  const healthyNodes = nodes.filter((n) => n.status === 'HEALTHY').length;
  const anyNodeFailed = nodes.some((n) => n.status === 'FAILED');
  const integrity = computeIntegrityStatus(objects, clusterHealth);

  const selectedNode = useMemo(() => {
    return (
      nodes.find(
        (n) =>
          n.id.toLowerCase() === selectedNodeId.toLowerCase() ||
          n.name.toLowerCase() === selectedNodeId.toLowerCase()
      ) || nodes[0]
    );
  }, [nodes, selectedNodeId]);

  const isSelectedFailed = selectedNode?.status === 'FAILED';
  const isSelectedCorrupted = selectedNode ? corruptedNodes.has(selectedNode.name.toLowerCase()) : false;
  const selectedNodeReplicas = selectedNode ? (nodeReplicasMap[selectedNode.name.toLowerCase()] ?? 0) : 0;

  // Format node heartbeat display
  const heartbeatText = useMemo(() => {
    if (!selectedNode) return 'Unknown';
    if (isSelectedFailed) return 'Offline (Heartbeat lost)';
    return 'Active (Heartbeat responsive)';
  }, [selectedNode, isSelectedFailed]);

  // Find recent event for the selected node
  const selectedNodeRecentEvent = useMemo(() => {
    if (!selectedNode) return null;
    return events.find(
      (e) =>
        e.nodeId?.toLowerCase() === selectedNode.id.toLowerCase() ||
        e.nodeId?.toLowerCase() === selectedNode.name.toLowerCase()
    );
  }, [events, selectedNode]);

  // Determine current active step in the recovery sequence (1 to 4)
  const activeStep: 1 | 2 | 3 | 4 = useMemo(() => {
    if (anyNodeFailed && isSelectedFailed) {
      return 1;
    }
    if (anyNodeFailed) {
      return integrity.isDegraded ? 2 : 3;
    }
    if (integrity.isDegraded) {
      return 2;
    }
    return 4; // 3/3 Healthy
  }, [anyNodeFailed, isSelectedFailed, integrity.isDegraded]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
            Cluster Architecture
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-xs font-mono text-zinc-500">Storage Fabric</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans mt-1">
          RESILIENCE
        </h1>
        <p className="text-sm text-zinc-300 font-sans mt-1 font-medium">
          Understand how Vault responds when storage fails.
        </p>
        <p className="text-xs text-zinc-400 font-sans mt-0.5">
          Monitor node health, replica distribution and recovery state across the storage fabric.
        </p>
      </div>

      {/* 2. Cluster Summary Strip (Compact 4-Item Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Nodes Online */}
        <div className="p-4 rounded-lg border border-white/[0.08] bg-[#0c0e15] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">
              Nodes Online
            </span>
            <Server className={`w-3.5 h-3.5 ${healthyNodes === totalNodes ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white">
              {healthyNodes} / {totalNodes}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              healthyNodes === totalNodes
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {healthyNodes === totalNodes ? 'All Online' : `${totalNodes - healthyNodes} Offline`}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-sans mt-1">
            Independent local physical storage nodes
          </span>
        </div>

        {/* Metric 2: Replication */}
        <div className="p-4 rounded-lg border border-white/[0.08] bg-[#0c0e15] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">
              Replication
            </span>
            <Database className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              3×
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Triplicate
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-sans mt-1">
            Replication factor per stored object
          </span>
        </div>

        {/* Metric 3: Tolerance */}
        <div className="p-4 rounded-lg border border-white/[0.08] bg-[#0c0e15] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">
              Fault Tolerance
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              2
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Replica Nodes
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-sans mt-1">
            3× replication · up to 2 replica-node failures per object
          </span>
        </div>

        {/* Metric 4: Cryptographic Integrity */}
        <div className="p-4 rounded-lg border border-white/[0.08] bg-[#0c0e15] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">
              Data Integrity
            </span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold font-mono ${integrity.colorClass}`}>
              {integrity.displayValue}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${integrity.badgeClass}`}>
              {integrity.statusLabel}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-sans mt-1">
            On-demand SHA-256 cryptographic verification
          </span>
        </div>
      </div>

      {/* 3. Centerpiece: Storage Fabric & Contextual Node Inspector (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive Fabric Topology */}
        <div className="lg:col-span-7 p-5 rounded-lg border border-white/[0.08] bg-[#0d0f15] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white font-sans tracking-wide">
                  Active Storage Fabric
                </h3>
              </div>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Click any node in the topology canvas to inspect telemetry and simulation controls.
              </p>
            </div>
            {isFetchingReplicas && (
              <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 self-start sm:self-auto">
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> Syncing Replicas...
              </span>
            )}
          </div>

          {/* SVG Canvas Component */}
          <div className="py-2">
            <StorageFabricGraph
              nodes={nodes}
              objects={objects}
              corruptedNodes={corruptedNodes}
              isRepairing={false}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId.toLowerCase())}
              nodeReplicasCount={nodeReplicasMap}
            />
          </div>

          {/* Quick Switcher Node Pills */}
          <div className="pt-2 border-t border-white/[0.06]">
            <div className="text-[11px] font-mono text-zinc-500 mb-2 uppercase tracking-wider">
              Quick Node Selector
            </div>
            <div className="grid grid-cols-5 gap-2">
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id || selectedNode?.name === node.name;
                const isFailed = node.status === 'FAILED';
                const isCorrupt = corruptedNodes.has(node.name.toLowerCase());

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.name.toLowerCase())}
                    className={`py-2 px-1 rounded border text-center transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400/80 text-white shadow-sm ring-1 ring-cyan-400/30'
                        : isFailed
                        ? 'bg-rose-500/5 border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                        : isCorrupt
                        ? 'bg-amber-500/5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="text-[11px] font-mono font-bold">{node.name.toUpperCase()}</div>
                    <div className="text-[9px] font-mono mt-0.5">
                      {isFailed ? (
                        <span className="text-rose-400">FAILED</span>
                      ) : isCorrupt ? (
                        <span className="text-amber-400">CORRUPT</span>
                      ) : (
                        <span className="text-emerald-400">HEALTHY</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Contextual Node Detail Panel */}
        <div className="lg:col-span-5 p-5 rounded-lg border border-white/[0.08] bg-[#0d0f15] space-y-4">
          {selectedNode ? (
            <>
              {/* Header with Name & Status */}
              <div className="flex items-start justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-base font-bold text-white font-mono tracking-wide">
                      {selectedNode.name.toUpperCase()}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    ID: {selectedNode.id} · <span className="text-zinc-400">storage/{selectedNode.name}/</span>
                  </p>
                </div>

                <div className="text-right">
                  {isSelectedFailed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-mono font-medium">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      FAILED
                    </span>
                  ) : isSelectedCorrupted ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      CORRUPTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      HEALTHY
                    </span>
                  )}
                </div>
              </div>

              {/* Status & Activity Explainer */}
              <div className={`p-3 rounded-md border text-xs font-sans leading-relaxed ${
                isSelectedFailed
                  ? 'bg-rose-950/20 border-rose-500/25 text-rose-200'
                  : isSelectedCorrupted
                  ? 'bg-amber-950/20 border-amber-500/25 text-amber-200'
                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-300'
              }`}>
                {isSelectedFailed ? (
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-rose-300">Node Unreachable (Offline)</div>
                      <div className="text-[11px] text-rose-300/80 mt-0.5">
                        Storage partition active. Replicas located on this node have been automatically scheduled for repair on healthy peers.
                      </div>
                    </div>
                  </div>
                ) : isSelectedCorrupted ? (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-300">Replica Checksum Mismatch</div>
                      <div className="text-[11px] text-amber-300/80 mt-0.5">
                        Cryptographic SHA-256 failure detected on physical replica bytes. Replica is quarantined from serving read downloads.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-zinc-200">Active Storage Mesh Participant</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Serving reads and replicate streams with synchronous SHA-256 verification.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="space-y-3 pt-1">
                {/* Storage Capacity Bar */}
                <div className="p-3 rounded-md bg-[#10131d] border border-white/[0.06] space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">Storage Capacity</span>
                    <span className="text-zinc-200 font-semibold">
                      {selectedNode.usedCapacity} / {selectedNode.capacity}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isSelectedFailed
                          ? 'bg-rose-500'
                          : selectedNode.utilizationPercentage > 85
                          ? 'bg-amber-500'
                          : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, selectedNode.utilizationPercentage || 2))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-0.5">
                    <span>Utilization</span>
                    <span>{selectedNode.utilizationPercentage.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Replicas & Heartbeat */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-md bg-[#10131d] border border-white/[0.06]">
                    <div className="text-[10px] font-sans uppercase tracking-wider text-zinc-400">
                      {isSelectedFailed ? 'Replicas Affected' : 'Replicas Stored'}
                    </div>
                    <div className="text-lg font-bold font-mono text-white mt-1">
                      {selectedNodeReplicas}
                    </div>
                    <div className="text-[10px] font-sans text-zinc-500 mt-0.5">
                      {selectedNodeReplicas === 1 ? '1 physical blob' : `${selectedNodeReplicas} physical blobs`}
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-[#10131d] border border-white/[0.06]">
                    <div className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" /> Heartbeat
                    </div>
                    <div className="text-xs font-mono text-zinc-200 mt-1 font-semibold">
                      {isSelectedFailed ? 'Unresponsive' : '2s interval'}
                    </div>
                    <div className="text-[10px] font-sans text-zinc-500 mt-0.5 truncate">
                      {heartbeatText}
                    </div>
                  </div>
                </div>

                {selectedNodeRecentEvent && (
                  <div className="p-2.5 rounded-md bg-[#10131d] border border-white/[0.06] text-[10px] font-mono text-zinc-400 flex items-center justify-between">
                    <span className="text-zinc-500">Last Audit Event:</span>
                    <span className="text-cyan-300 font-semibold truncate max-w-[200px]" title={selectedNodeRecentEvent.message}>
                      {selectedNodeRecentEvent.type}
                    </span>
                  </div>
                )}
              </div>

              {/* Node Actions */}
              <div className="pt-3 border-t border-white/[0.06] space-y-2">
                <div className="text-[11px] font-sans font-medium text-zinc-400 uppercase tracking-wider">
                  Node Failure Simulation
                </div>
                {isSelectedFailed ? (
                  <button
                    onClick={() => onRecoverNode(selectedNode.id, selectedNode.name)}
                    disabled={actionNodeId === selectedNode.id}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-semibold transition-all shadow-sm disabled:opacity-50"
                  >
                    {actionNodeId === selectedNode.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>Recover {selectedNode.name.toUpperCase()} (Reconcile Replicas)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmFailNode(selectedNode)}
                    disabled={actionNodeId === selectedNode.id}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-xs font-sans font-semibold transition-all disabled:opacity-50"
                  >
                    {actionNodeId === selectedNode.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>Fail {selectedNode.name.toUpperCase()} (Simulate Outage)</span>
                  </button>
                )}
                <p className="text-[11px] text-zinc-500 font-sans text-center">
                  {isSelectedFailed
                    ? 'Recovery marks the node online and safely reconciles surplus replicas.'
                    : 'Requires confirmation. Automatically tests fault recovery and replication rebalancing.'}
                </p>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500 font-sans">
              Select a node to view runtime telemetry and controls.
            </div>
          )}
        </div>
      </div>

      {/* 4. Visual Recovery Sequence Flowchart */}
      <div className="p-5 rounded-lg border border-white/[0.08] bg-[#0d0f15] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white font-sans tracking-wide">
                Fault-Tolerance Lifecycle Flowchart
              </h3>
            </div>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Live lifecycle state sequence executed by Vault during node failures and recoveries.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-white/[0.02] px-2.5 py-1 rounded border border-white/[0.06] self-start sm:self-auto">
            <span>Active Stage:</span>
            <span className="text-cyan-400 font-bold">
              {activeStep === 1
                ? 'Node Outage'
                : activeStep === 2
                ? 'Replica Degradation'
                : activeStep === 3
                ? 'Automatic Repair'
                : '3/3 Healthy'}
            </span>
          </div>
        </div>

        {/* 4-Step Visual Flowchart Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Step 1: Node Outage */}
          <div className={`p-4 rounded-lg border transition-all ${
            activeStep === 1
              ? 'bg-rose-950/20 border-rose-500/50 ring-1 ring-rose-500/30'
              : 'bg-[#10131d] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05]">STAGE 01</span>
              <XCircle className={`w-3.5 h-3.5 ${activeStep === 1 ? 'text-rose-400' : 'text-zinc-600'}`} />
            </div>
            <h4 className="text-xs font-bold text-white font-sans mt-2">
              Node Outage
            </h4>
            <p className="text-[11px] text-zinc-400 font-sans mt-1 leading-relaxed">
              Storage node goes offline due to hardware or simulated partition.
            </p>
            <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500 flex items-center gap-1">
              <span>Trigger:</span>
              <span className="text-zinc-300">Heartbeat timeout / POST</span>
            </div>
          </div>

          {/* Step 2: Replica Degradation */}
          <div className={`p-4 rounded-lg border transition-all ${
            activeStep === 2
              ? 'bg-amber-950/20 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-[#10131d] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05]">STAGE 02</span>
              <AlertTriangle className={`w-3.5 h-3.5 ${activeStep === 2 ? 'text-amber-400' : 'text-zinc-600'}`} />
            </div>
            <h4 className="text-xs font-bold text-white font-sans mt-2">
              Replica Degradation
            </h4>
            <p className="text-[11px] text-zinc-400 font-sans mt-1 leading-relaxed">
              Available replicas drop from <span className="font-mono text-zinc-200">3/3</span> to <span className="font-mono text-amber-400">2/3</span> healthy.
            </p>
            <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500 flex items-center gap-1">
              <span>Read State:</span>
              <span className="text-emerald-400">Survives loss of 2</span>
            </div>
          </div>

          {/* Step 3: Automatic Repair */}
          <div className={`p-4 rounded-lg border transition-all ${
            activeStep === 3
              ? 'bg-cyan-950/20 border-cyan-500/50 ring-1 ring-cyan-500/30'
              : 'bg-[#10131d] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05]">STAGE 03</span>
              <RefreshCw className={`w-3.5 h-3.5 ${activeStep === 3 ? 'text-cyan-400 animate-spin' : 'text-zinc-600'}`} />
            </div>
            <h4 className="text-xs font-bold text-white font-sans mt-2">
              Automatic Repair
            </h4>
            <p className="text-[11px] text-zinc-400 font-sans mt-1 leading-relaxed">
              Vault reads valid bytes from healthy peer and streams replica to standby node.
            </p>
            <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500 flex items-center gap-1">
              <span>Target:</span>
              <span className="text-cyan-300">Healthy Standby Node</span>
            </div>
          </div>

          {/* Step 4: Reconciliation on Recovery */}
          <div className={`p-4 rounded-lg border transition-all ${
            activeStep === 4
              ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
              : 'bg-[#10131d] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05]">STAGE 04</span>
              <CheckCircle2 className={`w-3.5 h-3.5 ${activeStep === 4 ? 'text-emerald-400' : 'text-zinc-600'}`} />
            </div>
            <h4 className="text-xs font-bold text-white font-sans mt-2">
              Reconciliation on Recovery
            </h4>
            <p className="text-[11px] text-zinc-400 font-sans mt-1 leading-relaxed">
              Node recovers; excess physical copies pruned to preserve exact 3× replication factor.
            </p>
            <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500 flex items-center gap-1">
              <span>Result:</span>
              <span className="text-emerald-400">3 / 3 Healthy & Verified</span>
            </div>
          </div>
        </div>

        {/* Step Arrows on Desktop */}
        <div className="hidden md:flex items-center justify-between px-8 text-zinc-600">
          <ArrowRight className="w-4 h-4 ml-24" />
          <ArrowRight className="w-4 h-4 ml-16" />
          <ArrowRight className="w-4 h-4 mr-24" />
        </div>
      </div>

      {/* 5. Confirmation Modal for Fail Node */}
      {confirmFailNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0e111a] border border-white/[0.08] rounded-xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  Fail {confirmFailNode.name.toUpperCase()}?
                </h3>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Confirm storage node outage simulation
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 font-sans leading-relaxed bg-white/[0.02] p-3 rounded border border-white/[0.06]">
              Objects with replicas on this node may temporarily become degraded. Vault will attempt automatic replica repair.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmFailNode(null)}
                className="px-4 py-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-xs font-sans font-medium text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const nodeToFail = confirmFailNode;
                  setConfirmFailNode(null);
                  await onFailNode(nodeToFail.id, nodeToFail.name);
                }}
                className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-xs font-sans font-semibold text-white transition-colors shadow-sm"
              >
                Fail Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

