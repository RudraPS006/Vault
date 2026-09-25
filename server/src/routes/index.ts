import { Router } from 'express';
import healthRoutes from './health.routes';
import nodeRoutes from './node.routes';
import clusterRoutes from './cluster.routes';
import objectRoutes from './object.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/nodes', nodeRoutes);
router.use('/cluster', clusterRoutes);
router.use('/objects', objectRoutes);

export default router;
