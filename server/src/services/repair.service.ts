import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { objectRepository, ObjectRepository } from '../repositories/object.repository';
import { nodeRepository, NodeRepository } from '../repositories/node.repository';
import { eventRepository, EventRepository } from '../repositories/event.repository';
import { RepairResultDTO, ObjectReplicaDTO } from '../types';
import { NotFoundError } from './object.service';

export interface ObjectHealthAssessment {
  objectId: string;
  status: 'HEALTHY' | 'DEGRADED';
  healthyReplicaCount: number;
  totalReplicaCount: number;
  replicationFactor: number;
  replicas: Array<{
    id: string;
    nodeId: string;
    nodeName: string;
    nodeStatus: string;
    physicalExists: boolean;
    checksumMatches: boolean;
    isHealthy: boolean;
    status: string;
  }>;
}

export class RepairService {
  constructor(
    private readonly objectRepo: ObjectRepository = objectRepository,
    private readonly nodeRepo: NodeRepository = nodeRepository,
    private readonly eventRepo: EventRepository = eventRepository
  ) {}

  /**
   * Helper to resolve physical directory path for a storage node.
   */
  private getNodeStorageDir(nodeName: string): string {
    const nodeDir = path.join(config.storageBasePath, nodeName);
    if (!fs.existsSync(nodeDir)) {
      fs.mkdirSync(nodeDir, { recursive: true });
    }
    return nodeDir;
  }

  /**
   * Recalculate health of a specific object based on node status, physical file existence,
   * and checksum validation.
   */
  async recalculateObjectHealth(objectId: string): Promise<ObjectHealthAssessment> {
    const object = await this.objectRepo.findById(objectId);
    if (!object) {
      throw new NotFoundError(`Object '${objectId}' not found`);
    }

    let healthyReplicaCount = 0;
    const assessedReplicas = [];

    for (const replica of object.replicas) {
      const nodeName = replica.node?.name || 'unknown';
      const node = await this.nodeRepo.findById(replica.nodeId);
      const isNodeHealthy = node?.status === 'HEALTHY';

      const filePath = path.join(this.getNodeStorageDir(nodeName), `${objectId}.blob`);
      const physicalExists = fs.existsSync(filePath);

      let checksumMatches = false;
      if (physicalExists) {
        try {
          const bytes = fs.readFileSync(filePath);
          const computedHash = crypto.createHash('sha256').update(bytes).digest('hex');
          checksumMatches = computedHash === object.checksum;
        } catch {
          checksumMatches = false;
        }
      }

      // A replica is strictly HEALTHY if: node is HEALTHY, file exists, and SHA-256 matches
      const isHealthy = isNodeHealthy && physicalExists && checksumMatches;
      if (isHealthy) {
        healthyReplicaCount++;
      }

      let replicaDisplayStatus = 'HEALTHY';
      if (!isNodeHealthy) {
        replicaDisplayStatus = 'UNAVAILABLE';
      } else if (!physicalExists || !checksumMatches) {
        replicaDisplayStatus = 'CORRUPTED';
      }

      assessedReplicas.push({
        id: replica.id,
        nodeId: replica.nodeId,
        nodeName,
        nodeStatus: node?.status || 'UNKNOWN',
        physicalExists,
        checksumMatches,
        isHealthy,
        status: replicaDisplayStatus
      });
    }

    const effectiveStatus: 'HEALTHY' | 'DEGRADED' =
      healthyReplicaCount >= object.replicationFactor ? 'HEALTHY' : 'DEGRADED';

    // Persist status update in database if it has changed
    if (object.status !== effectiveStatus) {
      await this.objectRepo.updateStatus(object.id, effectiveStatus);
    }

    return {
      objectId: object.id,
      status: effectiveStatus,
      healthyReplicaCount,
      totalReplicaCount: object.replicas.length,
      replicationFactor: object.replicationFactor,
      replicas: assessedReplicas
    };
  }

