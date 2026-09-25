import { Request, Response, NextFunction } from 'express';
import { objectService } from '../services/object.service';
import { replicationService } from '../services/replication.service';
import { repairService } from '../services/repair.service';
import { sendSuccess } from '../utils/response';

export class ObjectController {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await objectService.uploadObject(req.file);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const objects = await objectService.listObjects();
      sendSuccess(res, objects);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const object = await objectService.getObjectById(req.params.id);
      sendSuccess(res, object);
    } catch (err) {
      next(err);
    }
  }

  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stream, name, contentType, size, checksum } =
        await objectService.getObjectDownloadStream(req.params.id);

      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Content-Length', size.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
      res.setHeader('ETag', `"${checksum}"`);

      stream.on('error', (streamErr) => {
        next(streamErr);
      });

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await objectService.deleteObject(req.params.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async replicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await replicationService.replicateObject(req.params.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getReplicas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const replicas = await replicationService.getReplicas(req.params.id);
      sendSuccess(res, replicas);
    } catch (err) {
      next(err);
    }
  }

  async repair(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await repairService.repairObject(req.params.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async corruptReplica(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await objectService.corruptReplica(req.params.id, req.params.nodeId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const objectController = new ObjectController();
