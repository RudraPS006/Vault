import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { objectController } from '../controllers/object.controller';
import { sendError } from '../utils/response';

const router = Router();

// Configure Multer with memory storage and 100MB development file limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  }
});

// Middleware to trap Multer errors gracefully
const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          sendError(res, 'File size exceeds maximum allowed limit of 100MB', 413);
          return;
        }
        sendError(res, `Upload error: ${err.message}`, 400);
        return;
      }
      next(err);
      return;
    }
    next();
  });
};

// POST /api/objects - Upload object
router.post('/', handleUpload, (req, res, next) => objectController.upload(req, res, next));

// GET /api/objects - List stored objects
router.get('/', (req, res, next) => objectController.list(req, res, next));

// GET /api/objects/:id - Get object metadata & replica status
router.get('/:id', (req, res, next) => objectController.getById(req, res, next));

// GET /api/objects/:id/download - Stream object file
router.get('/:id/download', (req, res, next) => objectController.download(req, res, next));

// POST /api/objects/:id/replicate - Trigger replication across nodes
router.post('/:id/replicate', (req, res, next) => objectController.replicate(req, res, next));

// POST /api/objects/:id/repair - Trigger repair across nodes
router.post('/:id/repair', (req, res, next) => objectController.repair(req, res, next));

// GET /api/objects/:id/replicas - Get replica list
router.get('/:id/replicas', (req, res, next) => objectController.getReplicas(req, res, next));

// POST /api/objects/:id/replicas/:nodeId/corrupt - Corrupt physical replica for testing
router.post('/:id/replicas/:nodeId/corrupt', (req, res, next) => objectController.corruptReplica(req, res, next));

// DELETE /api/objects/:id - Delete object and clean up physical storage across all replicas
router.delete('/:id', (req, res, next) => objectController.delete(req, res, next));

export default router;
