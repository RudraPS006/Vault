import { prisma } from './prisma';
import { Node } from '@prisma/client';

export class NodeRepository {
  async findAll(): Promise<Node[]> {
    return prisma.node.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<Node | null> {
    return prisma.node.findUnique({
      where: { id }
    });
  }

  async findByName(name: string): Promise<Node | null> {
    return prisma.node.findUnique({
      where: { name }
    });
  }

  async findByIdOrName(idOrName: string): Promise<Node | null> {
    const byId = await prisma.node.findUnique({ where: { id: idOrName } });
    if (byId) return byId;
    return prisma.node.findUnique({ where: { name: idOrName } });
  }

  async upsert(data: {
    name: string;
    status?: string;
    capacity?: bigint;
    usedCapacity?: bigint;
  }): Promise<Node> {
    return prisma.node.upsert({
      where: { name: data.name },
      update: {
        status: data.status,
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.usedCapacity !== undefined ? { usedCapacity: data.usedCapacity } : {}),
        lastHeartbeat: new Date()
      },
      create: {
        name: data.name,
        status: data.status || 'HEALTHY',
        capacity: data.capacity || BigInt(10737418240), // 10 GB
        usedCapacity: data.usedCapacity || BigInt(0),
        lastHeartbeat: new Date()
      }
    });
  }

  async updateStatus(id: string, status: string): Promise<Node> {
    return prisma.node.update({
      where: { id },
      data: { status, updatedAt: new Date() }
    });
  }

  async updateHeartbeat(id: string): Promise<Node> {
    return prisma.node.update({
      where: { id },
      data: { lastHeartbeat: new Date() }
    });
  }

  async count(): Promise<number> {
    return prisma.node.count();
  }

  async countByStatus(status: string): Promise<number> {
    return prisma.node.count({
      where: { status }
    });
  }

  async incrementUsedCapacity(id: string, bytes: bigint): Promise<Node> {
    return prisma.node.update({
      where: { id },
      data: {
        usedCapacity: { increment: bytes },
        lastHeartbeat: new Date()
      }
    });
  }

  async decrementUsedCapacity(id: string, bytes: bigint): Promise<Node> {
    return prisma.node.update({
      where: { id },
      data: {
        usedCapacity: { decrement: bytes },
        lastHeartbeat: new Date()
      }
    });
  }
}

export const nodeRepository = new NodeRepository();
