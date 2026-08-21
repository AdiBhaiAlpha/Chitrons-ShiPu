import { startServer } from './server';

startServer().catch((err: any) => {
  console.error('[BOOTSTRAP] Failed to start server:', err);
  process.exit(1);
});
