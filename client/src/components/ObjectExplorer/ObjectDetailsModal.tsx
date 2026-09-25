import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Trash2,
  ShieldCheck,
  Clock,
  FileText,
  CopyPlus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { StoredObjectDetail } from "../../api/types";
import { ObjectReplicaMap } from "./ObjectReplicaMap";

interface ObjectDetailsModalProps {
  object: StoredObjectDetail | null;
  onClose: () => void;
  onDownload: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReplicate?: (id: string) => Promise<void>;
  onCorruptReplica?: (objectId: string, nodeName: string) => Promise<void>;
  isReplicating?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const ObjectDetailsModal: React.FC<ObjectDetailsModalProps> = ({
  object,
  onClose,
  onDownload,
  onDelete,
  onReplicate,
  onCorruptReplica,
  isReplicating = false
}) => {
  const [copiedChecksum, setCopiedChecksum] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showFullHash, setShowFullHash] = useState(false);
  const [repairJustCompleted, setRepairJustCompleted] = useState(false);
  const [corruptCandidate, setCorruptCandidate] = useState<{
    nodeId: string;
    nodeName: string;
  } | null>(null);
  const [isCorrupting, setIsCorrupting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!object) return null;

  const replicas = object.replicas || [];
  const healthyCount =
    typeof object.healthyReplicaCount === "number"
      ? object.healthyReplicaCount
      : replicas.filter((r) => r.status === "HEALTHY").length;
  const corruptedCount = replicas.filter((r) => r.status === "CORRUPTED").length;
  const hasCorrupted = corruptedCount > 0;
  const isDegraded = healthyCount < object.replicationFactor || hasCorrupted;

