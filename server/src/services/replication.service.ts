import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { objectRepository, ObjectRepository } from '../repositories/object.repository';
import { nodeRepository, NodeRepository } from '../repositories/node.repository';
import { eventRepository, EventRepository } from '../repositories/event.repository';
import { ReplicationResultDTO, ObjectReplicaDTO } from '../types';
import { NotFoundError } from './object.service';

export class ReplicationService {
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
   * Replicate an object to healthy storage nodes until desired replicationFactor is met.
   */
  async replicateObject(objectId: string): Promise<ReplicationResultDTO> {
    const object = await this.objectRepo.findById(objectId);
    if (!object) {
      throw new NotFoundError(`Object '${objectId}' not found`);
    }

    const desiredReplicas = object.replicationFactor;
    const existingNodeIds = new Set(object.replicas.map((r) => r.nodeId));

    // 1. Verify existing replicas and locate a healthy source file
    let sourcePath: string | null = null;
    let sourceNodeName: string | null = null;

    // Prefer node-a if available
    const preferredReplica =
      object.replicas.find((r) => r.node?.name === 'node-a') || object.replicas[0];

    if (preferredReplica && preferredReplica.node?.name) {
      const candidatePath = path.join(
        this.getNodeStorageDir(preferredReplica.node.name),
        `${objectId}.blob`
      );
      if (fs.existsSync(candidatePath)) {
        sourcePath = candidatePath;
        sourceNodeName = preferredReplica.node.name;
      }
    }

    // Fallback search through any other replica if node-a was not found
    if (!sourcePath) {
      for (const replica of object.replicas) {
        if (!replica.node?.name) continue;
        const candidatePath = path.join(
          this.getNodeStorageDir(replica.node.name),
          `${objectId}.blob`
        );
        if (fs.existsSync(candidatePath)) {
          sourcePath = candidatePath;
          sourceNodeName = replica.node.name;
          break;
        }
      }
    }

    if (!sourcePath || !sourceNodeName) {
      throw new Error(`No physical source replica available on cluster for object '${objectId}'`);
    }

    // 2. Check if already satisfied
    if (object.replicas.length >= desiredReplicas) {
      return {
        objectId: object.id,
        desiredReplicas,
        currentReplicas: object.replicas.length,
        createdReplicas: 0,
        status: 'HEALTHY',
        replicas: this.mapReplicas(object.replicas, object.id)
      };
    }

    // 3. Log replication start event
    await this.eventRepo.create({
      type: 'REPLICATION_STARTED',
      message: `Replication started for ${object.name}`,
      objectId: object.id
    });

    // 4. Find candidate healthy nodes that do not yet hold a replica
    const allNodes = await this.nodeRepo.findAll();
    // Deterministic priority ordering: node-b, node-c, node-d, node-e, node-a
    const nodePriority: Record<string, number> = {
      'node-b': 1,
      'node-c': 2,
      'node-d': 3,
      'node-e': 4,
      'node-a': 5
    };

    const candidateNodes = allNodes
      .filter((n) => n.status === 'HEALTHY' && !existingNodeIds.has(n.id))
      .sort((a, b) => (nodePriority[a.name] || 99) - (nodePriority[b.name] || 99));

    let createdReplicas = 0;
    let currentCount = object.replicas.length;

    // 5. Copy and register replicas
    for (const targetNode of candidateNodes) {
      if (currentCount >= desiredReplicas) break;

      // Capacity verification
      const requiredBytes = object.size;
      if (targetNode.usedCapacity + requiredBytes > targetNode.capacity) {
        await this.eventRepo.create({
          type: 'REPLICATION_FAILED',
          message: `Replication failed: insufficient capacity on ${targetNode.name}`,
          objectId: object.id,
          nodeId: targetNode.id
        });
        continue;
      }

      const destDir = this.getNodeStorageDir(targetNode.name);
      const destPath = path.join(destDir, `${objectId}.blob`);

      // Physical Copy
      try {
        fs.copyFileSync(sourcePath, destPath);
      } catch (copyErr) {
        console.error(`[ReplicationService] Failed physical copy to ${targetNode.name}:`, copyErr);
        await this.eventRepo.create({
          type: 'REPLICATION_FAILED',
          message: `Replication failed: filesystem error copying to ${targetNode.name}`,
          objectId: object.id,
          nodeId: targetNode.id
        });
        continue;
      }

      // Checksum Verification on destination bytes
      const destBytes = fs.readFileSync(destPath);
      const destChecksum = crypto.createHash('sha256').update(destBytes).digest('hex');

      if (destChecksum !== object.checksum) {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        await this.eventRepo.create({
          type: 'REPLICATION_FAILED',
          message: `Replication failed: checksum mismatch on ${targetNode.name}`,
          objectId: object.id,
          nodeId: targetNode.id
        });
        continue;
      }

      // Atomic DB persistence & capacity increment
      try {
        const isFullyReplicated = currentCount + 1 >= desiredReplicas;
        await this.objectRepo.addReplicaWithCapacity({
          objectId: object.id,
          nodeId: targetNode.id,
          nodeName: targetNode.name,
          version: object.version,
          checksum: destChecksum,
          size: requiredBytes,
          isFullyReplicated
        });

        createdReplicas++;
        currentCount++;
        existingNodeIds.add(targetNode.id);
      } catch (dbErr) {
        // Rollback physical copy if DB persistence fails
        console.error(`[ReplicationService] DB persistence failed for replica on ${targetNode.name}:`, dbErr);
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch (unlinkErr) {
            console.error('[ReplicationService] Unlink error during rollback:', unlinkErr);
          }
        }
      }
    }

