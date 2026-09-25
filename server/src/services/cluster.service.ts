import { nodeRepository, NodeRepository } from '../repositories/node.repository';
import { objectRepository, ObjectRepository } from '../repositories/object.repository';
import { eventRepository, EventRepository } from '../repositories/event.repository';
import { ClusterHealthSummary, SystemEventDTO } from '../types';

export class ClusterService {
  constructor(
    private readonly nodeRepo: NodeRepository = nodeRepository,
    private readonly objectRepo: ObjectRepository = objectRepository,
    private readonly eventRepo: EventRepository = eventRepository
  ) {}

  /**
   * Calculate and return comprehensive cluster health summary.
   */
  async getClusterHealth(): Promise<ClusterHealthSummary> {
    const nodes = await this.nodeRepo.findAll();
    const totalNodes = nodes.length;

    let healthyNodes = 0;
    let degradedNodes = 0;
    let unhealthyNodes = 0;
    let offlineNodes = 0;

    let totalCapacityBigInt = BigInt(0);
    let usedCapacityBigInt = BigInt(0);

    for (const node of nodes) {
      totalCapacityBigInt += node.capacity;
      usedCapacityBigInt += node.usedCapacity;

      switch (node.status) {
        case 'HEALTHY':
          healthyNodes++;
          break;
        case 'FAILED':
          offlineNodes++;
          break;
        case 'DEGRADED':
          degradedNodes++;
          break;
        case 'UNHEALTHY':
          unhealthyNodes++;
          break;
        case 'OFFLINE':
          offlineNodes++;
          break;
        default:
          healthyNodes++;
          break;
      }
    }

    const totalCapacityBytes = Number(totalCapacityBigInt);
    const usedCapacityBytes = Number(usedCapacityBigInt);
    const utilizationPercentage =
      totalCapacityBytes > 0
        ? Math.round((usedCapacityBytes / totalCapacityBytes) * 10000) / 100
        : 0;

    // Cluster status logic:
    // Full health if all nodes are healthy
    // Degraded if at least majority quorum (>= 3 of 5) are available
    // Critical if quorum lost
    let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (totalNodes === 0 || healthyNodes < Math.ceil(totalNodes / 2)) {
      status = 'CRITICAL';
    } else if (healthyNodes < totalNodes || degradedNodes > 0 || unhealthyNodes > 0 || offlineNodes > 0) {
      status = 'DEGRADED';
    }

    const totalObjects = await this.objectRepo.countObjects();
    const totalReplicas = await this.objectRepo.countReplicas();

    return {
      status,
      totalNodes,
      healthyNodes,
      degradedNodes,
      unhealthyNodes,
      offlineNodes,
      totalCapacity: totalCapacityBigInt.toString(),
      usedCapacity: usedCapacityBigInt.toString(),
      totalCapacityBytes,
      usedCapacityBytes,
      utilizationPercentage,
      totalObjects,
      totalReplicas,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Retrieve recent cluster activity events.
   */
  async getRecentEvents(limit = 20): Promise<SystemEventDTO[]> {
    const events = await this.eventRepo.findRecent(limit);
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      objectId: e.objectId,
      nodeId: e.nodeId,
      createdAt: e.createdAt.toISOString()
    }));
  }
}

export const clusterService = new ClusterService();
