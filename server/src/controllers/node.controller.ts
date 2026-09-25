import { Request, Response, NextFunction } from 'express';
import { nodeService } from '../services/node.service';
import { sendSuccess, sendError } from '../utils/response';

export class NodeController {
  async getNodes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nodes = await nodeService.getAllNodes();
      sendSuccess(res, nodes);
    } catch (err) {
      next(err);
    }
  }

  async getNodeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const node = await nodeService.getNodeById(id);
      if (!node) {
        sendError(res, `Node with id '${id}' not found`, 404);
        return;
      }
      sendSuccess(res, node);
    } catch (err) {
      next(err);
    }
  }

  async failNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await nodeService.failNode(id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async recoverNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await nodeService.recoverNode(id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const nodeController = new NodeController();
