import React from 'react';
import { Database, RefreshCw, Activity, ShieldCheck, AlertTriangle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { ApiHealthResponse, ClusterHealthSummary } from '../api/types';

interface HeaderProps {
  clusterHealth: ClusterHealthSummary | null;
  apiHealth: ApiHealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  isOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  clusterHealth,
  apiHealth,
  loading,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  isOnline
}) => {
  const getStatusBadge = () => {
    if (!isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <WifiOff className="w-3.5 h-3.5" />
          DISCONNECTED
        </span>
      );
    }

    if (!clusterHealth) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          CONNECTING...
        </span>
      );
    }

    switch (clusterHealth.status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <ShieldCheck className="w-3.5 h-3.5" />
            CLUSTER HEALTHY
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <AlertTriangle className="w-3.5 h-3.5" />
            CLUSTER DEGRADED
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/25">
            <AlertCircle className="w-3.5 h-3.5" />
            CRITICAL STATE
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="border-b border-[#1c2233] bg-[#0c0f17]/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Branding & Tag */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white font-mono">VAULT</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v{apiHealth?.version || '0.1.0'}
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/60">
                PART 1: FOUNDATION
              </span>
            </div>
            <p className="text-xs text-zinc-400 tracking-wide">Fault-Tolerant Distributed Object Storage</p>
          </div>
        </div>

        {/* Center/Right: Status & Controls */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {getStatusBadge()}

          {/* Auto Refresh Toggle */}
          <button
            onClick={onToggleAutoRefresh}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              autoRefresh
                ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400'
            }`}
            title="Toggle 5s automatic polling"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}`} />
            Auto-sync {autoRefresh ? 'ON' : 'OFF'}
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161c2b] hover:bg-[#1f283d] text-zinc-200 border border-[#27324d] transition-all disabled:opacity-50"
            title="Refresh cluster data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* API Health Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-zinc-400 bg-zinc-900/80 rounded border border-zinc-800">
            <Wifi className={`w-3 h-3 ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span>API: {apiHealth?.status === 'ok' ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
