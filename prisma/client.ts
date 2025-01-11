// prisma/client.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv'; // Import dotenv

// Load environment variables from .env file
dotenv.config();

// Konfigurasi Prisma Client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Mengambil URL database dari .env
    },
  },
  log: ['query', 'info', 'warn', 'error'], // Logging Prisma
});

export default prisma;