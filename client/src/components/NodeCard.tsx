import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { StorageNode } from '../api/types';
import { StatusDot } from './ui/StatusDot';

interface NodeCardProps {
  node: StorageNode;
  onFailNode?: (id: string, name: string) => Promise<void>;
  onRecoverNode?: (id: string, name: string) => Promise<void>;
  actionLoading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return '2s ago';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  } catch {
    return 'recent';
  }
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onFailNode,
  onRecoverNode,
  actionLoading = false
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isFailed = node.status === 'FAILED';
  const isHealthy = node.status === 'HEALTHY';

  const usedBytes = node.usedCapacityBytes || Number(node.usedCapacity);
  const totalBytes = node.capacityBytes || Number(node.capacity);
  const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  const handleConfirmFail = async () => {
    setShowConfirmModal(false);
    if (onFailNode) {
      await onFailNode(node.id, node.name);
    }
  };

  const handleRecover = async () => {
    if (onRecoverNode) {
      await onRecoverNode(node.id, node.name);
    }
  };

  return (
    <>
      <div
        className={`rounded-lg border p-4 transition-all duration-150 flex flex-col justify-between ${
          isFailed
            ? 'bg-rose-950/[0.08] border-rose-500/30'
            : 'bg-[#0d0f15] border-white/[0.08] hover:border-white/[0.14]'
        }`}
      >
        {/* Top: Node identifier & Status */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-100 font-sans">
                {node.name.replace('-', ' ')}
              </div>
              <div className="mt-1">
                <StatusDot
                  status={isFailed ? 'FAILED' : isHealthy ? 'HEALTHY' : node.status}
                  size="sm"
                />
              </div>
            </div>

            {/* Quick action button */}
            <div>
              {isHealthy && onFailNode && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={actionLoading}
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors disabled:opacity-50"
                  title={`Simulate failure of ${node.name}`}
                >
                  Fail
                </button>
              )}
              {isFailed && onRecoverNode && (
                <button
                  onClick={handleRecover}
                  disabled={actionLoading}
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                  title={`Recover ${node.name}`}
                >
                  {actionLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                  <span>Recover</span>
                </button>
              )}
            </div>
          </div>

          {/* Metrics breakdown */}
          <div className="space-y-2 text-xs font-sans pt-1">
            {/* Capacity */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Capacity</span>
                <span className="font-mono text-zinc-300">
                  {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
                </span>
              </div>
              <div className="w-full bg-white/[0.06] h-1 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isFailed ? 'bg-rose-500' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.max(percent, isFailed ? 100 : 2)}%` }}
                />
              </div>
            </div>

            {/* Footer metrics: Last heartbeat & online state */}
            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
              <span>Heartbeat</span>
              <span className="font-mono text-zinc-400">
                {isFailed ? 'Disconnected' : formatTimeAgo(node.lastHeartbeat)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Node Failure */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#10131d] border border-rose-500/30 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-white tracking-wide font-sans">
                Simulate failure of {node.name}?
              </h3>
            </div>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              This will intentionally mark the storage node as offline, isolating its replicas and testing Vault&apos;s automatic healing and replica repair.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFail}
                className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                Fail Node
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
