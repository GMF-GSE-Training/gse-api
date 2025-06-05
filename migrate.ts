import { execSync } from 'child_process';

import { config } from 'dotenv';

config(); // Memuat variabel lingkungan dari .env

const env: string = process.env.NODE_ENV || 'development';
let command: string;

if (env === 'development') {
  command = 'npx prisma migrate dev --name update_relations';
} else {
  command = 'npx prisma migrate deploy';
}

try {
  execSync(command, { stdio: 'inherit' });
  console.log(`Migration for ${env} completed successfully.`);
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Migration for ${env} failed:`, errorMessage);
  process.exit(1);
}
