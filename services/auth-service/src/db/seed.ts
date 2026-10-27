import 'reflect-metadata';
import { AppDataSource } from '../config/data-source';
import { ensureSeedAdmin } from './seed-admin';

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    await ensureSeedAdmin();
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
