export type NodeStatus = 'HEALTHY' | 'FAILED' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';

export type ObjectStatus = 'ACTIVE' | 'PENDING' | 'HEALTHY' | 'DEGRADED' | 'CORRUPTED' | 'DELETED';

export type ReplicaStatus = 'HEALTHY' | 'FAILED' | 'UNAVAILABLE' | 'DEGRADED' | 'CORRUPTED' | 'SYNCING';

export interface StorageNodeDTO {
  id: string;
  name: string;
  status: NodeStatus | string;
  capacity: string; // Serialized string for safe JSON BigInt handling
  usedCapacity: string;
  availableCapacity: string;
  capacityBytes: number;
  usedCapacityBytes: number;
  availableCapacityBytes: number;
  utilizationPercentage: number;
  lastHeartbeat: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClusterHealthSummary {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  totalNodes: number;
  healthyNodes: number;
  degradedNodes: number;
  unhealthyNodes: number;
  offlineNodes: number;
  totalCapacity: string;
  usedCapacity: string;
  totalCapacityBytes: number;
  usedCapacityBytes: number;
  utilizationPercentage: number;
  totalObjects: number;
  totalReplicas: number;
  timestamp: string;
}

export interface SystemEventDTO {
  id: string;
  type: string;
  message: string;
  objectId?: string | null;
  nodeId?: string | null;
  createdAt: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp?: string;
}

export interface ObjectReplicaDTO {
  id: string;
  nodeId: string;
  nodeName: string;
  version: number;
  checksum: string;
  status: ReplicaStatus | string;
  physicalPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredObjectDTO {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  contentType: string;
  checksum: string;
  version: number;
  replicationFactor: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  replicaCount: number;
  healthyReplicaCount: number;
}

export interface StoredObjectDetailDTO extends StoredObjectDTO {
  replicas: ObjectReplicaDTO[];
}

export interface ReplicationResultDTO {
  objectId: string;
  desiredReplicas: number;
  currentReplicas: number;
  createdReplicas: number;
  status: 'HEALTHY' | 'DEGRADED';
  replicas: ObjectReplicaDTO[];
}

export interface NodeFailureResultDTO {
  nodeId: string;
  status: 'FAILED';
  affectedObjects: number;
  repairedObjects: number;
  message: string;
}

export interface NodeRecoveryResultDTO {
  nodeId: string;
  status: 'HEALTHY';
  reconciledObjects: number;
  removedReplicas: number;
  message?: string;
}

export interface RepairResultDTO {
  objectId: string;
  status: 'HEALTHY' | 'DEGRADED';
  desiredReplicas: number;
  healthyReplicas: number;
  repairedReplicas: number;
  sourceNode?: string;
  destinationNodes: string[];
  message: string;
  replicas?: ObjectReplicaDTO[];
}
