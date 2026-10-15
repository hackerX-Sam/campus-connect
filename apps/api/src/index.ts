import 'dotenv/config';
import app from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const PORT = parseInt(process.env.API_PORT ?? '3001', 10);

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`API server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

main();
