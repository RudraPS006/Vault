import React from 'react';
import { X, Sliders, Server, Shield, Hash, HardDrive } from 'lucide-react';
import { ClusterHealthSummary } from '../../api/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterHealth: ClusterHealthSummary | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  clusterHealth
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0e111a] border border-white/[0.08] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-white/[0.06] bg-[#0c0f16]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white tracking-wide font-sans">
              Cluster Settings & Runtime Policy
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] flex items-start gap-3">
              <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-zinc-200">Replication Policy</div>
                <div className="text-zinc-400 text-[11px] mt-0.5">
                  Default factor of <code className="font-mono text-cyan-300">3×</code> across independent storage nodes with automatic healing.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] flex items-start gap-3">
              <Hash className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-zinc-200">Cryptographic Checksum Engine</div>
                <div className="text-zinc-400 text-[11px] mt-0.5">
                  Pre-storage and on-demand <code className="font-mono text-cyan-300">SHA-256</code> byte stream hashing for silent corruption prevention.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] flex items-start gap-3">
              <Server className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-zinc-200">Storage Fabric Topology</div>
                <div className="text-zinc-400 text-[11px] mt-0.5">
                  5 autonomous storage targets: <code className="font-mono text-zinc-300">node-a, node-b, node-c, node-d, node-e</code>.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] flex items-start gap-3">
              <HardDrive className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-zinc-200">Persistence Backend</div>
                <div className="text-zinc-400 text-[11px] mt-0.5">
                  Filesystem storage trees with relational metadata catalog via Prisma ORM.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500">
            <span>Cluster Status: {clusterHealth?.status || 'Active'}</span>
            <span>Version: 0.1.0</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 border-t border-white/[0.06] bg-[#0c0f16] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
