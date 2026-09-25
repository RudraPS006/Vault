import { Router } from 'express';
import { nodeController } from '../controllers/node.controller';

const router = Router();

// GET /api/nodes
router.get('/', (req, res, next) => nodeController.getNodes(req, res, next));

// GET /api/nodes/:id
router.get('/:id', (req, res, next) => nodeController.getNodeById(req, res, next));

// POST /api/nodes/:id/fail
router.post('/:id/fail', (req, res, next) => nodeController.failNode(req, res, next));

// POST /api/nodes/:id/recover
router.post('/:id/recover', (req, res, next) => nodeController.recoverNode(req, res, next));

export default router;
