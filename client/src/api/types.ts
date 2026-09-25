export type NodeStatus = 'HEALTHY' | 'FAILED' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';

export interface StorageNode {
  id: string;
  name: string;
  status: NodeStatus | string;
  capacity: string;
  usedCapacity: string;
  availableCapacity?: string;
  capacityBytes: number;
  usedCapacityBytes: number;
  availableCapacityBytes?: number;
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

export interface SystemEvent {
  id: string;
  type: string;
  message: string;
  objectId?: string | null;
  nodeId?: string | null;
  createdAt: string;
}

export interface ApiHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp?: string;
}

export interface ObjectReplica {
  id: string;
  nodeId: string;
  nodeName: string;
  version: number;
  checksum: string;
  status: string;
  physicalPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredObject {
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
  healthyReplicaCount?: number;
}

export interface StoredObjectDetail extends StoredObject {
  replicas: ObjectReplica[];
}

export interface ReplicationResult {
  objectId: string;
  desiredReplicas: number;
  currentReplicas: number;
  createdReplicas: number;
  status: 'HEALTHY' | 'DEGRADED';
  replicas: ObjectReplica[];
}

export interface NodeFailureResult {
  nodeId: string;
  status: 'FAILED';
  affectedObjects: number;
  repairedObjects: number;
  message: string;
}

export interface NodeRecoveryResult {
  nodeId: string;
  status: 'HEALTHY';
  reconciledObjects?: number;
  removedReplicas?: number;
  message?: string;
}

export interface RepairResult {
  objectId: string;
  status: 'HEALTHY' | 'DEGRADED';
  desiredReplicas: number;
  healthyReplicas: number;
  repairedReplicas: number;
  sourceNode?: string;
  destinationNodes: string[];
  message: string;
  replicas?: ObjectReplica[];
}
