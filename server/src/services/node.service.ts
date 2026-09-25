import { nodeRepository, NodeRepository } from '../repositories/node.repository';
import { eventRepository, EventRepository } from '../repositories/event.repository';
import { prisma } from '../repositories/prisma';
import { repairService } from './repair.service';
import { NotFoundError } from './object.service';
import { StorageNodeDTO, NodeFailureResultDTO, NodeRecoveryResultDTO } from '../types';
import { Node } from '@prisma/client';

export class NodeService {
  private readonly defaultNodes = ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'];
  private readonly defaultCapacity = BigInt(10 * 1024 * 1024 * 1024); // 10 GB

  constructor(
    private readonly nodeRepo: NodeRepository = nodeRepository,
    private readonly eventRepo: EventRepository = eventRepository
  ) {}

  /**
   * Ensure the five logical storage nodes exist in the database with HEALTHY status.
   */
  async initializeDefaultNodes(): Promise<void> {
    for (const nodeName of this.defaultNodes) {
      const existing = await this.nodeRepo.findByName(nodeName);
      if (!existing) {
        const created = await this.nodeRepo.upsert({
          name: nodeName,
          status: 'HEALTHY',
          capacity: this.defaultCapacity,
          usedCapacity: BigInt(0)
        });

        await this.eventRepo.create({
          type: 'NODE_INITIALIZED',
          message: `Storage node ${nodeName} initialized with status HEALTHY`,
          nodeId: created.id
        });
      }
    }
  }

  /**
   * Retrieve all registered storage nodes with calculated metrics.
   */
  async getAllNodes(): Promise<StorageNodeDTO[]> {
    const nodes = await this.nodeRepo.findAll();
    return nodes.map((node) => this.mapToDTO(node));
  }

  /**
   * Find a specific node by ID or Name.
   */
  async getNodeById(idOrName: string): Promise<StorageNodeDTO | null> {
    const node = await this.nodeRepo.findByIdOrName(idOrName);
    return node ? this.mapToDTO(node) : null;
  }

  /**
   * Simulate failure of a storage node and trigger automatic repair for all affected objects.
   */
  async failNode(idOrName: string): Promise<NodeFailureResultDTO> {
    const node = await this.nodeRepo.findByIdOrName(idOrName);
    if (!node) {
      throw new NotFoundError(`Node '${idOrName}' not found`);
    }

    // 1. Mark node FAILED in database
    await this.nodeRepo.updateStatus(node.id, 'FAILED');

    // 2. Audit: NODE_FAILED
    await this.eventRepo.create({
      type: 'NODE_FAILED',
      message: `Node ${node.name} marked as FAILED`,
      nodeId: node.id
    });

    // 3. Find all replica records belonging to that node
    const affectedReplicas = await prisma.replica.findMany({
      where: { nodeId: node.id },
      select: { objectId: true }
    });

    const uniqueObjectIds = Array.from(new Set(affectedReplicas.map((r) => r.objectId)));
    let repairedCount = 0;

    // 4. Trigger automatic repair for each affected object
    for (const objectId of uniqueObjectIds) {
      try {
        const repairResult = await repairService.repairObject(objectId);
        if (repairResult.repairedReplicas > 0 || repairResult.status === 'HEALTHY') {
          repairedCount++;
        }
      } catch (err) {
        console.error(`[NodeService] Failed automatic repair for object ${objectId}:`, err);
      }
    }

    return {
      nodeId: node.name,
      status: 'FAILED',
      affectedObjects: uniqueObjectIds.length,
      repairedObjects: repairedCount,
      message: 'Node failed and affected replicas were repaired'
    };
  }

  /**
   * Recover a previously failed storage node and reconcile object replicas.
   */
  async recoverNode(idOrName: string): Promise<NodeRecoveryResultDTO> {
    const node = await this.nodeRepo.findByIdOrName(idOrName);
    if (!node) {
      throw new NotFoundError(`Node '${idOrName}' not found`);
    }

    // 1. Mark node HEALTHY in database
    await this.nodeRepo.updateStatus(node.id, 'HEALTHY');

    // 2. Audit: NODE_RECOVERED
    await this.eventRepo.create({
      type: 'NODE_RECOVERED',
      message: `Node ${node.name} recovered`,
      nodeId: node.id
    });

    // 3. Find all replica records belonging to that node to discover affected objects
    const nodeReplicas = await prisma.replica.findMany({
      where: { nodeId: node.id },
      select: { objectId: true }
    });

    const uniqueObjectIds = Array.from(new Set(nodeReplicas.map((r) => r.objectId)));
    let reconciledObjects = 0;
    let removedReplicas = 0;

    // 4. Reconcile replicas for each affected object
    for (const objectId of uniqueObjectIds) {
      try {
        const res = await repairService.reconcileObjectReplicas(objectId);
        if (res.reconciled) {
          reconciledObjects++;
          removedReplicas += res.removedCount;
        }
      } catch (err) {
        console.error(`[NodeService] Failed reconciliation for object ${objectId}:`, err);
      }
    }

    return {
      nodeId: node.name,
      status: 'HEALTHY',
      reconciledObjects,
      removedReplicas,
      message: `Node ${node.name} recovered and replicas reconciled`
    };
  }

  /**
   * Helper to format Prisma Node model into API StorageNodeDTO.
   */
  private mapToDTO(node: Node): StorageNodeDTO {
    const capacityBytes = Number(node.capacity);
    const usedCapacityBytes = Number(node.usedCapacity);
    const availableCapacityBytes = Math.max(0, capacityBytes - usedCapacityBytes);
    const availableCapacityBigInt =
      node.capacity > node.usedCapacity ? node.capacity - node.usedCapacity : BigInt(0);

    const utilizationPercentage =
      capacityBytes > 0
        ? Math.round((usedCapacityBytes / capacityBytes) * 10000) / 100
        : 0;

    return {
      id: node.id,
      name: node.name,
      status: node.status,
      capacity: node.capacity.toString(),
      usedCapacity: node.usedCapacity.toString(),
      availableCapacity: availableCapacityBigInt.toString(),
      capacityBytes,
      usedCapacityBytes,
      availableCapacityBytes,
      utilizationPercentage,
      lastHeartbeat: node.lastHeartbeat.toISOString(),
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString()
    };
  }
}

export const nodeService = new NodeService();
