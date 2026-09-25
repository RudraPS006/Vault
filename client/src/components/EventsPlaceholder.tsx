import React from 'react';
import { Terminal, Activity, Info, ShieldAlert, CheckCircle2, AlertOctagon, RefreshCw, Wrench, ShieldCheck, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import { SystemEvent } from '../api/types';

interface EventsPlaceholderProps {
  events: SystemEvent[];
  loading: boolean;
}

export const EventsPlaceholder: React.FC<EventsPlaceholderProps> = ({ events, loading }) => {
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'REPLICA_CORRUPTED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-2.5 h-2.5" />
            REPLICA_CORRUPTED
          </span>
        );
      case 'REPLICA_RECONCILED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <RefreshCw className="w-2.5 h-2.5" />
            REPLICA_RECONCILED
          </span>
        );
      case 'REPLICA_REMOVED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-500/15 text-zinc-300 border border-zinc-500/30">
            <Trash2 className="w-2.5 h-2.5" />
            REPLICA_REMOVED
          </span>
        );
      case 'NODE_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertOctagon className="w-2.5 h-2.5" />
            NODE_FAILED
          </span>
        );
      case 'NODE_RECOVERED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <RefreshCw className="w-2.5 h-2.5" />
            NODE_RECOVERED
          </span>
        );
      case 'REPAIR_STARTED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Wrench className="w-2.5 h-2.5" />
            REPAIR_STARTED
          </span>
        );
      case 'REPLICA_REPAIRED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Wrench className="w-2.5 h-2.5" />
            REPLICA_REPAIRED
          </span>
        );
      case 'REPAIR_COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-2.5 h-2.5" />
            REPAIR_COMPLETED
          </span>
        );
      case 'REPAIR_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-2.5 h-2.5" />
            REPAIR_FAILED
          </span>
        );
      case 'NODE_INITIALIZED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            INIT
          </span>
        );
      case 'CLUSTER_BOOTSTRAP':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-2.5 h-2.5" />
            BOOTSTRAP
          </span>
        );
      case 'REPLICATION_WARN':
      case 'HEARTBEAT_TIMEOUT':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-2.5 h-2.5" />
            WARN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Info className="w-2.5 h-2.5" />
            {type}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0e111a] border border-[#1c2233] rounded-lg p-5">
      <div className="flex items-center justify-between pb-3 border-b border-[#1c2233]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
            Cluster Audit & Event Log
          </h2>
        </div>
        <span className="text-xs font-mono text-zinc-400">
          Foundation Stream
        </span>
      </div>

      <div className="mt-3">
        {loading && events.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-zinc-400 animate-pulse">
            Loading cluster activity stream...
          </div>
        ) : events.length === 0 ? (
          <div className="py-6 px-4 bg-[#121521] border border-[#1c2233] rounded text-center">
            <p className="text-xs font-mono text-zinc-400">
              No audit events recorded yet.
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Events will record node state changes, replica syncs, and fault simulations in subsequent parts.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start justify-between p-2.5 rounded bg-[#121521] border border-[#1c2233] hover:border-zinc-700 transition-colors text-xs font-mono"
              >
                <div className="flex items-center gap-2.5">
                  {getEventBadge(evt.type)}
                  <span className="text-zinc-200">{evt.message}</span>
                </div>
                <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-3">
                  {new Date(evt.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>Event Engine: Active</span>
        <span>Storage: SQLite (`Event` table)</span>
      </div>
    </div>
  );
};
