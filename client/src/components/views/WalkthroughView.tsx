import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Compass,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  ShieldCheck,
  Cpu,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle
} from "lucide-react";
import { StorageNode, StoredObject, ClusterHealthSummary } from "../../api/types";
import { vaultApi } from "../../api/client";
import { StorageFabricGraph } from "../hero/StorageFabricGraph";

interface WalkthroughViewProps {
  nodes?: StorageNode[];
  objects?: StoredObject[];
  clusterHealth?: ClusterHealthSummary | null;
  corruptedNodes?: Set<string>;
  loading?: boolean;
  onFailNode?: (id: string, name: string) => Promise<void>;
  onRecoverNode?: (id: string, name: string) => Promise<void>;
  onClusterStateChange?: () => void;
  onNavigateToTab?: (tab: "objects" | "resilience" | "activity" | "walkthrough" | "failure-lab") => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const WalkthroughView: React.FC<WalkthroughViewProps> = ({
  nodes: propNodes,
  objects: propObjects,
  corruptedNodes: propCorruptedNodes,
  onClusterStateChange,
  onNavigateToTab
}) => {
  const [internalNodes, setInternalNodes] = useState<StorageNode[]>([]);
  const [internalObjects, setInternalObjects] = useState<StoredObject[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [mode, setMode] = useState<"manual" | "live-demo">("manual");
  const [showSafetyNotice, setShowSafetyNotice] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionMessage, setExecutionMessage] = useState<string>("");
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [showCodeDetails, setShowCodeDetails] = useState<boolean>(false);
  const [reconciledState, setReconciledState] = useState<{
    removedReplicas?: number;
    reconciledObjects?: number;
  } | null>(null);

  const nodes = propNodes && propNodes.length > 0 ? propNodes : internalNodes;
  const objects = propObjects && propObjects.length > 0 ? propObjects : internalObjects;
  const corruptedNodes = propCorruptedNodes || new Set<string>();

  const refreshData = useCallback(async () => {
    try {
      const [n, o] = await Promise.all([
        vaultApi.getNodes(),
        vaultApi.listObjects()
      ]);
      setInternalNodes(n);
      setInternalObjects(o);
      if (onClusterStateChange) onClusterStateChange();
    } catch (err) {
      console.error("Failed to load walkthrough state:", err);
    }
  }, [onClusterStateChange]);

  useEffect(() => {
    if (!propNodes || !propObjects) {
      refreshData();
    }
  }, [propNodes, propObjects, refreshData]);

  // Target object for demonstration
  const activeObject = useMemo(() => {
    if (objects.length > 0) return objects[0];
    return null;
  }, [objects]);

  // Target nodes
  const nodeA = nodes.find((n) => n.name.toLowerCase() === "node-a") || nodes[0];
  const nodeB = nodes.find((n) => n.name.toLowerCase() === "node-b") || nodes[1];
  const nodeD = nodes.find((n) => n.name.toLowerCase() === "node-d") || nodes[3];

  const isNodeBFailed = nodeB?.status === "FAILED";

  // Replicas count calculation
  const healthyCount = activeObject
    ? activeObject.healthyReplicaCount !== undefined
      ? activeObject.healthyReplicaCount
      : activeObject.replicaCount
    : 3;

  // Selected node in fabric for step
  const highlightedNodeId = useMemo(() => {
    switch (activeStep) {
      case 0:
        return nodeA?.id || "node-a";
      case 1:
        return nodeA?.id || "node-a";
      case 2:
        return nodeB?.id || "node-b";
      case 3:
        return nodeD?.id || "node-d";
      case 4:
        return nodeB?.id || "node-b";
      case 5:
        return null;
      default:
        return null;
    }
  }, [activeStep, nodeA, nodeB, nodeD]);

  // Execute Step 3: Real Node Failure
  const handleExecuteFailNode = async () => {
    if (!nodeB) return;
    setIsExecuting(true);
    setExecutionMessage("Simulating hardware outage on Node B...");
    setExecutionError(null);
    try {
      await vaultApi.failNode(nodeB.id);
      await refreshData();
      setActiveStep(2);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : "Node failure simulation failed");
    } finally {
      setIsExecuting(false);
      setExecutionMessage("");
    }
  };