  /**
   * Repair an object whose healthy replica count is below replicationFactor.
   */
  async repairObject(objectId: string): Promise<RepairResultDTO> {
    const object = await this.objectRepo.findById(objectId);
    if (!object) {
      throw new NotFoundError(`Object '${objectId}' not found`);
    }

    const desiredReplicas = object.replicationFactor;

    // 1. Assess current replica health & verify source candidates
    const assessment = await this.recalculateObjectHealth(objectId);
    if (assessment.healthyReplicaCount >= desiredReplicas) {
      return {
        objectId: object.id,
        status: 'HEALTHY',
        desiredReplicas,
        healthyReplicas: assessment.healthyReplicaCount,
        repairedReplicas: 0,
        destinationNodes: [],
        message: 'Object already has sufficient healthy replicas'
      };
    }

    // 2. Audit: REPAIR_STARTED
    await this.eventRepo.create({
      type: 'REPAIR_STARTED',
      message: `Repair started for ${object.name}`,
      objectId: object.id
    });

    // 3. Find a verified, uncorrupted source replica
    let validSourcePath: string | null = null;
    let sourceNodeName: string | null = null;

    for (const replica of assessment.replicas) {
      if (!replica.isHealthy) continue; // Skip failed nodes, missing files, corrupted checksums

      const candidatePath = path.join(
        this.getNodeStorageDir(replica.nodeName),
        `${objectId}.blob`
      );

      if (fs.existsSync(candidatePath)) {
        try {
          const bytes = fs.readFileSync(candidatePath);
          const computedHash = crypto.createHash('sha256').update(bytes).digest('hex');
          if (computedHash === object.checksum) {
            validSourcePath = candidatePath;
            sourceNodeName = replica.nodeName;
            break;
          }
        } catch {
          // File read error, try next candidate
        }
      }
    }

    // If no candidate source replica passed integrity verification:
    if (!validSourcePath || !sourceNodeName) {
      await this.eventRepo.create({
        type: 'REPAIR_FAILED',
        message: 'All available source replicas failed integrity verification',
        objectId: object.id
      });

      await this.objectRepo.updateStatus(object.id, 'DEGRADED');

      return {
        objectId: object.id,
        status: 'DEGRADED',
        desiredReplicas,
        healthyReplicas: 0,
        repairedReplicas: 0,
        destinationNodes: [],
        message: 'All available source replicas failed integrity verification'
      };
    }

    // 4. Find candidate destination nodes:
    // - Must be HEALTHY (failed nodes must never be repair targets)
    // - Must NOT already host a replica for this object (healthy or failed)
    // - Must have sufficient capacity
    const allNodes = await this.nodeRepo.findAll();
    const existingNodeIds = new Set(object.replicas.map((r) => r.nodeId));

    // Preferred deterministic order: node-a, node-b, node-c, node-d, node-e
    const nodeOrder: Record<string, number> = {
      'node-a': 1,
      'node-b': 2,
      'node-c': 3,
      'node-d': 4,
      'node-e': 5
    };

    const candidateDestinations = allNodes
      .filter((n) => n.status === 'HEALTHY' && !existingNodeIds.has(n.id))
      .sort((a, b) => (nodeOrder[a.name] || 99) - (nodeOrder[b.name] || 99));

    const missingCount = desiredReplicas - assessment.healthyReplicaCount;
    const requiredBytes = object.size;

    const destinationNodes: string[] = [];
    let repairedReplicas = 0;
    let currentHealthyCount = assessment.healthyReplicaCount;

    // 5. Check if any healthy destination nodes with capacity are available
    const eligibleDestinations = candidateDestinations.filter(
      (node) => node.usedCapacity + requiredBytes <= node.capacity
    );

    if (eligibleDestinations.length === 0) {
      await this.eventRepo.create({
        type: 'REPAIR_FAILED',
        message: 'Repair failed: no healthy destination node with sufficient capacity',
        objectId: object.id
      });

      return {
        objectId: object.id,
        status: 'DEGRADED',
        desiredReplicas,
        healthyReplicas: currentHealthyCount,
        repairedReplicas: 0,
        destinationNodes: [],
        message: 'Repair failed: no healthy destination node with sufficient capacity'
      };
    }

    // 6. Perform repair copies to destinations
    for (const destNode of eligibleDestinations) {
      if (currentHealthyCount >= desiredReplicas) break;

      const destDir = this.getNodeStorageDir(destNode.name);
      const destPath = path.join(destDir, `${objectId}.blob`);

      // Physical Copy
      try {
        fs.copyFileSync(validSourcePath, destPath);
      } catch (copyErr) {
        console.error(`[RepairService] Physical copy failed to ${destNode.name}:`, copyErr);
        await this.eventRepo.create({
          type: 'REPAIR_FAILED',
          message: `Repair failed: filesystem error copying to ${destNode.name}`,
          objectId: object.id,
          nodeId: destNode.id
        });
        continue;
      }

      // Checksum verification on destination bytes
      const destBytes = fs.readFileSync(destPath);
      const destChecksum = crypto.createHash('sha256').update(destBytes).digest('hex');

      if (destChecksum !== object.checksum) {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        await this.eventRepo.create({
          type: 'REPAIR_FAILED',
          message: `Repair failed: checksum mismatch on ${destNode.name}`,
          objectId: object.id,
          nodeId: destNode.id
        });
        continue;
      }

      // Atomic DB persistence & capacity increment
      try {
        const isFullyReplicated = currentHealthyCount + 1 >= desiredReplicas;
        await this.objectRepo.addReplicaWithCapacity({
          objectId: object.id,
          nodeId: destNode.id,
          nodeName: destNode.name,
          version: object.version,
          checksum: destChecksum,
          size: requiredBytes,
          isFullyReplicated
        });

        // Audit: REPLICA_REPAIRED
        await this.eventRepo.create({
          type: 'REPLICA_REPAIRED',
          message: `Replica repaired on ${destNode.name}`,
          objectId: object.id,
          nodeId: destNode.id
        });

        repairedReplicas++;
        currentHealthyCount++;
        destinationNodes.push(destNode.name);
        existingNodeIds.add(destNode.id);
      } catch (dbErr) {
        console.error(`[RepairService] DB persistence failed for repaired replica on ${destNode.name}:`, dbErr);
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch (unlinkErr) {
            console.error('[RepairService] Unlink error during rollback:', unlinkErr);
          }
        }
      }
    }