  const handleCopy = (text: string, type: "checksum" | "id") => {
    navigator.clipboard.writeText(text);
    if (type === "checksum") {
      setCopiedChecksum(true);
      setTimeout(() => setCopiedChecksum(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleTriggerRepair = async () => {
    if (!onReplicate) return;
    try {
      await onReplicate(object.id);
      setRepairJustCompleted(true);
      setTimeout(() => setRepairJustCompleted(false), 4000);
    } catch (err) {
      console.error("Repair failed:", err);
    }
  };

  const healthySource = replicas.find((r) => r.status === "HEALTHY");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b0e17] border border-white/[0.1] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-[#0f1320] sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold font-sans text-white truncate max-w-md">
                  {object.name}
                </h3>
                <span
                  className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${
                    hasCorrupted
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      : isDegraded
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {hasCorrupted ? "INTEGRITY DEGRADED" : isDegraded ? "DEGRADED" : "HEALTHY"}
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                {formatBytes(object.sizeBytes)} ({Number(object.size || object.sizeBytes).toLocaleString()} bytes)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(object.id, object.name)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-colors shadow-sm"
              title="Download Object"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Active Repair Banner (Part 8) */}
          {isReplicating ? (
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-200 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  REPAIRING REPLICAS
                </span>
                <span className="text-cyan-400/80">Status: Repairing...</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-zinc-400">
                <div>
                  <span className="text-zinc-500 block">Source</span>
                  <span className="text-white font-semibold">{healthySource ? healthySource.nodeName : "Node A"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Target</span>
                  <span className="text-cyan-300">Healthy Storage Fabric Node</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Verification</span>
                  <span className="text-emerald-400">SHA-256 Re-Verification</span>
                </div>
              </div>
            </div>
          ) : repairJustCompleted ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>REPAIR COMPLETE · {healthyCount} / {object.replicationFactor} Healthy · SHA-256 Verified</span>
              </div>
            </div>
          ) : null}

          {/* Part 9: Object Health Summary Panel */}
          <div className="p-4 rounded-xl bg-[#0f1320] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-400">
                  OBJECT HEALTH
                </span>
                <span className="text-zinc-600">•</span>
                <span
                  className={`text-xs font-sans font-medium flex items-center gap-1.5 ${
                    hasCorrupted
                      ? "text-rose-400"
                      : isDegraded
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasCorrupted
                        ? "bg-rose-400"
                        : isDegraded
                        ? "bg-amber-400"
                        : "bg-emerald-400 animate-pulse"
                    }`}
                  />
                  {hasCorrupted
                    ? "Integrity Degraded"
                    : isDegraded
                    ? "Degraded"
                    : "Healthy"}
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-300">
                {hasCorrupted ? (
                  <>
                    {replicas.length} replicas registered · {healthyCount} / {object.replicationFactor} SHA-256 verified ·{" "}
                    <span className="text-rose-400 font-semibold">{corruptedCount} replica corrupted</span>
                  </>
                ) : isDegraded ? (
                  <>
                    {healthyCount} / {object.replicationFactor} replicas available · {healthyCount} / {object.replicationFactor} integrity verified
                  </>
                ) : (
                  <>
                    {healthyCount} / {object.replicationFactor} replicas available · {healthyCount} / {object.replicationFactor} integrity verified
                  </>
                )}
              </p>
            </div>

            {/* Repair CTA if degraded */}
            {isDegraded && onReplicate && !isReplicating && (
              <button
                onClick={handleTriggerRepair}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                <span>Repair Replicas</span>
              </button>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 block mb-1">
                Object ID
              </span>
              <div className="flex items-center justify-between text-zinc-200 font-mono">
                <span className="truncate mr-1 text-[11px]">{object.id.slice(0, 10)}...</span>
                <button
                  onClick={() => handleCopy(object.id, "id")}
                  className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0"
                  title="Copy full Object ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 block mb-1">
                Content Type
              </span>
              <span className="text-zinc-300 font-mono text-[11px] truncate block" title={object.contentType}>
                {object.contentType || "application/octet-stream"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 block mb-1">
                Version
              </span>
              <span className="text-zinc-300 font-mono text-[11px]">
                v{object.version}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 block mb-1">
                Created
              </span>
              <span className="text-zinc-300 font-sans text-[11px] truncate block" title={new Date(object.createdAt).toLocaleString()}>
                {new Date(object.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Part 5: Integrity Section (SHA-256) */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] uppercase tracking-wider font-mono font-semibold text-zinc-400">
                  INTEGRITY · SHA-256
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    hasCorrupted
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {hasCorrupted ? "⚠ MISMATCH DETECTED" : "✓ VERIFIED"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullHash(!showFullHash)}
                  className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {showFullHash ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showFullHash ? "Collapse" : "Full Hash"}</span>
                </button>
                <button
                  onClick={() => handleCopy(object.checksum, "checksum")}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 transition-colors"
                >
                  {copiedChecksum ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy hash</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] text-xs font-mono text-emerald-400 break-all select-all">
              {showFullHash
                ? object.checksum
                : `${object.checksum.slice(0, 16)}...${object.checksum.slice(-16)}`}
            </div>
          </div>

          {/* Part 5: Visual Replica Distribution Centerpiece */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase text-zinc-400 tracking-wider font-mono font-semibold">
                REPLICA DISTRIBUTION
              </span>
              <span className="text-xs font-mono text-zinc-500">
                Topology Map
              </span>
            </div>
            <ObjectReplicaMap object={object} />
          </div>

          {/* Part 6: Replica Inspection Table */}
          <div className="space-y-2">
            <span className="text-xs uppercase text-zinc-400 tracking-wider font-mono font-semibold">
              TECHNICAL REPLICA INSPECTION
            </span>

            <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0f17]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111522] border-b border-white/[0.06] text-zinc-400 font-sans font-medium text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Node</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Storage Path</th>
                    <th className="py-2.5 px-3">Checksum</th>
                    <th className="py-2.5 px-3 text-center">Integrity</th>
                    <th className="py-2.5 px-3 text-right">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {replicas.map((replica) => {
                    const isCorrupted = replica.status === "CORRUPTED";
                    const isUnavailable =
                      replica.status === "UNAVAILABLE" || replica.status === "FAILED";

                    return (
                      <tr key={replica.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white font-sans">
                          {replica.nodeName}
                        </td>
                        <td className="py-2.5 px-3">
                          {isCorrupted ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/25 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Corrupted
                            </span>
                          ) : isUnavailable ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                              Unavailable
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Healthy
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px] font-mono">
                          storage/{replica.nodeName}/{object.id.slice(0, 8)}...blob
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px] font-mono">
                          {isCorrupted ? (
                            <span className="text-rose-400">Drifted (Mismatch)</span>
                          ) : (
                            `${object.checksum.slice(0, 8)}...`
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[11px]">
                          {isCorrupted ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-medium font-sans">
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              ⚠ Mismatch
                            </span>
                          ) : isUnavailable ? (
                            <span className="text-zinc-500 font-sans">— Unavailable</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium font-sans">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ✓ Match
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                          {replica.version}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Part 7: Integrity Simulation & Failure Testing Section */}
          <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/20 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-rose-300 font-mono uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  INTEGRITY SIMULATION &amp; FAILURE TESTING
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1 font-sans">
                  Intentionally modify stored replica bytes without changing the expected object checksum to demonstrate SHA-256 detection and replica repair.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/15">
              <span className="text-[11px] font-mono text-zinc-400 mr-2">Target Node:</span>
              {replicas.map((replica) => {
                const isHealthy = replica.status === "HEALTHY";
                return (
                  <button
                    key={replica.id}
                    disabled={!isHealthy || !onCorruptReplica}
                    onClick={() =>
                      setCorruptCandidate({
                        nodeId: replica.nodeId,
                        nodeName: replica.nodeName
                      })
                    }
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                      isHealthy
                        ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer"
                        : "bg-zinc-800/40 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    Corrupt {replica.nodeName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Timestamps */}
          <div className="flex items-center justify-between text-[11px] font-sans text-zinc-500 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Ingested: {new Date(object.createdAt).toLocaleString()}</span>
            </div>
            <span className="font-mono">Vault Storage Engine v1.0</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/[0.08] bg-[#0f1320] sticky bottom-0 z-20">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-sans font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Object</span>
          </button>

          <div className="flex items-center gap-2">
            {isDegraded && onReplicate && !isReplicating && (
              <button
                onClick={handleTriggerRepair}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-sans font-medium transition-colors shadow-sm"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                <span>Repair Replicas</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200 text-xs font-sans font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Corruption Simulation */}
      {corruptCandidate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#101422] border border-rose-500/30 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <h3 className="text-sm font-semibold font-sans tracking-wide text-white">
                Simulate Corruption on {corruptCandidate.nodeName}?
              </h3>
            </div>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              This modifies stored replica bytes without changing the expected object checksum. Vault will detect the SHA-256 mismatch and mark the object as degraded.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setCorruptCandidate(null)}
                disabled={isCorrupting}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-sans font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!onCorruptReplica) return;
                  try {
                    setIsCorrupting(true);
                    await onCorruptReplica(object.id, corruptCandidate.nodeName);
                    setCorruptCandidate(null);
                  } catch (err) {
                    alert(`Corruption simulation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  } finally {
                    setIsCorrupting(false);
                  }
                }}
                disabled={isCorrupting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-sans font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {isCorrupting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>Corrupt Replica</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Object Deletion (Part 4) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#101422] border border-rose-500/30 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5 text-rose-400 shrink-0" />
              <h3 className="text-sm font-semibold font-sans tracking-wide text-white">
                DELETE OBJECT?
              </h3>
            </div>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              This will remove the object and all of its stored replicas.
            </p>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Object:</span>
                <span className="text-white font-sans font-medium">{object.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Replicas:</span>
                <span className="text-cyan-400">{replicas.length} distributed</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-sans font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(object.id);
                  setShowDeleteConfirm(false);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-sans font-medium transition-colors shadow-sm"
              >
                Delete Object
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
