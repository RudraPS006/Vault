import React, { useState, useRef } from "react";
import { UploadCloud, AlertCircle, CheckCircle2, ArrowUp, ShieldCheck, Layers } from "lucide-react";
import { vaultApi } from "../../api/client";
import { StoredObjectDetail } from "../../api/types";

interface ObjectUploadZoneProps {
  onUploadSuccess: (object: StoredObjectDetail) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const ObjectUploadZone: React.FC<ObjectUploadZoneProps> = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState<{ name: string; size: number } | null>(null);
  const [storedObject, setStoredObject] = useState<StoredObjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (file.size === 0) {
      setError("Cannot upload an empty file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("File size exceeds 100 MB limit");
      return;
    }

    setError(null);
    setStoredObject(null);
    setCurrentFile({ name: file.name, size: file.size });
    setUploading(true);

    try {
      const stored = await vaultApi.uploadObject(file);
      setStoredObject(stored);
      onUploadSuccess(stored);
      setTimeout(() => {
        setStoredObject(null);
        setCurrentFile(null);
      }, 5000);
    } catch (err: unknown) {
      console.error("Upload failed:", err);
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      setCurrentFile(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileSelect}
        className="hidden"
      />

      {uploading && currentFile ? (
        /* Uploading Ingest State */
        <div className="border border-cyan-500/30 bg-[#0c101a] rounded-xl p-6 text-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-cyan-500/5 animate-pulse" />
          <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
              UPLOADING
            </span>

            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-white font-sans truncate max-w-md">
                {currentFile.name}
              </h4>
              <p className="text-xs font-mono text-zinc-400">
                {formatBytes(currentFile.size)}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-sm h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-pulse w-3/4" />
            </div>

            <p className="text-xs font-mono text-cyan-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              Computing SHA-256 · Writing to primary storage node
            </p>
          </div>
        </div>
      ) : storedObject ? (
        /* Object Stored Complete State */
        <div className="border border-emerald-500/30 bg-emerald-950/15 rounded-xl p-5 text-center shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400">
                  OBJECT STORED
                </span>
                <span className="text-xs text-zinc-500">•</span>
                <span className="text-xs font-semibold text-white font-sans">
                  {storedObject.name}
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                SHA-256 verified · 1 / {storedObject.replicationFactor || 3} replicas online (auto-replicating to fabric)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStoredObject(null);
              fileInputRef.current?.click();
            }}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-sans font-medium transition-colors shrink-0"
          >
            Upload Another
          </button>
        </div>
      ) : (
        /* Default Dropzone */
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200 group ${
            isDragging
              ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_24px_rgba(6,182,212,0.12)]"
              : "border-white/[0.12] bg-[#0a0d14]/70 hover:border-cyan-500/50 hover:bg-white/[0.02]"
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isDragging
                  ? "bg-cyan-500/20 text-cyan-300 scale-110 shadow-lg"
                  : "bg-white/[0.04] border border-white/[0.08] text-cyan-400 group-hover:scale-105 group-hover:border-cyan-500/30"
              }`}
            >
              {isDragging ? (
                <ArrowUp className="w-5 h-5 animate-bounce" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>

            <div className="space-y-0.5">
              <p className="text-sm font-medium text-zinc-200 font-sans group-hover:text-white transition-colors">
                Drop an object here or choose a file
              </p>
              <p className="text-xs text-zinc-500 font-sans">
                Up to 100 MB
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/[0.03] border border-white/[0.06] text-zinc-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                SHA-256
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" />
                3× replication
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-zinc-500 hover:text-white text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
