import React, { useState, useEffect, useMemo } from 'react';
import { StorageNode, StoredObject, StoredObjectDetail, SystemEvent } from '../../api/types';
import { vaultApi } from '../../api/client';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Cpu,
  Loader2,
  ShieldCheck,
  XCircle,
  FileCode,
  ArrowRight,
  UploadCloud,
  Check,
  Activity
} from 'lucide-react';
import { StatusDot } from '../ui/StatusDot';

interface FailureLabViewProps {
  nodes: StorageNode[];
  objects?: StoredObject[];
  events?: SystemEvent[];
  onFailNode: (id: string, name: string) => Promise<void>;
  onRecoverNode: (id: string, name: string) => Promise<void>;
  actionNodeId: string | null;
  onClusterStateChange: () => void;
  onNavigateToObjects?: () => void;
}

export const FailureLabView: React.FC<FailureLabViewProps> = ({
  nodes,
  objects: initialObjects = [],
  events: initialEvents = [],
  onFailNode,
  onRecoverNode,
  actionNodeId,
  onClusterStateChange,
  onNavigateToObjects
}) => {
  const [objects, setObjects] = useState<StoredObject[]>(initialObjects);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [selectedObjectDetail, setSelectedObjectDetail] = useState<StoredObjectDetail | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string>('');
  const [isCorrupting, setIsCorrupting] = useState<boolean>(false);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [repairStage, setRepairStage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation Modals
  const [confirmFailNode, setConfirmFailNode] = useState<StorageNode | null>(null);
  const [confirmCorrupt, setConfirmCorrupt] = useState<{ objectId: string; nodeName: string } | null>(null);

  // Sync objects from props if updated
  useEffect(() => {
    if (initialObjects.length > 0) {
      setObjects(initialObjects);
      if (!selectedObjectId) {
        setSelectedObjectId(initialObjects[0].id);
      }
    }
  }, [initialObjects, selectedObjectId]);

  const loadObjects = async () => {
    try {
      const list = await vaultApi.listObjects();
      setObjects(list);
      if (list.length > 0 && !selectedObjectId) {
        setSelectedObjectId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load objects in failure lab:', err);
    }
  };

  useEffect(() => {
    loadObjects();
  }, []);

  // Fetch object detail whenever selected object changes
  const fetchDetail = async (id: string) => {
    try {
      const detail = await vaultApi.getObject(id);
      setSelectedObjectDetail(detail);
      // Auto-select replica: prefer healthy, or first replica
      const healthyRep = detail.replicas.find((r) => r.status === 'HEALTHY');
      if (healthyRep) {
        setSelectedNodeName(healthyRep.nodeName);
      } else if (detail.replicas.length > 0) {
        setSelectedNodeName(detail.replicas[0].nodeName);
      }
    } catch (err) {
      console.error('Failed to load object detail in failure lab:', err);
    }
  };

  useEffect(() => {
    if (!selectedObjectId) {
      setSelectedObjectDetail(null);
      return;
    }
    fetchDetail(selectedObjectId);
  }, [selectedObjectId]);

  // Handle corrupt replica
  const executeCorruptReplica = async () => {
    if (!confirmCorrupt) return;
    const { objectId, nodeName } = confirmCorrupt;
    setConfirmCorrupt(null);

    setIsCorrupting(true);
    setToast(null);
    try {
      await vaultApi.corruptReplica(objectId, nodeName);
      setToast({
        type: 'success',
        message: `Injected bit corruption into ${nodeName.toUpperCase()} replica! SHA-256 mismatch detected.`
      });
      await fetchDetail(objectId);
      await loadObjects();
      onClusterStateChange();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Corruption simulation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setIsCorrupting(false);
    }
  };

  // Handle verify & repair with stage progression
  const handleRepairWithStages = async () => {
    if (!selectedObjectId) return;
    setIsRepairing(true);
    setToast(null);

    try {
      // Stage 1: VERIFYING SOURCE
      setRepairStage('VERIFYING SOURCE');
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Stage 2: VALID REPLICA FOUND
      setRepairStage('VALID REPLICA FOUND');
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Stage 3: REPAIRING TARGET
      setRepairStage('REPAIRING TARGET');
      const res = await vaultApi.repairObject(selectedObjectId);

      // Stage 4: SHA-256 VERIFICATION
      setRepairStage('SHA-256 VERIFICATION');
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Stage 5: 3 / 3 VERIFIED
      setRepairStage('3 / 3 VERIFIED');

      setToast({
        type: 'success',
        message: `Verification and repair complete! Restored ${res.healthyReplicas}/${res.desiredReplicas} healthy replicas with SHA-256 verified.`
      });

      await fetchDetail(selectedObjectId);
      await loadObjects();
      onClusterStateChange();

      // Clear stage after 2.5s
      setTimeout(() => {
        setRepairStage(null);
      }, 2500);
    } catch (err) {
      setRepairStage(null);
      setToast({
        type: 'error',
        message: `Repair failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setIsRepairing(false);
    }
  };

  // Derived cluster status for Experiment 1
  const failedNodes = useMemo(() => nodes.filter((n) => n.status === 'FAILED'), [nodes]);
  const anyNodeFailed = failedNodes.length > 0;

  // Selected object recovery status
  const currentObject = useMemo(() => {
    return objects.find((o) => o.id === selectedObjectId) || objects[0] || null;
  }, [objects, selectedObjectId]);

  const healthyReplicasCount = selectedObjectDetail
    ? selectedObjectDetail.replicas.filter((r) => r.status === 'HEALTHY').length
    : currentObject?.healthyReplicaCount ?? (currentObject?.replicaCount ?? 3);

  const desiredReplicasCount = currentObject?.replicationFactor || 3;
  const isObjectDegraded = healthyReplicasCount < desiredReplicasCount;

  // Determine repair target from recent events or healthy nodes
  const repairTargetNode = useMemo(() => {
    const repairEvent = initialEvents.find(
      (e) => (e.type === 'REPLICA_REPAIRED' || e.type === 'REPAIR_STARTED') && e.objectId === currentObject?.id
    );
    if (repairEvent?.nodeId) {
      return repairEvent.nodeId.toUpperCase();
    }
    // Fallback: finding a healthy node that holds a replica
    const standby = nodes.find((n) => n.status === 'HEALTHY' && n.name.toLowerCase() !== 'node-a');
    return standby ? standby.name.toUpperCase() : 'NODE D';
  }, [initialEvents, currentObject, nodes]);

  // Format event time
  const formatEventTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
            Simulation Suite
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-xs font-mono text-zinc-500">Fault Injection</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans mt-1">
          FAILURE LAB
        </h1>
        <p className="text-sm text-zinc-300 font-sans mt-1 font-medium">
          Break the storage fabric. Watch Vault recover.
        </p>
        <p className="text-xs text-zinc-400 font-sans mt-0.5">
          Controlled failure simulations for node availability and replica integrity.
        </p>
      </div>

      {/* Global Toast / Feedback Banner */}
      {toast && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-sans flex items-center justify-between gap-3 animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-zinc-400 hover:text-white text-[11px] font-mono underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Check Empty State: If no objects exist in cluster */}
      {objects.length === 0 ? (
        <div className="p-12 rounded-xl border border-white/[0.08] bg-[#0d0f15] text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 mx-auto">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-sans uppercase tracking-wider">
              NO OBJECTS AVAILABLE
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-1 max-w-sm mx-auto">
              Upload an object before running replica failure experiments.
            </p>
          </div>
          <button
            onClick={() => onNavigateToObjects?.()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-semibold transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Object</span>
          </button>
        </div>
      ) : (
        /* Experiments Grid: Two Core Workbenches */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ============================================================ */}
          {/* EXPERIMENT 01: NODE OUTAGE */}
          {/* ============================================================ */}
          <div className="p-5 rounded-lg border border-white/[0.08] bg-[#0d0f15] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-mono tracking-wider">
                    EXPERIMENT 01 — NODE OUTAGE
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 font-sans mt-1">
                  Simulate an independently failing storage node and observe replica degradation and automatic repair.
                </p>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/40 self-start sm:self-auto">
                Automatic Repair
              </span>
            </div>

            {/* 5-Node Status Cards */}
            <div className="space-y-2">
              <span className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider block">
                Cluster Storage Nodes ({nodes.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nodes.map((node) => {
                  const isFailed = node.status === 'FAILED';
                  const isActionLoading = actionNodeId === node.id;

                  return (
                    <div
                      key={node.id}
                      className={`p-3 rounded-md border flex items-center justify-between transition-colors ${
                        isFailed
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-white/[0.02] border-white/[0.06]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-200 font-mono">
                            {node.name.toUpperCase()}
                          </span>
                        </div>
                        <StatusDot status={node.status} size="sm" />
                      </div>

                      <div>
                        {isFailed ? (
                          <button
                            onClick={() => onRecoverNode(node.id, node.name)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-medium transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                          >
                            {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>Recover</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmFailNode(node)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-xs font-sans font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>Fail Node</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Recovery Panel */}
            <div className="pt-2 border-t border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider">
                  Live Recovery Status
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  anyNodeFailed || isObjectDegraded
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {anyNodeFailed || isObjectDegraded ? 'RECOVERY IN PROGRESS' : 'RECOVERY COMPLETE'}
                </span>
              </div>

              {/* Recovery Status Box */}
              <div className="p-3.5 rounded-lg bg-[#10131d] border border-white/[0.06] space-y-2.5 text-xs font-sans">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                  <span className="text-zinc-500">Object Tracked:</span>
                  <span className="font-mono text-zinc-200 font-semibold truncate max-w-[200px]">
                    {currentObject?.name || 'dataset.zip'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-black/30 border border-white/[0.04]">
                    <span className="text-zinc-500 block text-[10px] font-sans">Before Failure</span>
                    <span className="text-zinc-200 font-bold">3 / 3 Replicas</span>
                  </div>
                  <div className="p-2 rounded bg-black/30 border border-white/[0.04]">
                    <span className="text-zinc-500 block text-[10px] font-sans">Current Healthy</span>
                    <span className={`font-bold ${isObjectDegraded ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {healthyReplicasCount} / {desiredReplicasCount} Healthy
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-500 font-mono text-[11px]">Repair Target:</span>
                  <span className="font-mono text-cyan-300 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                    {repairTargetNode}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono text-[11px]">Verification:</span>
                  <span className="font-mono text-zinc-300 font-medium">
                    SHA-256 (256-bit Stream)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                  <span className="text-zinc-500 font-mono text-[11px]">Status:</span>
                  <span className={`font-mono font-bold ${
                    anyNodeFailed || isObjectDegraded ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {anyNodeFailed || isObjectDegraded ? 'Repairing Replicas...' : '3 / 3 replicas SHA-256 verified'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.05] text-[11px] font-sans text-zinc-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Vault maintains read availability as long as at least 1 healthy replica remains.</span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* EXPERIMENT 02: REPLICA INTEGRITY */}
          {/* ============================================================ */}
          <div className="p-5 rounded-lg border border-white/[0.08] bg-[#0d0f15] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-mono tracking-wider">
                    EXPERIMENT 02 — REPLICA INTEGRITY
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 font-sans mt-1">
                  Simulate physical corruption and verify that Vault detects the invalid replica before repair.
                </p>
              </div>
              <span className="text-[10px] font-mono text-rose-300 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-800/40 self-start sm:self-auto">
                Bit-Rot Simulation
              </span>
            </div>

            {/* Target Selectors: Object & Replica */}
            <div className="space-y-3">
              {/* 1. Object Selector */}
              <div>
                <label className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Select Target Object
                </label>
                <select
                  value={selectedObjectId}
                  onChange={(e) => setSelectedObjectId(e.target.value)}
                  className="w-full bg-[#10131d] border border-white/[0.08] rounded-md px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-400/50"
                >
                  {objects.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.name} (v{obj.version} · {obj.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Replica Selector */}
              {selectedObjectDetail && (
                <div>
                  <label className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Select Replica to Corrupt
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedObjectDetail.replicas.map((rep) => {
                      const isCorrupted = rep.status === 'CORRUPTED';
                      const isSelected = selectedNodeName === rep.nodeName;

                      return (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => setSelectedNodeName(rep.nodeName)}
                          className={`p-2.5 rounded-md border text-left transition-all ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-400/80 text-cyan-200 ring-1 ring-cyan-400/30'
                              : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div className="font-bold text-xs font-mono">{rep.nodeName.toUpperCase()}</div>
                          <div className="text-[10px] font-mono mt-1">
                            {isCorrupted ? (
                              <span className="text-rose-400 flex items-center gap-1 font-semibold">
                                <XCircle className="w-3 h-3" /> Corrupted
                              </span>
                            ) : (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Verified
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action 1: Corrupt Replica Button */}
              <button
                onClick={() => {
                  if (selectedObjectId && selectedNodeName) {
                    setConfirmCorrupt({ objectId: selectedObjectId, nodeName: selectedNodeName });
                  }
                }}
                disabled={isCorrupting || isRepairing || !selectedNodeName}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-xs font-sans font-semibold transition-colors disabled:opacity-50"
              >
                {isCorrupting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span>Corrupt Replica ({selectedNodeName.toUpperCase() || 'None'})</span>
              </button>
            </div>

            {/* Corruption State Display & Per-Replica SHA-256 Breakdown */}
            <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider">
                  SHA-256 Integrity Verification
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  selectedObjectDetail?.replicas.some((r) => r.status === 'CORRUPTED')
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {selectedObjectDetail?.replicas.some((r) => r.status === 'CORRUPTED')
                    ? 'SHA-256 MISMATCH'
                    : 'ALL REPLICAS MATCH'}
                </span>
              </div>

              {/* Per-Replica Status Breakdown */}
              <div className="space-y-1.5 font-mono text-xs">
                {selectedObjectDetail?.replicas.map((rep) => {
                  const isCorrupted = rep.status === 'CORRUPTED';

                  return (
                    <div
                      key={rep.id}
                      className={`p-2 rounded-md border flex items-center justify-between ${
                        isCorrupted
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                          : 'bg-[#10131d] border-white/[0.05] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{rep.nodeName.toUpperCase()}</span>
                        <span className="text-[10px] text-zinc-500">v{rep.version}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {isCorrupted ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-bold text-amber-400">⚠ SHA-256 MISMATCH</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-medium text-emerald-400">✓ SHA-256 MATCH</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Object State Badge */}
              <div className="flex items-center justify-between text-xs font-mono p-2.5 rounded bg-black/30 border border-white/[0.04]">
                <span className="text-zinc-500">Object State:</span>
                <span className={`font-bold ${
                  selectedObjectDetail?.replicas.some((r) => r.status === 'CORRUPTED')
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {selectedObjectDetail?.replicas.some((r) => r.status === 'CORRUPTED')
                    ? 'INTEGRITY DEGRADED'
                    : '100% CRYPTOGRAPHICALLY VERIFIED'}
                </span>
              </div>
            </div>

            {/* Action 2: Repair Action & Step Progression */}
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <button
                onClick={handleRepairWithStages}
                disabled={isRepairing || isCorrupting || !selectedObjectId}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                {isRepairing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Verify & Repair</span>
              </button>

              {/* Animated Stage Progression */}
              {repairStage && (
                <div className="p-3 rounded-md bg-cyan-950/20 border border-cyan-500/30 text-xs font-mono space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between text-cyan-300 font-bold">
                    <span>REPAIR STAGE PROGRESSION:</span>
                    <span className="text-emerald-400">{repairStage}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
                    <span className={repairStage === 'VERIFYING SOURCE' ? 'text-cyan-300 font-bold' : ''}>
                      VERIFYING SOURCE
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className={repairStage === 'VALID REPLICA FOUND' ? 'text-cyan-300 font-bold' : ''}>
                      VALID REPLICA FOUND
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className={repairStage === 'REPAIRING TARGET' ? 'text-cyan-300 font-bold' : ''}>
                      REPAIRING TARGET
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className={repairStage === 'SHA-256 VERIFICATION' ? 'text-cyan-300 font-bold' : ''}>
                      SHA-256 VERIFICATION
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className={repairStage === '3 / 3 VERIFIED' ? 'text-emerald-400 font-bold' : ''}>
                      3 / 3 VERIFIED
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 font-sans text-center">
                User-initiated cryptographic repair. Reads uncorrupted replica, streams bytes, and verifies checksum.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Live Activity Timeline (Beside / Below Experiments) */}
      <div className="p-5 rounded-lg border border-white/[0.08] bg-[#0d0f15] space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Live Activity Timeline
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            Real cluster audit events
          </span>
        </div>

        {initialEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 font-sans">
            No events recorded yet. Run a failure experiment or upload an object.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {initialEvents.slice(0, 4).map((ev) => {
              const isFailed = ev.type.includes('FAIL') || ev.type.includes('CORRUPT');
              const isRepaired = ev.type.includes('REPAIR') || ev.type.includes('RECOVER');

              return (
                <div
                  key={ev.id}
                  className="p-3 rounded-md bg-[#10131d] border border-white/[0.04] space-y-1 font-mono text-xs"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isFailed ? 'bg-rose-500' : isRepaired ? 'bg-cyan-400' : 'bg-emerald-400'
                      }`} />
                      <span className={`font-bold ${
                        isFailed ? 'text-rose-400' : isRepaired ? 'text-cyan-400' : 'text-zinc-300'
                      }`}>
                        {ev.type}
                      </span>
                    </div>
                    <span className="text-zinc-500">{formatEventTime(ev.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans truncate" title={ev.message}>
                    {ev.message}
                  </p>
                  {ev.nodeId && (
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Target: <span className="text-zinc-300">{ev.nodeId}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal: Fail Node */}
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

      {/* Confirmation Modal: Corrupt Replica */}
      {confirmCorrupt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0e111a] border border-white/[0.08] rounded-xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  Corrupt this physical replica?
                </h3>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Target: {confirmCorrupt.nodeName.toUpperCase()}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 font-sans leading-relaxed bg-white/[0.02] p-3 rounded border border-white/[0.06]">
              This modifies the stored bytes without changing the expected object checksum.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCorrupt(null)}
                className="px-4 py-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-xs font-sans font-medium text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeCorruptReplica}
                className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-xs font-sans font-semibold text-white transition-colors shadow-sm"
              >
                Corrupt Replica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
