import React from 'react';
import { StorageNode } from '../api/types';
import { NodeCard } from './NodeCard';
import { Server } from 'lucide-react';

interface NodeGridProps {
  nodes: StorageNode[];
  loading: boolean;
  onFailNode?: (id: string, name: string) => Promise<void>;
  onRecoverNode?: (id: string, name: string) => Promise<void>;
  actionNodeId?: string | null;
}

export const NodeGrid: React.FC<NodeGridProps> = ({
  nodes,
  loading,
  onFailNode,
  onRecoverNode,
  actionNodeId
}) => {
  const healthyCount = nodes.filter((n) => n.status === 'HEALTHY').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide font-sans">
            Storage Fabric ({nodes.length} Nodes)
          </h2>
        </div>
        <span className="text-xs text-zinc-400 font-sans">
          {healthyCount}/{nodes.length} Online • Independent Storage Volumes
        </span>
      </div>

      {nodes.length === 0 && loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-[#0d0f15] border border-white/[0.08] rounded-lg p-4 h-40 animate-pulse flex flex-col justify-between"
            >
              <div className="flex justify-between">
                <div className="w-20 h-4 bg-zinc-800 rounded"></div>
                <div className="w-16 h-4 bg-zinc-800 rounded"></div>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded"></div>
              <div className="w-28 h-3 bg-zinc-800 rounded"></div>
            </div>
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-[#0d0f15] border border-white/[0.08] rounded-lg p-8 text-center">
          <Server className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-300 font-sans">No storage nodes registered</p>
          <p className="text-xs text-zinc-500 mt-1">
            Ensure backend server is running and storage directory is initialized.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onFailNode={onFailNode}
              onRecoverNode={onRecoverNode}
              actionLoading={actionNodeId === node.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