    // 6. Final Status & Audit
    const finalStatus: 'HEALTHY' | 'DEGRADED' =
      currentCount >= desiredReplicas ? 'HEALTHY' : 'DEGRADED';

    if (currentCount >= desiredReplicas) {
      await this.eventRepo.create({
        type: 'REPLICATION_COMPLETED',
        message: `Replication completed: ${currentCount}/${desiredReplicas} replicas`,
        objectId: object.id
      });
    }

    // Reload refreshed object state
    const refreshed = await this.objectRepo.findById(objectId);

    return {
      objectId: object.id,
      desiredReplicas,
      currentReplicas: refreshed ? refreshed.replicas.length : currentCount,
      createdReplicas,
      status: finalStatus,
      replicas: refreshed ? this.mapReplicas(refreshed.replicas, object.id) : []
    };
  }

  /**
   * Helper to map Prisma replicas to DTOs.
   */
  private mapReplicas(
    replicas: Array<{
      id: string;
      nodeId: string;
      version: number;
      checksum: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      node?: { name: string };
    }>,
    objectId: string
  ): ObjectReplicaDTO[] {
    return replicas.map((r) => ({
      id: r.id,
      nodeId: r.nodeId,
      nodeName: r.node?.name || 'unknown',
      version: r.version,
      checksum: r.checksum,
      status: r.status,
      physicalPath: `storage/${r.node?.name || 'unknown'}/${objectId}.blob`,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  /**
   * Get detailed replica information for an object.
   */
  async getReplicas(objectId: string): Promise<ObjectReplicaDTO[]> {
    const object = await this.objectRepo.findById(objectId);
    if (!object) {
      throw new NotFoundError(`Object '${objectId}' not found`);
    }
    return this.mapReplicas(object.replicas, object.id);
  }

  /**
   * Replicate all pending/degraded objects across the cluster.
   */
  async replicateAllPendingObjects(): Promise<ReplicationResultDTO[]> {
    const allObjects = await this.objectRepo.findAll();
    const pending = allObjects.filter((o) => o.replicas.length < o.replicationFactor);

    const results: ReplicationResultDTO[] = [];
    for (const obj of pending) {
      const res = await this.replicateObject(obj.id);
      results.push(res);
    }
    return results;
  }
}

export const replicationService = new ReplicationService();
