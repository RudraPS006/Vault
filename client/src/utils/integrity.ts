import { ClusterHealthSummary, StoredObject } from '../api/types';

export interface IntegrityStatus {
  displayValue: string; // "100%", "2 / 3", or "Degraded"
  statusLabel: string;  // "Verified", "Integrity Degraded", "Node Offline"
  colorClass: string;   // "text-emerald-400", "text-amber-400", "text-rose-400"
  badgeClass: string;   // "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
  isDegraded: boolean;
  isCorrupted: boolean;
  healthyReplicasCount: number;
  totalDesiredCount: number;
}

export function computeIntegrityStatus(
  objects: StoredObject[],
  clusterHealth: ClusterHealthSummary | null
): IntegrityStatus {
  if (!clusterHealth) {
    return {
      displayValue: '—',
      statusLabel: 'Checking...',
      colorClass: 'text-zinc-400',
      badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
      isDegraded: false,
      isCorrupted: false,
      healthyReplicasCount: 0,
      totalDesiredCount: 0
    };
  }

  // If there are no stored objects yet
  if (objects.length === 0) {
    const isClusterHealthy = clusterHealth.status === 'HEALTHY';
    return {
      displayValue: isClusterHealthy ? '100%' : 'Degraded',
      statusLabel: isClusterHealthy ? 'Verified' : 'Node Offline',
      colorClass: isClusterHealthy ? 'text-emerald-400' : 'text-amber-400',
      badgeClass: isClusterHealthy
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      isDegraded: !isClusterHealthy,
      isCorrupted: false,
      healthyReplicasCount: 0,
      totalDesiredCount: 0
    };
  }

  // Calculate actual replica health across all stored objects
  const totalDesired = objects.reduce((acc, obj) => acc + (obj.replicationFactor || 3), 0);
  const totalHealthy = objects.reduce(
    (acc, obj) =>
      acc + (obj.healthyReplicaCount !== undefined ? obj.healthyReplicaCount : obj.replicaCount),
    0
  );

  const hasDegradedObject = objects.some(
    (obj) =>
      obj.status === 'DEGRADED' ||
      (obj.healthyReplicaCount !== undefined && obj.healthyReplicaCount < obj.replicationFactor)
  );

  const isDegraded =
    hasDegradedObject || totalHealthy < totalDesired || clusterHealth.status !== 'HEALTHY';

  if (!isDegraded) {
    return {
      displayValue: '100%',
      statusLabel: 'Verified',
      colorClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      isDegraded: false,
      isCorrupted: false,
      healthyReplicasCount: totalHealthy,
      totalDesiredCount: totalDesired
    };
  }

  // In degraded state (e.g. 1 replica corrupted out of 3 desired, or node failed)
  // If 1 object (or small object count where ratio is clearest, like "2 / 3 Verified" as requested):
  if (objects.length === 1) {
    return {
      displayValue: `${totalHealthy} / ${totalDesired}`,
      statusLabel: 'Integrity Degraded',
      colorClass: 'text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      isDegraded: true,
      isCorrupted: true,
      healthyReplicasCount: totalHealthy,
      totalDesiredCount: totalDesired
    };
  }

  // Multiple objects
  const percentage = Math.round((totalHealthy / Math.max(1, totalDesired)) * 100);
  return {
    displayValue: `${percentage}%`,
    statusLabel: `${totalHealthy}/${totalDesired} Verified`,
    colorClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    isDegraded: true,
    isCorrupted: true,
    healthyReplicasCount: totalHealthy,
    totalDesiredCount: totalDesired
  };
}
