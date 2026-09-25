import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import apiRoutes from './routes';
import { requestLogger } from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { nodeService } from './services/node.service';
import { prisma } from './repositories/prisma';

const app = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      // Allow configured client URL or local Vite dev servers
      if (
        origin === config.clientUrl ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly permissive CORS
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API Routes
app.use('/api', apiRoutes);

// 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Ensure storage directories exist on the filesystem for all logical nodes.
 */
function ensureStorageDirectories(): void {
  const nodes = ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'];
  for (const nodeName of nodes) {
    const nodeDir = path.join(config.storageBasePath, nodeName);
    if (!fs.existsSync(nodeDir)) {
      fs.mkdirSync(nodeDir, { recursive: true });
    }
  }
}

/**
 * Bootstrap and start the Vault server.
 */
async function bootstrap(): Promise<void> {
  try {
    console.log('--------------------------------------------------');
    console.log('⚡ Starting Vault Storage API Server...');
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Configured Port: ${config.port}`);
    console.log('--------------------------------------------------');

    // 1. Ensure storage directories exist
    ensureStorageDirectories();
    console.log('✓ Storage node directories verified');

    // 2. Connect to database and seed default storage nodes
    await prisma.$connect();
    console.log('✓ Connected to SQLite database');

    await nodeService.initializeDefaultNodes();
    console.log('✓ Default storage nodes registered (node-a through node-e: HEALTHY)');

    // 3. Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`🚀 Vault API active at http://localhost:${config.port}`);
      console.log(`   - Health check:  http://localhost:${config.port}/api/health`);
      console.log(`   - Node registry: http://localhost:${config.port}/api/nodes`);
      console.log(`   - Cluster info:  http://localhost:${config.port}/api/cluster/health`);
      console.log('--------------------------------------------------');
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully stopping Vault API...`);
      server.close(async () => {
        console.log('✓ Closed HTTP server connections');
        await prisma.$disconnect();
        console.log('✓ Disconnected database');
        process.exit(0);
      });

      // Force exit after 5 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error('Forcefully terminating server after timeout.');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Fatal error during Vault server startup:', err);
    process.exit(1);
  }
}

bootstrap();

export default app;
