import { prisma } from './prisma';
import { Event } from '@prisma/client';

export class EventRepository {
  async findRecent(limit = 20): Promise<Event[]> {
    return prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        node: {
          select: { name: true }
        }
      }
    });
  }

  async create(data: {
    type: string;
    message: string;
    objectId?: string | null;
    nodeId?: string | null;
  }): Promise<Event> {
    return prisma.event.create({
      data: {
        type: data.type,
        message: data.message,
        objectId: data.objectId ?? null,
        nodeId: data.nodeId ?? null
      }
    });
  }

  async count(): Promise<number> {
    return prisma.event.count();
  }
}

export const eventRepository = new EventRepository();
