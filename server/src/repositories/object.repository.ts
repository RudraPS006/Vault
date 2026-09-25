import { prisma } from './prisma';
import { Object as ObjectModel, Replica } from '@prisma/client';

export interface CreateObjectInput {
  id: string;
  name: string;
  size: bigint;
  contentType: string;
  checksum: string;
  version?: number;
  replicationFactor?: number;
  status?: string;
  nodeId: string;
  nodeName: string;
}

export type ObjectWithReplicas = ObjectModel & {
  replicas: (Replica & {
    node?: {
      name: string;
      status?: string;
    };
  })[];
};

export class ObjectRepository {
  async countObjects(): Promise<number> {
    return prisma.object.count();
  }

  async countReplicas(): Promise<number> {
    return prisma.replica.count();
  }

  async countReplicasByStatus(status: string): Promise<number> {
    return prisma.replica.count({
      where: { status }
    });
  }

  /**
   * Atomically create Object, initial Replica, update Node used capacity, and record audit Event.
   */
  async createWithReplica(input: CreateObjectInput): Promise<ObjectWithReplicas> {
    return prisma.$transaction(async (tx) => {
      // 1. Create the Object record
      const object = await tx.object.create({
        data: {
          id: input.id,
          name: input.name,
          size: input.size,
          contentType: input.contentType,
          checksum: input.checksum,
          version: input.version ?? 1,
          replicationFactor: input.replicationFactor ?? 3,
          status: input.status ?? 'DEGRADED'
        }
      });

      // 2. Create the primary Replica record
      const replica = await tx.replica.create({
        data: {
          objectId: object.id,
          nodeId: input.nodeId,
          version: input.version ?? 1,
          checksum: input.checksum,
          status: 'HEALTHY'
        },
        include: {
          node: {
            select: { name: true, status: true }
          }
        }
      });

      // 3. Atomically increment storage node usedCapacity
      await tx.node.update({
        where: { id: input.nodeId },
        data: {
          usedCapacity: { increment: input.size },
          lastHeartbeat: new Date()
        }
      });

      // 4. Record audit event
      await tx.event.create({
        data: {
          type: 'OBJECT_UPLOADED',
          message: `Object ${input.name} uploaded to ${input.nodeName}`,
          objectId: object.id,
          nodeId: input.nodeId
        }
      });

      return {
        ...object,
        replicas: [replica]
      };
    });
  }

  /**
   * Atomically create a new Replica, increment destination node usedCapacity, and record audit Event.
   */
  async addReplicaWithCapacity(input: {
    objectId: string;
    nodeId: string;
    nodeName: string;
    version: number;
    checksum: string;
    size: bigint;
    isFullyReplicated: boolean;
  }): Promise<Replica & { node?: { name: string; status?: string } }> {
    return prisma.$transaction(async (tx) => {
      // 1. Create the Replica record
      const replica = await tx.replica.create({
        data: {
          objectId: input.objectId,
          nodeId: input.nodeId,
          version: input.version,
          checksum: input.checksum,
          status: 'HEALTHY'
        },
        include: {
          node: {
            select: { name: true, status: true }
          }
        }
      });

      // 2. Increment destination node usedCapacity
      await tx.node.update({
        where: { id: input.nodeId },
        data: {
          usedCapacity: { increment: input.size },
          lastHeartbeat: new Date()
        }
      });

      // 3. If target replication factor is fulfilled, promote status to HEALTHY
      if (input.isFullyReplicated) {
        await tx.object.update({
          where: { id: input.objectId },
          data: { status: 'HEALTHY' }
        });
      }

      // 4. Record audit event
      await tx.event.create({
        data: {
          type: 'REPLICA_CREATED',
          message: `Replica created on ${input.nodeName}`,
          objectId: input.objectId,
          nodeId: input.nodeId
        }
      });

      return replica;
    });
  }

  /**
   * Atomically delete a Replica, decrement destination node usedCapacity, and record audit Event.
   */
  async removeReplicaWithCapacity(input: {
    replicaId: string;
    nodeId: string;
    nodeName: string;
    objectId: string;
    size: bigint;
  }): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // 1. Delete replica record
      await tx.replica.delete({
        where: { id: input.replicaId }
      });

      // 2. Decrement node usedCapacity
      await tx.node.update({
        where: { id: input.nodeId },
        data: {
          usedCapacity: { decrement: input.size },
          lastHeartbeat: new Date()
        }
      });

      // 3. Record audit event: REPLICA_REMOVED
      await tx.event.create({
        data: {
          type: 'REPLICA_REMOVED',
          message: `Excess replica removed from ${input.nodeName}`,
          objectId: input.objectId,
          nodeId: input.nodeId
        }
      });
    });
  }

  /**
   * Update object status
   */
  async updateStatus(id: string, status: string): Promise<ObjectModel> {
    return prisma.object.update({
      where: { id },
      data: { status }
    });
  }

  /**
   * Find all stored objects with replica details.
   */
  async findAll(): Promise<ObjectWithReplicas[]> {
    return prisma.object.findMany({
      include: {
        replicas: {
          include: {
            node: {
              select: { name: true, status: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Find a specific object by ID with replicas and node information.
   */
  async findById(id: string): Promise<ObjectWithReplicas | null> {
    return prisma.object.findUnique({
      where: { id },
      include: {
        replicas: {
          include: {
            node: {
              select: { name: true, status: true }
            }
          }
        }
      }
    });
  }

  /**
   * Atomically delete object, decrement storage node usedCapacity across all replica nodes, and log event.
   */
  async deleteWithCleanup(id: string): Promise<ObjectWithReplicas | null> {
    return prisma.$transaction(async (tx) => {
      const object = await tx.object.findUnique({
        where: { id },
        include: {
          replicas: {
            include: {
              node: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (!object) return null;

      // Decrement usedCapacity on all replica nodes
      for (const replica of object.replicas) {
        await tx.node.update({
          where: { id: replica.nodeId },
          data: {
            usedCapacity: { decrement: object.size },
            lastHeartbeat: new Date()
          }
        });
      }

      // Delete object (cascades to Replica records in SQLite)
      await tx.object.delete({
        where: { id }
      });

      // Record audit event
      await tx.event.create({
        data: {
          type: 'OBJECT_DELETED',
          message: `Object ${object.name} deleted from cluster`,
          objectId: null,
          nodeId: object.replicas[0]?.nodeId ?? null
        }
      });

      return object;
    });
  }
}

export const objectRepository = new ObjectRepository();
