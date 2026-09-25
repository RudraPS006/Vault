import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { objectRepository, ObjectRepository, ObjectWithReplicas } from '../repositories/object.repository';
import { nodeRepository, NodeRepository } from '../repositories/node.repository';
import { eventRepository, EventRepository } from '../repositories/event.repository';
import { StoredObjectDTO, StoredObjectDetailDTO, ObjectReplicaDTO } from '../types';

export class InsufficientCapacityError extends Error {
  statusCode = 507; // Insufficient Storage
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCapacityError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ObjectService {
  constructor(
    private readonly objectRepo: ObjectRepository = objectRepository,
    private readonly nodeRepo: NodeRepository = nodeRepository,
    private readonly eventRepo: EventRepository = eventRepository
  ) {}

  /**
   * Resolve physical directory path for a given storage node.
   */
  private getNodeStorageDir(nodeName = 'node-a'): string {
    const nodeDir = path.join(config.storageBasePath, nodeName);
    if (!fs.existsSync(nodeDir)) {
      fs.mkdirSync(nodeDir, { recursive: true });
    }
    return nodeDir;
  }

  /**
   * Upload and persist an object to node-a with SHA-256 calculation and rollback safety.
   */
  async uploadObject(file?: Express.Multer.File): Promise<StoredObjectDetailDTO> {
    if (!file || !file.buffer || file.size === 0) {
      throw new ValidationError('No file provided or file is empty');
    }

    // 1. Select initial primary storage node (node-a for Part 2A)
    const targetNodeName = 'node-a';
    const node = await this.nodeRepo.findByName(targetNodeName);
    if (!node) {
      throw new Error(`Primary storage node '${targetNodeName}' not found`);
    }

    // 2. Validate node capacity
    const fileSizeBigInt = BigInt(file.size);
    if (node.usedCapacity + fileSizeBigInt > node.capacity) {
      const remainingBytes = Number(node.capacity - node.usedCapacity);
      throw new InsufficientCapacityError(
        `Insufficient storage capacity on ${targetNodeName} (required: ${file.size} bytes, available: ${remainingBytes} bytes)`
      );
    }

    // 3. Calculate SHA-256 checksum from the exact file bytes
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 4. Generate collision-safe object ID and storage path
    const objectId = randomUUID();
    const nodeDir = this.getNodeStorageDir(targetNodeName);
    const physicalPath = path.join(nodeDir, `${objectId}.blob`);

    // 5. Write the physical file to disk
    try {
      fs.writeFileSync(physicalPath, file.buffer);
    } catch (fsErr) {
      console.error('[ObjectService] Physical write failed:', fsErr);
      throw new Error('Failed to write physical file to storage node');
    }

    // 6. Persist metadata in database with atomic rollback on failure
    try {
      const sanitizedName = path.basename(file.originalname).replace(/[\r\n]/g, '');
      const created = await this.objectRepo.createWithReplica({
        id: objectId,
        name: sanitizedName || `object-${objectId.slice(0, 8)}`,
        size: fileSizeBigInt,
        contentType: file.mimetype || 'application/octet-stream',
        checksum,
        version: 1,
        replicationFactor: 3, // Configurable default
        status: 'DEGRADED',
        nodeId: node.id,
        nodeName: targetNodeName
      });

      return this.mapToDetailDTO(created);
    } catch (dbErr) {
      // Data consistency guarantee: clean up orphan physical file if DB fails
      console.error('[ObjectService] Database insertion failed. Rolling back physical file:', dbErr);
      if (fs.existsSync(physicalPath)) {
        try {
          fs.unlinkSync(physicalPath);
        } catch (unlinkErr) {
          console.error('[ObjectService] Failed to clean up file after DB error:', unlinkErr);
        }
      }
      throw dbErr;
    }
  }

  /**
   * List all stored objects with replica summaries.
   */
  async listObjects(): Promise<StoredObjectDTO[]> {
    const objects = await this.objectRepo.findAll();
    return objects.map((obj) => this.mapToDTO(obj));
  }

  /**
   * Retrieve single object metadata and replica statuses by ID.
   */
  async getObjectById(id: string): Promise<StoredObjectDetailDTO> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Invalid object ID format');
    }

    const object = await this.objectRepo.findById(id);
    if (!object) {
      throw new NotFoundError(`Object '${id}' not found`);
    }