    // 7. Audit: REPAIR_COMPLETED
    const finalStatus: 'HEALTHY' | 'DEGRADED' =
      currentHealthyCount >= desiredReplicas ? 'HEALTHY' : 'DEGRADED';

    if (currentHealthyCount >= desiredReplicas) {
      await this.eventRepo.create({
        type: 'REPAIR_COMPLETED',
        message: `Repair completed: ${currentHealthyCount}/${desiredReplicas} healthy replicas`,
        objectId: object.id
      });
    }

    // Ensure object status in DB is accurate
    await this.objectRepo.updateStatus(object.id, finalStatus);

    return {
      objectId: object.id,
      status: finalStatus,
      desiredReplicas,
      healthyReplicas: currentHealthyCount,
      repairedReplicas,
      sourceNode: sourceNodeName,
      destinationNodes,
      message:
        finalStatus === 'HEALTHY'
          ? `Repair completed: ${currentHealthyCount}/${desiredReplicas} healthy replicas`
          : `Repair partially completed: ${currentHealthyCount}/${desiredReplicas} healthy replicas`
    };
  }

  /**
   * Repair all degraded objects in the cluster.
   */
  async repairAllDegradedObjects(): Promise<RepairResultDTO[]> {
    const allObjects = await this.objectRepo.findAll();
    const results: RepairResultDTO[] = [];

    for (const obj of allObjects) {
      const assessment = await this.recalculateObjectHealth(obj.id);
      if (assessment.healthyReplicaCount < obj.replicationFactor) {
        const res = await this.repairObject(obj.id);
        results.push(res);
      }
    }

    return results;
  }

  /**
   * Reconcile replicas for an object after node recovery to ensure healthy physical replicas
   * do not exceed replicationFactor.
   */
  async reconcileObjectReplicas(objectId: string): Promise<{
    objectId: string;
    reconciled: boolean;
    initialCount: number;
    finalCount: number;
    removedCount: number;
    removedNodes: string[];
  }> {
    const object = await this.objectRepo.findById(objectId);
    if (!object) {
      throw new NotFoundError(`Object '${objectId}' not found`);
    }

    const assessment = await this.recalculateObjectHealth(objectId);
    const initialCount = assessment.healthyReplicaCount;
    const targetCount = object.replicationFactor;

    if (initialCount <= targetCount) {
      return {
        objectId: object.id,
        reconciled: false,
        initialCount,
        finalCount: initialCount,
        removedCount: 0,
        removedNodes: []
      };
    }

    // Node priority for deterministic retention preference (prefer original lower-indexed nodes)
    const nodePriority: Record<string, number> = {
      'node-a': 1,
      'node-b': 2,
      'node-c': 3,
      'node-d': 4,
      'node-e': 5
    };

    const healthyAssessments = assessment.replicas.filter((r) => r.isHealthy);
    const replicaMap = new Map(object.replicas.map((r) => [r.id, r]));

    // Sort to keep preferred original nodes and oldest createdAt first
    const sortedHealthy = [...healthyAssessments].sort((a, b) => {
      const pA = nodePriority[a.nodeName] ?? 99;
      const pB = nodePriority[b.nodeName] ?? 99;
      if (pA !== pB) return pA - pB;
      const dateA = replicaMap.get(a.id)?.createdAt.getTime() ?? 0;
      const dateB = replicaMap.get(b.id)?.createdAt.getTime() ?? 0;
      return dateA - dateB;
    });

    const excessReplicas = sortedHealthy.slice(targetCount);
    const removedNodes: string[] = [];

    for (const excess of excessReplicas) {
      // 1. Physically delete blob file from destination node
      const filePath = path.join(this.getNodeStorageDir(excess.nodeName), `${objectId}.blob`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error(`[RepairService] Error unlinking excess replica file ${filePath}:`, unlinkErr);
        }
      }

      // 2. Remove DB record, decrement usedCapacity, and log REPLICA_REMOVED
      await this.objectRepo.removeReplicaWithCapacity({
        replicaId: excess.id,
        nodeId: excess.nodeId,
        nodeName: excess.nodeName,
        objectId: object.id,
        size: object.size
      });

      removedNodes.push(excess.nodeName);
    }

    // 3. Log REPLICA_RECONCILED event
    await this.eventRepo.create({
      type: 'REPLICA_RECONCILED',
      message: `Replica reconciliation completed for ${object.name}: ${initialCount} → ${targetCount} replicas`,
      objectId: object.id
    });

    // 4. Update status in database
    await this.objectRepo.updateStatus(object.id, 'HEALTHY');

    return {
      objectId: object.id,
      reconciled: true,
      initialCount,
      finalCount: targetCount,
      removedCount: excessReplicas.length,
      removedNodes
    };
  }
}

export const repairService = new RepairService();
