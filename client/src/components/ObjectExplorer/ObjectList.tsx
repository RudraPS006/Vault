import React, { useState, useMemo } from "react";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  CopyPlus,
  Loader2,
  Search,
  MoreHorizontal,
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  HardDrive
} from "lucide-react";
import { StoredObject } from "../../api/types";
import { StatusDot } from "../ui/StatusDot";

interface ObjectListProps {
  objects: StoredObject[];
  loading: boolean;
  onViewDetails: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReplicate?: (id: string) => void;
  replicatingId?: string | null;
  onUploadClick?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "recent";
  }
}

type FilterType = "all" | "healthy" | "degraded" | "repairing";

export const ObjectList: React.FC<ObjectListProps> = ({
  objects,
  loading,
  onViewDetails,
  onDownload,
  onDelete,
  onReplicate,
  replicatingId,
  onUploadClick
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StoredObject | null>(null);

  // Filtered objects calculation
  const filteredObjects = useMemo(() => {
    return objects.filter((obj) => {
      // Search match: name or ID
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        obj.name.toLowerCase().includes(query) ||
        obj.id.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const healthyCount =
        obj.healthyReplicaCount !== undefined
          ? obj.healthyReplicaCount
          : obj.replicaCount;
      const isDegraded =
        obj.status === "DEGRADED" || healthyCount < obj.replicationFactor;
      const isRepairing = replicatingId === obj.id;

      if (filter === "healthy") return !isDegraded && !isRepairing;
      if (filter === "degraded") return isDegraded && !isRepairing;
      if (filter === "repairing") return isRepairing;

      return true;
    });
  }, [objects, searchQuery, filter, replicatingId]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Header (Part 11) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by object name or ID..."
            className="w-full bg-[#0a0d14] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl pl-9 pr-4 py-2 text-xs font-sans text-white placeholder-zinc-500 outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs px-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#0a0d14] border border-white/[0.08] p-1 rounded-xl text-xs font-sans self-start sm:self-auto">
          {(
            [
              { id: "all", label: "All" },
              { id: "healthy", label: "Healthy" },
              { id: "degraded", label: "Degraded" },
              { id: "repairing", label: "Repairing" }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === item.id
                  ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table Container */}
      <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0a0d14]/70 shadow-lg">
        {loading && objects.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 animate-pulse font-sans flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Loading object catalog...</span>
          </div>
        ) : objects.length === 0 ? (
          /* Part 10: Empty State */
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white font-sans uppercase tracking-wider">
                OBJECT STORAGE IS EMPTY
              </h3>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                Upload your first object to begin distributing data across the Vault storage fabric.
              </p>
            </div>

            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-sans text-xs font-semibold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload object</span>
              </button>
            )}

            <div className="pt-3 border-t border-white/[0.06] w-full flex flex-col gap-1.5 text-[11px] font-mono text-zinc-500 text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>3× replication across independent storage nodes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>SHA-256 cryptographic integrity verification</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Automatic replica repair on node failure</span>
              </div>
            </div>
          </div>
        ) : filteredObjects.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-zinc-300 font-sans">No matching objects found</p>
            <p className="text-xs text-zinc-500 font-sans">
              No objects match &quot;{searchQuery}&quot; with filter &quot;{filter}&quot;.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilter("all");
              }}
              className="mt-2 text-xs font-mono text-cyan-400 hover:underline"
            >
              Clear search &amp; filters
            </button>
          </div>
        ) : (
          /* Part 3: Premium Infrastructure Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f1320] border-b border-white/[0.08] text-zinc-400 select-none font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">OBJECT</th>
                  <th className="py-3.5 px-3 font-semibold">SIZE</th>
                  <th className="py-3.5 px-3 font-semibold">REPLICATION</th>
                  <th className="py-3.5 px-3 font-semibold">INTEGRITY</th>
                  <th className="py-3.5 px-3 font-semibold">STATUS</th>
                  <th className="py-3.5 px-3 font-semibold">UPDATED</th>
                  <th className="py-3.5 px-4 text-right font-semibold">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredObjects.map((obj) => {
                  const healthyCount =
                    obj.healthyReplicaCount !== undefined
                      ? obj.healthyReplicaCount
                      : obj.replicaCount;
                  const isDegraded =
                    obj.status === "DEGRADED" || healthyCount < obj.replicationFactor;
                  const isCritical = healthyCount <= 1 && obj.replicationFactor > 1;
                  const isReplicating = replicatingId === obj.id;
                  const isMenuOpen = openMenuId === obj.id;

                  return (
                    <tr
                      key={obj.id}
                      onClick={() => onViewDetails(obj.id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      {/* OBJECT (Dominant Name + Monospace ID) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 group-hover:border-cyan-500/40 transition-colors">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white group-hover:text-cyan-300 truncate max-w-xs transition-colors font-sans text-sm">
                                {obj.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-400 text-[10px] font-mono shrink-0">
                                v{obj.version}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-zinc-500 block truncate max-w-[180px]">
                              {obj.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* SIZE */}
                      <td className="py-3.5 px-3 text-zinc-300 font-mono whitespace-nowrap text-xs">
                        {formatBytes(obj.sizeBytes)}
                      </td>

                      {/* REPLICATION */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isCritical
                                ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"
                                : isDegraded
                                ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                                : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                            }`}
                          />
                          <span className="text-white font-medium">
                            {healthyCount} / {obj.replicationFactor}
                          </span>
                          <span
                            className={`text-[11px] ${
                              isCritical
                                ? "text-rose-400"
                                : isDegraded
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {isCritical ? "Critical" : isDegraded ? "Degraded" : "Healthy"}
                          </span>
                        </div>
                      </td>

                      {/* INTEGRITY */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isDegraded ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>⚠ Mismatch</span>
                          </span>
                        ) : healthyCount === 0 ? (
                          <span className="text-[11px] font-sans text-zinc-500">
                            — Unavailable
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>✓ Verified</span>
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isReplicating ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            REPAIRING
                          </span>
                        ) : (
                          <StatusDot
                            status={isDegraded ? "DEGRADED" : "HEALTHY"}
                            size="sm"
                          />
                        )}
                      </td>

                      {/* UPDATED */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-zinc-500 text-[11px] font-sans">
                        {formatTimeAgo(obj.updatedAt || obj.createdAt)}
                      </td>

                      {/* ACTIONS (Part 4) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className="inline-flex items-center gap-1.5 relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Prominent Repair Action if Degraded */}
                          {isDegraded && onReplicate && (
                            <button
                              onClick={() => onReplicate(obj.id)}
                              disabled={isReplicating}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              title="Repair degraded replicas"
                            >
                              {isReplicating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CopyPlus className="w-3 h-3" />
                              )}
                              <span>Repair</span>
                            </button>
                          )}

                          {/* Quick Inspect Button */}
                          <button
                            onClick={() => onViewDetails(obj.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                            title="Inspect Object"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Download Button */}
                          <button
                            onClick={() => onDownload(obj.id, obj.name)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                            title="Download Object"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Secondary Menu Dropdown Toggle */}
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(isMenuOpen ? null : obj.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isMenuOpen
                                  ? "text-white bg-white/[0.1]"
                                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                              }`}
                              title="More Actions"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-full mt-1.5 w-40 rounded-xl bg-[#121624] border border-white/[0.1] shadow-2xl py-1.5 z-30 animate-fade-in text-left"
                                onMouseLeave={() => setOpenMenuId(null)}
                              >
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onViewDetails(obj.id);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Inspect</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onDownload(obj.id, obj.name);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2"
                                >
                                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Download</span>
                                </button>

                                {onReplicate && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onReplicate(obj.id);
                                    }}
                                    disabled={isReplicating}
                                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2"
                                  >
                                    <CopyPlus className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{isDegraded ? "Repair" : "Re-Replicate"}</span>
                                  </button>
                                )}

                                <div className="my-1 border-t border-white/[0.06]" />

                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteCandidate(obj);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Part 4: Delete Confirmation Dialog */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
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
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Object:</span>
                <span className="text-white font-sans font-medium">{deleteCandidate.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Replicas:</span>
                <span className="text-cyan-400">{deleteCandidate.replicaCount} stored copies</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-sans font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteCandidate.id);
                  setDeleteCandidate(null);
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