    return this.mapToDetailDTO(object);
  }

  /**
   * Stream physical object file for download from any accessible healthy replica.
   */
  async getObjectDownloadStream(id: string): Promise<{
    stream: fs.ReadStream;
    name: string;
    contentType: string;
    size: number;
    checksum: string;
  }> {
    const object = await this.objectRepo.findById(id);
    if (!object) {
      throw new NotFoundError(`Object '${id}' not found`);
    }

    // Find an accessible healthy replica on an active, HEALTHY node
    let selectedPath: string | null = null;

    // Prefer node-a if healthy, otherwise any healthy node
    const sortedReplicas = [...object.replicas].sort((a, b) => {
      if (a.node?.name === 'node-a') return -1;
      if (b.node?.name === 'node-a') return 1;
      return (a.node?.name || '').localeCompare(b.node?.name || '');
    });

    for (const replica of sortedReplicas) {
      const isNodeHealthy = replica.node?.status === 'HEALTHY';
      if (!isNodeHealthy) continue; // Skip replicas on failed nodes

      const nodeName = replica.node?.name || 'unknown';
      const nodeDir = this.getNodeStorageDir(nodeName);
      const physicalPath = path.join(nodeDir, `${id}.blob`);

      if (fs.existsSync(physicalPath)) {
        selectedPath = physicalPath;
        break;
      }
    }

    if (!selectedPath) {
      throw new NotFoundError(`No accessible healthy replica available for object '${id}'`);
    }

    const stream = fs.createReadStream(selectedPath);
    return {
      stream,
      name: object.name,
      contentType: object.contentType,
      size: Number(object.size),
      checksum: object.checksum
    };
  }

  /**
   * Delete object metadata and remove physical file from disk.
   */
  async deleteObject(id: string): Promise<{ success: boolean; id: string; name: string }> {
    if (!id) {
      throw new ValidationError('Invalid object ID');
    }

    const object = await this.objectRepo.findById(id);
    if (!object) {
      throw new NotFoundError(`Object '${id}' not found`);
    }

    // 1. Clean up from database and update node usedCapacity across all replica nodes
    const deleted = await this.objectRepo.deleteWithCleanup(id);
    if (!deleted) {
      throw new NotFoundError(`Object '${id}' not found for deletion`);
    }

    // 2. Remove physical files from all replica storage nodes
    for (const replica of object.replicas) {
      const nodeName = replica.node?.name || 'node-a';
      const nodeDir = this.getNodeStorageDir(nodeName);
      const physicalPath = path.join(nodeDir, `${id}.blob`);
      if (fs.existsSync(physicalPath)) {
        try {
          fs.unlinkSync(physicalPath);
        } catch (err) {
          console.warn(`[ObjectService] Warning: failed to unlink ${physicalPath}:`, err);
        }
      }
    }

    return {
      success: true,
      id: deleted.id,
      name: deleted.name
    };
  }

  /**
   * Intentionally corrupt a physical replica for demonstration of integrity checking and repair.
   */
  async corruptReplica(
    objectId: string,
    nodeIdOrName: string
  ): Promise<{
    objectId: string;
    nodeId: string;
    nodeName: string;
    status: string;
    message: string;
  }> {
    if (!objectId) throw new ValidationError('Invalid object ID');
    if (!nodeIdOrName) throw new ValidationError('Invalid node identifier');

    // 1. Locate object
    const object = await this.objectRepo.findById(objectId);
    if (!object) {
      throw new NotFoundError(`Object '${objectId}' not found`);
    }

    // 2. Locate node
    const node = await this.nodeRepo.findByIdOrName(nodeIdOrName);
    if (!node) {
      throw new NotFoundError(`Node '${nodeIdOrName}' not found`);
    }

    // 3. Confirm replica exists on this node
    const replica = object.replicas.find(
      (r) => r.nodeId === node.id || r.node?.name === node.name
    );
    if (!replica) {
      throw new ValidationError(`Object '${objectId}' does not have a replica on node '${node.name}'`);
    }

    // 4. Locate physical file
    const nodeDir = this.getNodeStorageDir(node.name);
    const filePath = path.join(nodeDir, `${object.id}.blob`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError(`Physical replica file not found on node '${node.name}'`);
    }

    // 5. Modify only the physical blob contents deterministically so SHA-256 no longer matches
    // Do NOT modify Object.checksum, do NOT modify other replicas, do NOT delete Replica DB record.
    const original = fs.readFileSync(filePath);
    let corrupted = Buffer.from(original);
    if (corrupted.length > 0) {
      corrupted[0] = corrupted[0] ^ 0xff; // Invert first byte
    } else {
      corrupted = Buffer.from('CORRUPTED_PHYSICAL_REPLICA');
    }
    fs.writeFileSync(filePath, corrupted);

    // 6. Record audit event: REPLICA_CORRUPTED
    await this.eventRepo.create({
      type: 'REPLICA_CORRUPTED',
      message: `Replica corrupted on ${node.name}`,
      objectId: object.id,
      nodeId: node.id
    });

    // 7. Update object status in DB to DEGRADED
    await this.objectRepo.updateStatus(object.id, 'DEGRADED');

    return {
      objectId: object.id,
      nodeId: node.id,
      nodeName: node.name,
      status: 'CORRUPTED',
      message: `Replica corrupted on ${node.name}`
    };
  }

  /**
   * Helper to map ObjectWithReplicas to StoredObjectDTO with dynamic health calculation.
   */
  private mapToDTO(obj: ObjectWithReplicas): StoredObjectDTO {
    const sizeBytes = Number(obj.size);
    // Healthy replicas: node is HEALTHY, file exists, and checksum matches
    let healthyReplicaCount = 0;
    for (const replica of obj.replicas) {
      const isNodeHealthy = replica.node?.status === 'HEALTHY';
      if (!isNodeHealthy) continue;

      const nodeName = replica.node?.name || 'unknown';
      const nodeDir = this.getNodeStorageDir(nodeName);
      const filePath = path.join(nodeDir, `${obj.id}.blob`);

      if (fs.existsSync(filePath)) {
        try {
          const bytes = fs.readFileSync(filePath);
          const computedHash = crypto.createHash('sha256').update(bytes).digest('hex');
          if (computedHash === obj.checksum) {
            healthyReplicaCount++;
          }
        } catch {
          // ignore read error
        }
      }
    }

    const dynamicStatus =
      healthyReplicaCount >= obj.replicationFactor ? 'HEALTHY' : 'DEGRADED';

    return {
      id: obj.id,
      name: obj.name,
      size: obj.size.toString(),
      sizeBytes,
      contentType: obj.contentType,
      checksum: obj.checksum,
      version: obj.version,
      replicationFactor: obj.replicationFactor,
      status: dynamicStatus,
      createdAt: obj.createdAt.toISOString(),
      updatedAt: obj.updatedAt.toISOString(),
      replicaCount: obj.replicas.length,
      healthyReplicaCount
    };
  }

  /**
   * Helper to map ObjectWithReplicas to StoredObjectDetailDTO with replicas.
   */
  private mapToDetailDTO(obj: ObjectWithReplicas): StoredObjectDetailDTO {
    const base = this.mapToDTO(obj);
    const replicas: ObjectReplicaDTO[] = obj.replicas.map((r) => {
      const isNodeHealthy = r.node?.status === 'HEALTHY';
      const nodeName = r.node?.name || 'unknown';
      const nodeDir = this.getNodeStorageDir(nodeName);
      const filePath = path.join(nodeDir, `${obj.id}.blob`);

      let replicaDisplayStatus = 'HEALTHY';
      if (!isNodeHealthy) {
        replicaDisplayStatus = 'UNAVAILABLE';
      } else if (!fs.existsSync(filePath)) {
        replicaDisplayStatus = 'CORRUPTED';
      } else {
        try {
          const bytes = fs.readFileSync(filePath);
          const computedHash = crypto.createHash('sha256').update(bytes).digest('hex');
          if (computedHash !== obj.checksum) {
            replicaDisplayStatus = 'CORRUPTED';
          }
        } catch {
          replicaDisplayStatus = 'CORRUPTED';
        }
      }

      return {
        id: r.id,
        nodeId: r.nodeId,
        nodeName,
        version: r.version,
        checksum: r.checksum,
        status: replicaDisplayStatus,
        physicalPath: `storage/${nodeName}/${obj.id}.blob`,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      };
    });

    return {
      ...base,
      replicas
    };
  }
}

export const objectService = new ObjectService();
