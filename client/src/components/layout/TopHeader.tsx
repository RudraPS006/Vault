import React from 'react';
import { RefreshCw, Menu } from 'lucide-react';
import { ClusterHealthSummary } from '../../api/types';
import { StatusDot } from '../ui/StatusDot';
import { ActiveTab } from './Sidebar';

interface TopHeaderProps {
  activeTab: ActiveTab;
  clusterHealth: ClusterHealthSummary | null;
  loading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onOpenMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  clusterHealth,
  loading,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  onOpenMobileMenu
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'objects':
        return {
          breadcrumb: 'Overview / Objects',
          title: 'Objects',
          subtitle: 'Distributed object store with 3× replication and SHA-256 integrity'
        };
      case 'resilience':
        return {
          breadcrumb: 'Overview / Resilience',
          title: 'Cluster Resilience',
          subtitle: 'Storage fabric status, node topology, and fault tolerance'
        };
      case 'activity':
        return {
          breadcrumb: 'Overview / Activity',
          title: 'System Activity',
          subtitle: 'Audit timeline of storage mutations, replica repairs, and health events'
        };
      case 'walkthrough':
        return {
          breadcrumb: 'Tools / Walkthrough',
          title: 'Architecture Walkthrough',
          subtitle: 'Interactive operational guide to Vault fault tolerance and recovery'
        };
      case 'failure-lab':
        return {
          breadcrumb: 'Tools / Failure Lab',
          title: 'Failure Lab',
          subtitle: 'Simulate node outages, physical byte corruption, and automated self-healing'
        };
    }
  };

  const { breadcrumb, title } = getTabTitle();
  const clusterStatus = clusterHealth?.status || 'HEALTHY';

  return (
    <header className="h-16 border-b border-white/[0.07] bg-[#090b10]/95 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.05]"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <div className="text-[11px] font-medium text-zinc-500 tracking-wide font-sans">
            {breadcrumb}
          </div>
          <h1 className="text-sm font-semibold text-white font-sans tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Live System Status & Refresh Control */}
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <StatusDot
            status={clusterStatus}
            label={clusterStatus === 'HEALTHY' ? 'System Healthy' : `System ${clusterStatus.toLowerCase()}`}
            size="sm"
          />
        </div>

        {/* Auto-Sync Toggle */}
        <button
          onClick={onToggleAutoRefresh}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors"
          title="Toggle 5s live polling"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              autoRefresh ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span>Auto-sync</span>
        </button>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-all disabled:opacity-50"
          title="Refresh cluster state"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              loading ? 'animate-spin text-cyan-400' : 'text-zinc-400'
            }`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
};
