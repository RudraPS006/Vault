import { nodeService } from '../services/node.service';
import { prisma } from '../repositories/prisma';

async function seed() {
  console.log('Seeding initial storage nodes...');
  await prisma.$connect();
  await nodeService.initializeDefaultNodes();
  console.log('Seed completed successfully.');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
