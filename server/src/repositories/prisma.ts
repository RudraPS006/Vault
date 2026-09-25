import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

declare global {
  // eslint-disable-next-line no-var
  var __vaultPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__vaultPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  global.__vaultPrisma = prisma;
}
