import React, { useState, useEffect, useCallback, useRef } from "react";
import { vaultApi } from "../../api/client";
import { StoredObject, StoredObjectDetail, ClusterHealthSummary } from "../../api/types";
import { computeIntegrityStatus } from "../../utils/integrity";
import { ObjectUploadZone } from "./ObjectUploadZone";
import { ObjectList } from "./ObjectList";
import { ObjectDetailsModal } from "./ObjectDetailsModal";
import { UploadCloud, ShieldCheck, Database, Layers, ChevronDown, ChevronUp } from "lucide-react";

interface ObjectExplorerProps {
  onClusterStateChange: () => void;
  clusterHealth?: ClusterHealthSummary | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const ObjectExplorer: React.FC<ObjectExplorerProps> = ({
  onClusterStateChange,
  clusterHealth: propClusterHealth
}) => {
  const [objects, setObjects] = useState<StoredObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectDetail, setSelectedObjectDetail] = useState<StoredObjectDetail | null>(null);
  const [replicatingId, setReplicatingId] = useState<string | null>(null);
  const [internalHealth, setInternalHealth] = useState<ClusterHealthSummary | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const uploadZoneRef = useRef<HTMLDivElement>(null);

  const clusterHealth = propClusterHealth || internalHealth;

  const fetchObjects = useCallback(async () => {
    try {
      setLoading(true);
      const [objs, health] = await Promise.all([
        vaultApi.listObjects(),
        vaultApi.getClusterHealth().catch(() => null)
      ]);
      setObjects(objs);
      if (health) setInternalHealth(health);
    } catch (err) {
      console.error("Failed to load objects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  const handleUploadSuccess = () => {
    fetchObjects();
    onClusterStateChange();
  };

  const handleViewDetails = async (id: string) => {
    setSelectedObjectId(id);
    try {
      const detail = await vaultApi.getObject(id);
      setSelectedObjectDetail(detail);
    } catch (err) {
      console.error("Failed to get object detail:", err);
    }
  };

  const handleDownload = async (id: string, name: string) => {
    try {
      await vaultApi.downloadObject(id, name);
    } catch (err) {
      alert(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vaultApi.deleteObject(id);
      fetchObjects();
      onClusterStateChange();
      if (selectedObjectId === id) {
        setSelectedObjectId(null);
        setSelectedObjectDetail(null);
      }
    } catch (err) {
      alert(`Deletion failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleReplicate = async (id: string) => {
    try {
      setReplicatingId(id);
      await vaultApi.repairObject(id);
      await fetchObjects();
      onClusterStateChange();
      if (selectedObjectId === id) {
        const refreshed = await vaultApi.getObject(id);
        setSelectedObjectDetail(refreshed);
      }
    } catch (err) {
      alert(`Repair/Replication failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setReplicatingId(null);
    }
  };

  const handleCorruptReplica = async (objectId: string, nodeName: string) => {
    try {
      await vaultApi.corruptReplica(objectId, nodeName);
      await fetchObjects();
      onClusterStateChange();
      if (selectedObjectId === objectId) {
        const refreshed = await vaultApi.getObject(objectId);
        setSelectedObjectDetail(refreshed);
      }
    } catch (err) {
      alert(`Corruption simulation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Metrics computation for Part 1
  const totalStorageBytes = objects.reduce(
    (sum, obj) => sum + (obj.sizeBytes || Number(obj.size) || 0),
    0
  );

  const totalReplicasCount = objects.reduce(
    (sum, obj) => sum + (obj.replicaCount || 0),
    0
  );

  const integrity = computeIntegrityStatus(objects, clusterHealth);

  const scrollToUpload = () => {
    setIsUploadOpen(true);
    setTimeout(() => {
      uploadZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  return (
    <section className="bg-[#08090d] border border-white/[0.08] rounded-2xl p-6 sm:p-7 space-y-7 shadow-2xl">
      {/* Page Header (Part 1) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-cyan-400">
              OBJECTS
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white font-sans tracking-tight">
            Manage objects across the Vault storage fabric.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-sans">
            Upload, inspect, replicate and verify distributed objects.
          </p>
        </div>

        {/* Right-side Action: [ Upload object ] */}
        <button
          onClick={scrollToUpload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-semibold font-sans transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] shrink-0 active:scale-95"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload object</span>
        </button>
      </div>

      {/* Top Compact Summary Strip (Part 1) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: OBJECTS */}
        <div className="bg-[#0f1320] border border-white/[0.06] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-mono uppercase tracking-wider">OBJECTS</span>
            <Database className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            {objects.length}
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block">
            Ingested into fabric
          </span>
        </div>

        {/* Metric 2: STORAGE */}
        <div className="bg-[#0f1320] border border-white/[0.06] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-mono uppercase tracking-wider">STORAGE</span>
            <span className="text-[10px] font-mono text-zinc-500">RAW</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            {formatBytes(totalStorageBytes)}
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block">
            Total unique dataset
          </span>
        </div>

        {/* Metric 3: REPLICAS */}
        <div className="bg-[#0f1320] border border-white/[0.06] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-mono uppercase tracking-wider">REPLICAS</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            {totalReplicasCount}
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block">
            Distributed copies
          </span>
        </div>

        {/* Metric 4: INTEGRITY (Dynamic) */}
        <div className="bg-[#0f1320] border border-white/[0.06] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-mono uppercase tracking-wider">INTEGRITY</span>
            <ShieldCheck className={`w-3.5 h-3.5 ${integrity.colorClass}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-mono font-bold ${integrity.colorClass}`}>
            {integrity.displayValue}
          </div>
          <span className="text-[10px] text-zinc-400 font-sans flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                integrity.isDegraded ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            {integrity.statusLabel}
          </span>
        </div>
      </div>

      {/* Part 2: Upload Experience (Collapsible / Focused) */}
      <div ref={uploadZoneRef} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-zinc-400 tracking-wider font-mono font-semibold">
            OBJECT INGESTION
          </span>
          <button
            onClick={() => setIsUploadOpen(!isUploadOpen)}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <span>{isUploadOpen ? "Collapse Dropzone" : "Expand Dropzone"}</span>
            {isUploadOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isUploadOpen && <ObjectUploadZone onUploadSuccess={handleUploadSuccess} />}
      </div>

      {/* Part 3 & 4: Object Catalog Table with Search, Filter & Actions */}
      <div className="space-y-2">
        <span className="text-xs uppercase text-zinc-400 tracking-wider font-mono font-semibold">
          DISTRIBUTED CATALOG
        </span>
        <ObjectList
          objects={objects}
          loading={loading}
          onViewDetails={handleViewDetails}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onReplicate={handleReplicate}
          replicatingId={replicatingId}
          onUploadClick={scrollToUpload}
        />
      </div>

      {/* Part 5: Detailed Object Modal */}
      {selectedObjectId && (
        <ObjectDetailsModal
          object={selectedObjectDetail}
          onClose={() => {
            setSelectedObjectId(null);
            setSelectedObjectDetail(null);
          }}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onReplicate={handleReplicate}
          onCorruptReplica={handleCorruptReplica}
          isReplicating={replicatingId === selectedObjectId}
        />
      )}
    </section>
  );
};
