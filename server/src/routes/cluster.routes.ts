import { Router } from 'express';
import { clusterController } from '../controllers/cluster.controller';

const router = Router();

// GET /api/cluster/health
router.get('/health', (req, res, next) => clusterController.getClusterHealth(req, res, next));

// GET /api/cluster/events
router.get('/events', (req, res, next) => clusterController.getRecentEvents(req, res, next));

export default router;
