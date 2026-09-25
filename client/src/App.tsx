import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { vaultApi } from './api/client';
import { StorageNode, ClusterHealthSummary, SystemEvent, StoredObject } from './api/types';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { SettingsModal } from './components/layout/SettingsModal';
import { Hero } from './components/hero/Hero';
import { ObjectExplorer } from './components/ObjectExplorer';
import { ResilienceView } from './components/views/ResilienceView';
import { ActivityView } from './components/views/ActivityView';
import { FailureLabView } from './components/views/FailureLabView';
import { WalkthroughView } from './components/views/WalkthroughView';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('objects');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const [nodes, setNodes] = useState<StorageNode[]>([]);
  const [clusterHealth, setClusterHealth] = useState<ClusterHealthSummary | null>(null);
  const [objects, setObjects] = useState<StoredObject[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [actionNodeId, setActionNodeId] = useState<string | null>(null);

  // Compute set of node names that currently have active un-repaired corrupted replicas
  const corruptedNodes = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      if (ev.type === 'REPLICA_CORRUPTED' && ev.nodeId) {
        const isRepaired = events.some(
          (e) =>
            e.type === 'REPLICA_REPAIRED' &&
            new Date(e.createdAt) > new Date(ev.createdAt) &&
            (e.objectId === ev.objectId || e.nodeId === ev.nodeId)
        );
        if (!isRepaired) {
          set.add(ev.nodeId.toLowerCase());
        }
      }
    }
    return set;
  }, [events]);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);

    try {
      const [, nodesRes, clusterRes, eventsRes, objectsRes] = await Promise.all([
        vaultApi.getHealth(),
        vaultApi.getNodes(),
        vaultApi.getClusterHealth(),
        vaultApi.getRecentEvents(50),
        vaultApi.listObjects()
      ]);

      setNodes(nodesRes);
      setClusterHealth(clusterRes);
      setEvents(eventsRes);
      setObjects(objectsRes);
    } catch (err: unknown) {
      console.error('Failed to fetch cluster metrics:', err);
      const msg = err instanceof Error ? err.message : 'Failed to communicate with Vault API';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFailNode = async (id: string, name: string) => {
    setActionNodeId(id);
    try {
      await vaultApi.failNode(id);
      await fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to simulate failure for ${name}`;
      alert(`Failure simulation error: ${msg}`);
    } finally {
      setActionNodeId(null);
    }
  };

  const handleRecoverNode = async (id: string, name: string) => {
    setActionNodeId(id);
    try {
      await vaultApi.recoverNode(id);
      await fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to recover ${name}`;
      alert(`Node recovery error: ${msg}`);
    } finally {
      setActionNodeId(null);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Periodic polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 flex font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* 1. Persistent Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        clusterHealth={clusterHealth}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Top Header */}
        <TopHeader
          activeTab={activeTab}
          clusterHealth={clusterHealth}
          loading={loading}
          onRefresh={() => fetchData(false)}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Main Work Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-4 flex items-start justify-between gap-3 text-rose-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold font-sans">Backend Communication Disrupted</h4>
                  <p className="text-xs text-rose-300/80 mt-0.5 font-sans">{error}</p>
                  <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                    Ensure the Vault server is running on port 4000 (<code className="text-rose-300">npm run dev:server</code>).
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchData(true)}
                className="px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-sans font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {/* Tab 1: Objects View with Cinematic Hero */}
          {activeTab === 'objects' && (
            <div className="space-y-8">
              <Hero
                nodes={nodes}
                objects={objects}
                clusterHealth={clusterHealth}
                corruptedNodes={corruptedNodes}
                isRepairing={false}
                loading={loading}
                onUploadClick={() => {
                  const el = document.getElementById('upload-zone');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                onRunWalkthrough={() => setActiveTab('walkthrough')}
              />
              <div id="upload-zone">
                <ObjectExplorer
                  onClusterStateChange={() => fetchData(false)}
                  clusterHealth={clusterHealth}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Resilience View */}
          {activeTab === 'resilience' && (
            <ResilienceView
              nodes={nodes}
              objects={objects}
              clusterHealth={clusterHealth}
              loading={loading}
              onFailNode={handleFailNode}
              onRecoverNode={handleRecoverNode}
              actionNodeId={actionNodeId}
              events={events}
              corruptedNodes={corruptedNodes}
            />
          )}

          {/* Tab 3: Activity Timeline View */}
          {activeTab === 'activity' && (
            <ActivityView
              events={events}
              loading={loading}
              onRefresh={() => fetchData(false)}
            />
          )}

          {/* Tab 4: Walkthrough Guide View */}
          {activeTab === 'walkthrough' && (
            <WalkthroughView
              nodes={nodes}
              objects={objects}
              clusterHealth={clusterHealth}
              corruptedNodes={corruptedNodes}
              loading={loading}
              onFailNode={handleFailNode}
              onRecoverNode={handleRecoverNode}
              onClusterStateChange={() => fetchData(false)}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {/* Tab 5: Failure & Corruption Lab */}
          {activeTab === 'failure-lab' && (
            <FailureLabView
              nodes={nodes}
              objects={objects}
              events={events}
              onFailNode={handleFailNode}
              onRecoverNode={handleRecoverNode}
              actionNodeId={actionNodeId}
              onClusterStateChange={() => fetchData(false)}
              onNavigateToObjects={() => setActiveTab('objects')}
            />
          )}
        </main>
      </div>

      {/* Settings & Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        clusterHealth={clusterHealth}
      />
    </div>
  );
};

export default App;
