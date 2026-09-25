import { Request, Response, NextFunction } from 'express';
import { clusterService } from '../services/cluster.service';
import { sendSuccess } from '../utils/response';

export class ClusterController {
  async getClusterHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clusterHealth = await clusterService.getClusterHealth();
      sendSuccess(res, clusterHealth);
    } catch (err) {
      next(err);
    }
  }

  async getRecentEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const events = await clusterService.getRecentEvents(limit);
      sendSuccess(res, events);
    } catch (err) {
      next(err);
    }
  }
}

export const clusterController = new ClusterController();
