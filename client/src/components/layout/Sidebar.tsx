import React from 'react';
import {
  Database,
  Layers,
  Shield,
  Activity,
  Sliders,
  FlaskConical,
  BookOpen
} from 'lucide-react';
import { ClusterHealthSummary } from '../../api/types';
import { StatusDot } from '../ui/StatusDot';

export type ActiveTab = 'objects' | 'resilience' | 'activity' | 'walkthrough' | 'failure-lab';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  clusterHealth: ClusterHealthSummary | null;
  onOpenSettings: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  clusterHealth,
  onOpenSettings,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const healthyCount = clusterHealth?.healthyNodes ?? 5;
  const totalNodes = clusterHealth?.totalNodes ?? 5;
  const clusterStatus = clusterHealth?.status || 'HEALTHY';

  const handleNavClick = (tab: ActiveTab) => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (tab: ActiveTab) => {
    const isActive = activeTab === tab;
    return `w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors duration-150 text-left ${
      isActive
        ? 'bg-white/[0.08] text-white'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
    }`;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-60 z-50 bg-[#090b10] border-r border-white/[0.07] flex flex-col justify-between select-none transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Logo & Main Navigation */}
        <div className="flex flex-col">
          {/* Logo / Wordmark */}
          <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold tracking-wider text-white font-sans">
                  VAULT
                </span>
                <span className="text-[10px] text-zinc-500 font-mono tracking-normal">
                  storage
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Groups */}
          <div className="p-3 space-y-6">
            {/* Group 1: OVERVIEW */}
            <div className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-sans">
                Overview
              </div>
              <button
                onClick={() => handleNavClick('objects')}
                className={navItemClass('objects')}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Objects</span>
              </button>
              <button
                onClick={() => handleNavClick('resilience')}
                className={navItemClass('resilience')}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>Resilience</span>
              </button>
              <button
                onClick={() => handleNavClick('activity')}
                className={navItemClass('activity')}
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>Activity</span>
              </button>
            </div>

            {/* Subtle Divider */}
            <div className="border-t border-white/[0.06] mx-2" />

            {/* Group 2: TOOLS */}
            <div className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-sans">
                Tools
              </div>
              <button
                onClick={() => handleNavClick('walkthrough')}
                className={navItemClass('walkthrough')}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Walkthrough</span>
              </button>
              <button
                onClick={() => handleNavClick('failure-lab')}
                className={navItemClass('failure-lab')}
              >
                <FlaskConical className="w-4 h-4 shrink-0" />
                <span>Failure Lab</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Cluster Status & Settings */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          {/* Cluster Status Widget */}
          <div className="px-3 py-2 rounded-md bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans">
                Cluster Fabric
              </span>
              <span className="text-xs font-medium text-zinc-200 mt-0.5">
                {healthyCount}/{totalNodes} Nodes
              </span>
            </div>
            <StatusDot status={clusterStatus} showLabel={false} size="sm" />
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors duration-150 text-left"
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
};
