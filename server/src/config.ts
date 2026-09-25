import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  clientUrl: string;
  storageBasePath: string;
  databaseUrl: string;
  serviceName: string;
  version: string;
}

// Canonical resolution to the root storage directory
const rootStorageDir = path.resolve(__dirname, '../../storage');

export const config: Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  storageBasePath: rootStorageDir,
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  serviceName: 'vault-api',
  version: '0.1.0'
};
