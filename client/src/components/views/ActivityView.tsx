import React, { useState, useMemo } from 'react';
import { SystemEvent } from '../../api/types';
import {
  Activity,
  UploadCloud,
  CopyPlus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  HardDrive,
  Cpu
} from 'lucide-react';

interface ActivityViewProps {
  events: SystemEvent[];
  loading: boolean;
  onRefresh?: () => void;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'recent';
  }
}

export const ActivityView: React.FC<ActivityViewProps> = ({ events, loading, onRefresh }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'OBJECT_INGESTED':
        return {
          icon: <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />,
          label: 'INGESTED',
          style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        };
      case 'OBJECT_REPLICATED':
        return {
          icon: <CopyPlus className="w-3.5 h-3.5 text-blue-400" />,
          label: 'REPLICATED',
          style: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        };
      case 'OBJECT_DELETED':
        return {
          icon: <Trash2 className="w-3.5 h-3.5 text-zinc-400" />,
          label: 'DELETED',
          style: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
        };
      case 'NODE_FAILED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
          label: 'NODE OFFLINE',
          style: 'bg-rose-500/10 text-rose-400 border-rose-500/25'
        };
      case 'NODE_RECOVERED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'NODE RECOVERED',
          style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
        };
      case 'REPLICA_CORRUPTED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
          label: 'CORRUPTION DETECTED',
          style: 'bg-rose-500/10 text-rose-400 border-rose-500/25'
        };
      case 'REPLICA_REPAIRED':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'REPAIRED',
          style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
        };
      case 'REPLICA_REMOVED':
        return {
          icon: <HardDrive className="w-3.5 h-3.5 text-purple-400" />,
          label: 'REPLICA PRUNED',
          style: 'bg-purple-500/10 text-purple-400 border-purple-500/25'
        };
      case 'REPLICA_RECONCILED':
        return {
          icon: <Cpu className="w-3.5 h-3.5 text-teal-400" />,
          label: 'RECONCILED',
          style: 'bg-teal-500/10 text-teal-400 border-teal-500/25'
        };
      default:
        return {
          icon: <Activity className="w-3.5 h-3.5 text-zinc-400" />,
          label: type.replace('_', ' '),
          style: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
        };
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (filterType === 'OBJECTS' && !ev.type.startsWith('OBJECT_')) return false;
      if (filterType === 'RESILIENCE' && !['NODE_FAILED', 'NODE_RECOVERED', 'REPLICA_REPAIRED', 'REPLICA_REMOVED', 'REPLICA_RECONCILED'].includes(ev.type)) return false;
      if (filterType === 'FAILURES' && !['NODE_FAILED', 'REPLICA_CORRUPTED', 'REPLICA_REPAIR_FAILED'].includes(ev.type)) return false;

      // Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesMsg = ev.message.toLowerCase().includes(query);
        const matchesType = ev.type.toLowerCase().includes(query);
        const matchesNode = ev.nodeId ? ev.nodeId.toLowerCase().includes(query) : false;
        const matchesObj = ev.objectId ? ev.objectId.toLowerCase().includes(query) : false;
        if (!matchesMsg && !matchesType && !matchesNode && !matchesObj) return false;
      }

      return true;
    });
  }, [events, filterType, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Controls: Filter Pills & Search */}
      <div className="p-4 rounded-lg border border-white/[0.08] bg-[#0d0f15] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1 shrink-0" />
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'OBJECTS', label: 'Objects' },
            { id: 'RESILIENCE', label: 'Resilience' },
            { id: 'FAILURES', label: 'Failures & Corruptions' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/[0.08] rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
      </div>

      {/* Events Timeline Container */}
      <div className="rounded-lg border border-white/[0.08] bg-[#0d0f15] overflow-hidden">
        <div className="py-3 px-4 border-b border-white/[0.06] bg-[#10131d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
              System Audit Timeline ({filteredEvents.length})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500 font-sans hidden sm:inline">
              Immutable cluster operations log
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-zinc-400 hover:text-cyan-400 p-1 rounded transition-colors"
                title="Refresh Activity"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 animate-pulse font-sans">
            Loading cluster activity stream...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <Activity className="w-8 h-8 text-zinc-600 mb-1" />
            <p className="text-sm text-zinc-300 font-sans font-medium">No activity recorded</p>
            <p className="text-xs text-zinc-500 max-w-sm font-sans">
              {searchQuery || filterType !== 'ALL'
                ? 'No events match your current filter criteria.'
                : 'Upload objects or simulate node operations to observe live events.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredEvents.map((ev) => {
              const badge = getEventBadge(ev.type);

              return (
                <div
                  key={ev.id}
                  className="p-4 hover:bg-white/[0.02] transition-colors flex items-start justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Event Icon */}
                    <div className="w-7 h-7 rounded bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                      {badge.icon}
                    </div>

                    {/* Details */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium border ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                        {ev.nodeId && (
                          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/20 px-1.5 py-0.2 rounded border border-cyan-800/30">
                            {ev.nodeId}
                          </span>
                        )}
                        {ev.objectId && (
                          <span className="text-[11px] font-mono text-zinc-400 bg-white/[0.03] px-1.5 py-0.2 rounded border border-white/[0.06]">
                            {ev.objectId.slice(0, 8)}...
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                        {ev.message}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0">
                    <span
                      className="text-[11px] text-zinc-500 font-sans group-hover:text-zinc-400 transition-colors"
                      title={new Date(ev.createdAt).toLocaleString()}
                    >
                      {formatTimeAgo(ev.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
