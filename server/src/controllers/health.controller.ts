import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/health.service';
import { sendSuccess } from '../utils/response';

export class HealthController {
  getHealth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const health = healthService.getHealth();
      sendSuccess(res, health);
    } catch (err) {
      next(err);
    }
  }
}

export const healthController = new HealthController();