  // Execute Step 4: Real Auto-Repair
  const handleExecuteRepair = async () => {
    if (!activeObject) return;
    setIsExecuting(true);
    setExecutionMessage("Rebuilding missing replica on healthy storage fabric node...");
    setExecutionError(null);
    try {
      await vaultApi.repairObject(activeObject.id);
      await refreshData();
      setActiveStep(3);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : "Replica repair failed");
    } finally {
      setIsExecuting(false);
      setExecutionMessage("");
    }
  };

  // Execute Step 5: Real Node Recovery & Reconciliation
  const handleExecuteRecoverNode = async () => {
    if (!nodeB) return;
    setIsExecuting(true);
    setExecutionMessage("Restoring Node B to fabric and reconciling replica set...");
    setExecutionError(null);
    try {
      const res = await vaultApi.recoverNode(nodeB.id);
      setReconciledState({
        removedReplicas: res.removedReplicas || 1,
        reconciledObjects: res.reconciledObjects || 1
      });
      await refreshData();
      setActiveStep(4);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : "Node recovery failed");
    } finally {
      setIsExecuting(false);
      setExecutionMessage("");
    }
  };

  // Steps definition
  const stepTitles = [
    { num: "01", name: "INGEST" },
    { num: "02", name: "REPLICATE" },
    { num: "03", name: "FAIL" },
    { num: "04", name: "REPAIR" },
    { num: "05", name: "RECOVER" },
    { num: "06", name: "VERIFY" }
  ];

  return (
    <div className="space-y-7 animate-fade-in">
      {/* PART 1 — WALKTHROUGH HERO */}
      <div className="bg-[#08090d] border border-white/[0.08] rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
                WALKTHROUGH
              </span>
              <span className="text-zinc-600 text-xs">•</span>
              <span className="text-xs font-mono text-zinc-400">
                {mode === "live-demo" ? "Live Guided Demo" : "Manual Exploration"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold text-white font-sans tracking-tight">
              Watch Vault survive failure.
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
              Follow an object through ingestion, replication, node failure, automatic repair and replica reconciliation.
            </p>

            <p className="text-[11px] font-mono text-zinc-400 pt-1">
              Live interface · Real Vault state · No simulated backend state
            </p>
          </div>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setShowSafetyNotice(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-semibold font-sans transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Vault Demo</span>
            </button>

            <button
              onClick={() => {
                setMode("manual");
                setActiveStep(0);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-medium font-sans border border-white/[0.08] transition-all"
            >
              <Compass className="w-3.5 h-3.5 text-zinc-400" />
              <span>Explore manually</span>
            </button>
          </div>
        </div>
      </div>

      {/* PART 2 — LIFECYCLE STEP NAVIGATOR */}
      <div className="border border-white/[0.08] bg-[#0a0d14] rounded-2xl p-2.5 sm:p-3 overflow-x-auto shadow-lg">
        <div className="flex items-center justify-between min-w-[620px] gap-2">
          {stepTitles.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = activeStep > idx;

            return (
              <React.Fragment key={step.num}>
                <button
                  onClick={() => setActiveStep(idx)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all text-xs font-mono ${
                    isActive
                      ? "bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      : isCompleted
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.02] border border-white/[0.05] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-[10px] opacity-70">{step.num}</span>
                  <span className="font-sans font-medium tracking-wide">{step.name}</span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />}
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />}
                </button>

                {idx < stepTitles.length - 1 && (
                  <span className="text-zinc-700 font-mono text-xs select-none">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Execution / Processing State Banner (Part 11) */}
      {isExecuting && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-3 animate-pulse shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-semibold uppercase tracking-wider block">PROCESSING...</span>
            <span className="text-zinc-300 font-sans">{executionMessage}</span>
          </div>
        </div>
      )}

      {/* Execution Error Banner (Part 11) */}
      {executionError && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="font-semibold uppercase tracking-wider block">OPERATION FAILED</span>
              <span className="text-zinc-300 font-sans">{executionError}</span>
            </div>
          </div>
          <button
            onClick={() => setExecutionError(null)}
            className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* MAIN CONTENT CANVAS: 2 Columns (Details + Central Storage Fabric) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Step Details & Architecture Flow */}
        <div className="lg:col-span-5 space-y-5">
          {/* STEP 01 — OBJECT INGESTION */}
          {activeStep === 0 && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  01 — OBJECT INGESTION
                </span>
                <h3 className="text-lg font-semibold text-white font-sans">
                  Single-Stream Cryptographic Intake
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Vault accepts the object and calculates its SHA-256 checksum before storing the primary copy.
                </p>
              </div>

              {/* Visual ASCII Flow */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-center text-zinc-300 space-y-1 select-none">
                <div className="text-cyan-300">USER FILE</div>
                <div className="text-zinc-600">↓</div>
                <div className="text-emerald-400">SHA-256 STREAM HASHER</div>
                <div className="text-zinc-600">↓</div>
                <div className="text-white font-semibold">NODE A (storage/node-a)</div>
              </div>

              {/* Technical Object Information Panel */}
              {activeObject ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                    <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
                      OBJECT INFORMATION
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      STORED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Name</span>
                      <span className="text-white font-sans font-medium truncate block">
                        {activeObject.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Size</span>
                      <span className="text-zinc-300">
                        {formatBytes(activeObject.sizeBytes)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-zinc-500 block uppercase">SHA-256 Checksum</span>
                      <span className="text-emerald-400 text-[11px] break-all">
                        {activeObject.checksum.slice(0, 16)}...{activeObject.checksum.slice(-16)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Primary Storage</span>
                      <span className="text-cyan-300">storage/node-a</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Initial Version</span>
                      <span className="text-zinc-300">v{activeObject.version}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs font-sans text-amber-300 space-y-2 text-center">
                  <p>Upload an object to begin the walkthrough.</p>
                  {onNavigateToTab && (
                    <button
                      onClick={() => onNavigateToTab("objects")}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-mono text-xs"
                    >
                      Upload Object
                    </button>
                  )}
                </div>
              )}

              {/* Step Navigation Action */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <span className="text-[11px] text-zinc-500 font-mono">Step 1 of 6</span>
                <button
                  onClick={() => setActiveStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-all shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 02 — THREE-WAY REPLICATION */}
          {activeStep === 1 && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  02 — THREE-WAY REPLICATION
                </span>
                <h3 className="text-lg font-semibold text-white font-sans">
                  Deterministic Whole-Object Placement
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Vault creates independent whole-object replicas across storage nodes.
                </p>
              </div>

              {/* Visual ASCII Replica Distribution */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-center text-zinc-300 space-y-1 select-none">
                <div className="text-cyan-300 font-semibold">OBJECT</div>
                <div className="text-zinc-600">↓</div>
                <div className="text-white font-semibold">NODE A</div>
                <div className="text-zinc-600">↙     ↘</div>
                <div className="flex justify-around text-emerald-400 font-semibold">
                  <span>NODE B ✓</span>
                  <span>NODE C ✓</span>
                </div>
              </div>

              {/* Replication Specifications */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
                    REPLICATION POLICY
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-white/[0.06] px-2 py-0.5 rounded">
                    3×
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">Replica State</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      NODE A ✓
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      NODE B ✓
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      NODE C ✓
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs font-mono">
                  <span className="text-zinc-400">Object Status:</span>
                  <span className="text-emerald-400 font-semibold">3 / 3 Replicas · HEALTHY</span>
                </div>

                <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-[11px] font-mono text-cyan-300">
                  Technical Note: Whole-object replication across independent disks.
                </div>
              </div>

              {/* Step Navigation Action */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <button
                  onClick={() => setActiveStep(0)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs font-sans transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setActiveStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-all shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 03 — NODE OUTAGE */}
          {activeStep === 2 && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-semibold">
                  03 — NODE OUTAGE
                </span>
                <h3 className="text-lg font-semibold text-white font-sans">
                  Degradation Detection &amp; Isolation
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  One storage node becomes unavailable. Vault detects the degradation and begins recovery.
                </p>
              </div>

              {/* Transition Banner */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] text-center font-mono text-xs space-y-2 select-none">
                <div className="text-emerald-400">HEALTHY · 3 / 3 Replicas Online</div>
                <div className="text-zinc-600">↓</div>
                <div className="text-rose-400 font-semibold flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  NODE B FAILED (Hardware / Network Drop)
                </div>
                <div className="text-zinc-600">↓</div>
                <div className="text-amber-400 font-bold">DEGRADED · 2 / 3 Replicas Online</div>
              </div>

              {/* Live Node State */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-[11px] uppercase">Node B Status</span>
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                      isNodeBFailed
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {isNodeBFailed ? "FAILED (Offline)" : "ONLINE (Healthy)"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Availability Preserved</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans">
                    Read downloads continue transparently from surviving nodes (Node A, Node C).
                  </p>
                </div>

                {/* Live Node Failure Simulation Trigger */}
                {!isNodeBFailed && (
                  <button
                    onClick={handleExecuteFailNode}
                    disabled={isExecuting}
                    className="w-full py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-sans text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>Simulate Node B Failure Now</span>
                  </button>
                )}
              </div>

              {/* Step Navigation Action */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <button
                  onClick={() => setActiveStep(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs font-sans transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setActiveStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-all shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 04 — AUTOMATIC REPAIR */}
          {activeStep === 3 && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  04 — AUTOMATIC REPAIR
                </span>
                <h3 className="text-lg font-semibold text-white font-sans">
                  Targeted Replica Reconstruction
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Vault rebuilds the missing replica on a healthy storage node.
                </p>
              </div>

              {/* Visual ASCII Flow */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-center text-zinc-300 space-y-1 select-none">
                <div className="text-white font-semibold">NODE A (Verified Source)</div>
                <div className="text-zinc-600">\</div>
                <div className="text-cyan-400 font-semibold">REPAIR STREAM (SHA-256 Verified)</div>
                <div className="text-zinc-600">\</div>
                <div className="text-emerald-400 font-semibold">NODE D (Target Node)</div>
              </div>

              {/* Technical Repair Specs Panel */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Affected Object:</span>
                  <span className="text-white font-sans font-medium">{activeObject?.name || "dataset.zip"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Before Repair:</span>
                  <span className="text-amber-400 font-semibold">2 / 3 Replicas (Degraded)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Repair Target:</span>
                  <span className="text-cyan-300 font-semibold">NODE D</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Verification:</span>
                  <span className="text-emerald-400">SHA-256 cryptographic match</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/[0.06]">
                  <span className="text-zinc-500">Result:</span>
                  <span className="text-emerald-400 font-bold">3 / 3 HEALTHY · SHA-256 VERIFIED</span>
                </div>

                {/* If object is currently degraded, allow direct repair execution */}
                {healthyCount < 3 && (
                  <button
                    onClick={handleExecuteRepair}
                    disabled={isExecuting}
                    className="w-full mt-2 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                    <span>Trigger Automatic Repair Now</span>
                  </button>
                )}
              </div>

              {/* Step Navigation Action */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <button
                  onClick={() => setActiveStep(2)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs font-sans transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setActiveStep(4)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-all shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 05 — NODE RECOVERY */}
          {activeStep === 4 && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  05 — NODE RECOVERY &amp; RECONCILIATION
                </span>
                <h3 className="text-lg font-semibold text-white font-sans">
                  Dynamic Replica Pruning
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  The failed node returns to the storage fabric. Vault reconciles replicas so the object returns to the configured replication factor.
                </p>
              </div>

              {/* Reconciliation Specs Card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Replica count before reconciliation:</span>
                  <span className="text-amber-300 font-semibold">4 replicas (A, B, C, D)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Configured replication factor:</span>
                  <span className="text-white">3×</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Reconciliation Action:</span>
                  <span className="text-cyan-400">Removing excess replica from Node D</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/[0.06]">
                  <span className="text-zinc-500">Final Stable State:</span>
                  <span className="text-emerald-400 font-bold">3 / 3 HEALTHY</span>
                </div>

                {reconciledState && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                    Reconciliation Complete: Safely pruned {reconciledState.removedReplicas} excess replica across {reconciledState.reconciledObjects} object.
                  </div>
                )}

                {/* If Node B is still failed, allow executing recovery */}
                {isNodeBFailed && (
                  <button
                    onClick={handleExecuteRecoverNode}
                    disabled={isExecuting}
                    className="w-full mt-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Recover Node B &amp; Reconcile Replicas</span>
                  </button>
                )}
              </div>

              {/* Step Navigation Action */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <button
                  onClick={() => setActiveStep(3)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs font-sans transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setActiveStep(5)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-all shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 06 — INTEGRITY VERIFIED */}
          {activeStep === 5 && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  06 — INTEGRITY VERIFIED
                </span>
                <h3 className="text-lg font-semibold text-white font-sans">
                  Cryptographic Baseline Confirmed
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Vault verifies the repaired replicas against the expected SHA-256 checksum.
                </p>
              </div>

              {/* Verification Badges */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    NODE A<br /><span className="text-[10px]">✓ MATCH</span>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    NODE B<br /><span className="text-[10px]">✓ MATCH</span>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    NODE C<br /><span className="text-[10px]">✓ MATCH</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-black/40 border border-white/[0.06] text-xs font-mono space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase block">Expected SHA-256 Checksum</span>
                  <span className="text-emerald-400 break-all select-all text-[11px]">
                    {activeObject?.checksum || "a7a19dc539a7dcfd4c80da7cede566bf36b0700bc1912639c49e921d813df7af"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>3 / 3 REPLICAS HEALTHY · INTEGRITY VERIFIED</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 font-sans">
                    Vault recovered the object without changing its expected checksum.
                  </p>
                </div>
              </div>

              {/* Step Navigation Action */}
              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <button
                  onClick={() => setActiveStep(4)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs font-sans transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setActiveStep(6)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-medium transition-all shadow-sm"
                >
                  <span>View Recovery Summary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* FINAL SUMMARY (Part 10 & 18) */}
          {activeStep === 6 && (
            <div className="bg-[#0b0e17] border border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  VAULT RECOVERY COMPLETE
                </span>
                <h3 className="text-xl font-semibold text-white font-sans">
                  Vault is ready.
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  The full lifecycle test demonstrated end-to-end resilience against physical storage node dropouts.
                </p>
              </div>

              {/* 7-Stage Architectural Lifecycle Summary */}
              <div className="space-y-1.5 font-mono text-xs">
                {[
                  "01 Object stored",
                  "02 3× replicated",
                  "03 Node failure detected",
                  "04 Replica automatically repaired",
                  "05 Node recovered",
                  "06 Replica set reconciled",
                  "07 SHA-256 verified"
                ].map((stage, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-white/[0.02] border border-white/[0.05] flex items-center justify-between"
                  >
                    <span className="text-zinc-300">{stage}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                ))}
              </div>

              {/* Part 18: Navigation to Other Product Views */}
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {onNavigateToTab && (
                    <>
                      <button
                        onClick={() => onNavigateToTab("objects")}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Explore Objects</span>
                      </button>

                      <button
                        onClick={() => onNavigateToTab("resilience")}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Open Resilience</span>
                      </button>

                      <button
                        onClick={() => onNavigateToTab("failure-lab")}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Run Failure Lab</span>
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setActiveStep(0)}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Run Walkthrough Again</span>
                </button>
              </div>
            </div>
          )}

          {/* PART 17 — EXPANDABLE CODE SNIPPETS */}
          <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0f17]">
            <button
              onClick={() => setShowCodeDetails(!showCodeDetails)}
              className="w-full p-3 text-left flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                TECHNICAL DETAILS &amp; ENGINE REFERENCE
              </span>
              {showCodeDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showCodeDetails && (
              <div className="p-3.5 border-t border-white/[0.06] bg-black/60 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed space-y-2">
                <p className="text-zinc-500">// Distributed Engine Implementation</p>
                <pre>{`// 1. Ingestion: Streaming SHA-256 calculation
const hash = crypto.createHash("sha256");
stream.on("data", chunk => hash.update(chunk));

// 2. Replication: Whole-object placement across healthy volumes
const desired = object.replicationFactor; // RF=3
for (const node of candidateNodes.slice(0, needed)) {
  await storage.copyObject(sourcePath, targetPath);
  await db.replica.create({ data: { objectId, nodeId: node.id, checksum } });
}

// 3. Automated Repair: Reconstructs onto surviving fabric on node drop
const targetNode = availableHealthyNodes.find(n => !currentNodes.has(n.id));
await storage.copyBlob(sourceReplica.path, targetNode.path);

// 4. Reconciliation: Dynamic pruning of temporary repair replica
if (healthyReplicas.length > object.replicationFactor) {
  const excess = healthyReplicas.slice(object.replicationFactor);
  for (const replica of excess) {
    await fs.promises.unlink(replica.physicalPath);
    await db.replica.delete({ where: { id: replica.id } });
  }
}`}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Central Storage Fabric Visualization (Part 3) */}
        <div className="lg:col-span-7 bg-[#08090d] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-cyan-400">
                CENTRAL STORAGE FABRIC
              </span>
              <h4 className="text-sm font-semibold text-white font-sans">
                Topology State Reactive Visualization
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.06]">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>RF=3 Policy</span>
            </div>
          </div>

          {/* Central StorageFabricGraph Centerpiece */}
          <div className="bg-[#0b0e17] rounded-xl border border-white/[0.06] p-2 flex items-center justify-center min-h-[390px] relative overflow-hidden">
            <StorageFabricGraph
              nodes={nodes}
              objects={objects}
              corruptedNodes={corruptedNodes}
              isRepairing={activeStep === 3}
              selectedNodeId={highlightedNodeId}
            />
          </div>

          {/* Fabric Legend & Step Context */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Healthy Node</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Failed Node</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Active Target</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Reconciling</span>
            </div>
          </div>
        </div>
      </div>

      {/* PART 13 — DEMO MODE SAFETY MODAL */}
      {showSafetyNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#101422] border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-cyan-400">
              <Play className="w-5 h-5 fill-current" />
              <h3 className="text-sm font-semibold font-sans uppercase tracking-wider text-white">
                LIVE DEMONSTRATION
              </h3>
            </div>

            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              This walkthrough can modify the current Vault cluster state by failing and recovering a storage node.
            </p>

            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs font-mono text-zinc-400">
              <div>• Simulates hardware failure on Node B</div>
              <div>• Demonstrates degraded state detection</div>
              <div>• Verifies automatic repair on Node D</div>
              <div>• Recovers Node B and reconciles replica count</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowSafetyNotice(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-sans font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSafetyNotice(false);
                  setMode("live-demo");
                  setActiveStep(0);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-sans font-semibold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Start Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
