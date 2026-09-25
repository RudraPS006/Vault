import React from "react";
import { ObjectReplica, StoredObjectDetail } from "../../api/types";
import { HardDrive, CheckCircle2, AlertTriangle, XCircle, FileText, ShieldCheck } from "lucide-react";

interface ObjectReplicaMapProps {
  object: StoredObjectDetail;
}

export const ObjectReplicaMap: React.FC<ObjectReplicaMapProps> = ({ object }) => {
  const replicas = object.replicas || [];
  const healthyCount =
    typeof object.healthyReplicaCount === "number"
      ? object.healthyReplicaCount
      : replicas.filter((r) => r.status === "HEALTHY").length;

  return (
    <div className="bg-[#0b0e17] border border-white/[0.08] rounded-xl p-5 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Top Object Node */}
        <div className="flex flex-col items-center">
          <div className="bg-[#121726] border border-cyan-500/30 rounded-xl px-5 py-3 shadow-lg flex items-center gap-3.5 max-w-md w-full justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-cyan-400">
                    OBJECT
                  </span>
                  <span className="text-zinc-600 text-xs">•</span>
                  <span className="text-xs font-mono text-zinc-400">v{object.version}</span>
                </div>
                <h4 className="text-sm font-semibold text-white font-sans truncate">
                  {object.name}
                </h4>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                SHA-256
              </span>
            </div>
          </div>

          {/* SVG Connector Branch */}
          <div className="w-full flex justify-center py-2">
            <div className="flex flex-col items-center">
              <div className="w-px h-5 bg-gradient-to-b from-cyan-500/50 to-cyan-500/20" />
              <div className="w-2 h-2 rounded-full bg-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <div className="w-px h-3 bg-cyan-500/20" />
            </div>
          </div>
        </div>

        {/* Replica Nodes Distribution Grid */}
        <div>
          <div className="text-center mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              PHYSICAL REPLICAS ({healthyCount}/{object.replicationFactor} ONLINE)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {replicas.map((replica: ObjectReplica) => {
              const isCorrupted = replica.status === "CORRUPTED";
              const isUnavailable =
                replica.status === "UNAVAILABLE" || replica.status === "FAILED";

              return (
                <div
                  key={replica.id}
                  className={`rounded-xl p-4 transition-all duration-200 border flex flex-col justify-between ${
                    isCorrupted
                      ? "bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.12)]"
                      : isUnavailable
                      ? "bg-zinc-900/40 border-rose-800/30 text-zinc-400"
                      : "bg-[#111522] border-emerald-500/30 hover:border-emerald-500/50 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isCorrupted
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : isUnavailable
                            ? "bg-zinc-800 text-zinc-500"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-white font-sans uppercase tracking-wider">
                          {replica.nodeName}
                        </h5>
                        <span className="text-[10px] font-mono text-zinc-500 block truncate max-w-[120px]">
                          v{replica.version}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isCorrupted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          MISMATCH
                        </span>
                      ) : isUnavailable ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          OFFLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          VALID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Replica Integrity & Path Footer */}
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-zinc-500">Integrity:</span>
                      {isCorrupted ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          ⚠ SHA-256 MISMATCH
                        </span>
                      ) : isUnavailable ? (
                        <span className="text-zinc-500">Node Offline</span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          ✓ SHA-256 MATCH
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] font-mono text-zinc-500 truncate" title={`storage/${replica.nodeName}/${object.id}.blob`}>
                      storage/{replica.nodeName}/{object.id.slice(0, 8)}...blob
                    </div>
                  </div>
                </div>
              );
            })}

            {/* If replicas count is less than replicationFactor, show missing slots */}
            {Array.from({ length: Math.max(0, object.replicationFactor - replicas.length) }).map((_, idx) => (
              <div
                key={`missing-${idx}`}
                className="rounded-xl p-4 border border-dashed border-amber-500/30 bg-amber-950/10 flex flex-col justify-center items-center text-center space-y-1.5"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-mono text-amber-300 font-semibold">
                  Missing Replica #{replicas.length + idx + 1}
                </span>
                <span className="text-[10px] font-sans text-zinc-500">
                  Awaiting replication / repair
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
