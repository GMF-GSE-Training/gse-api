console.log('=== SEED SCRIPT STARTED ===');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

import { PrismaClient, SignatureType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { randomUUID } from 'crypto';
import * as os from 'os';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { faker } from '@faker-js/faker';
import { Client as MinioClient } from 'minio';
import { StorageClient } from '@supabase/storage-js';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Constants
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const EXPONENTIAL_BACKOFF_BASE = 2;

// Initialize clients
const prisma = new PrismaClient();
console.log('=== INISIALISASI PRISMA SELESAI ===');
const dummyDir = path.join(__dirname, 'dummy-data');
const sampleDir = path.join(__dirname, '..', 'public', 'assets', 'images');

// Enhanced logging interface
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  timestamp?: Date;
}

class Logger {
  private static logs: LogEntry[] = [];

  static log(entry: LogEntry) {
    const logEntry = { ...entry, timestamp: new Date() };
    this.logs.push(logEntry);
    
    const timestamp = logEntry.timestamp.toISOString();
    const prefix = `[${timestamp}] ${entry.level.toUpperCase()}:`;
    
    switch (entry.level) {
      case 'error':
        console.error(prefix, entry.message, entry.data || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.data || '');
        break;
      case 'debug':
        if (process.env.DEBUG === 'true') {
          console.debug(prefix, entry.message, entry.data || '');
        }
        break;
      default:
        console.log(prefix, entry.message, entry.data || '');
    }
  }

  static info(message: string, data?: any) {
    this.log({ level: 'info', message, data });
  }

  static warn(message: string, data?: any) {
    this.log({ level: 'warn', message, data });
  }

  static error(message: string, data?: any) {
    this.log({ level: 'error', message, data });
  }

  static debug(message: string, data?: any) {
    this.log({ level: 'debug', message, data });
  }

  static async exportLogs(filePath: string) {
    await fs.writeFile(filePath, JSON.stringify(this.logs, null, 2));
  }
}

// Predefined assets
const predefinedFiles = {
  foto: 'foto.jpg',
  ktp: 'ktp.jpg',
  simA: 'SIM_A.jpg',
  simB: 'SIM_B.jpg',
  suratSehatButaWarna: 'surat_ket_sehat.jpg',
  suratBebasNarkoba: 'surat_bebas_narkoba.jpg',
} as const;

// Storage configuration
interface StorageConfig {
  client: MinioClient | StorageClient;
  bucket: string;
  type: 'minio' | 'supabase';
}

// Enhanced configuration validation
function validateConfiguration() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'STORAGE_TYPE',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const storageType = process.env.STORAGE_TYPE || 'minio';
  
  if (storageType === 'supabase') {
    const supabaseVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_BUCKET'];
    const missingSupabaseVars = supabaseVars.filter(varName => !process.env[varName]);
    if (missingSupabaseVars.length > 0) {
      throw new Error(`Missing Supabase configuration: ${missingSupabaseVars.join(', ')}`);
    }
  } else {
    const minioVars = ['MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET'];
    const missingMinioVars = minioVars.filter(varName => !process.env[varName]);
    if (missingMinioVars.length > 0) {
      throw new Error(`Missing MinIO configuration: ${missingMinioVars.join(', ')}`);
    }
  }

  if (!process.env.FRONTEND_URL) {
    Logger.warn('FRONTEND_URL not set, using default local URL');
  }
}

// Initialize storage client with enhanced validation
function initializeStorageClient(): StorageConfig {
  const storageType = process.env.STORAGE_TYPE || 'minio';
  
  if (storageType === 'supabase') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const supabaseBucket = process.env.SUPABASE_BUCKET;
    
    return {
      client: new StorageClient(`${supabaseUrl}/storage/v1`, {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      }),
      bucket: supabaseBucket,
      type: 'supabase',
    };
  } else {
    const endpoint = process.env.MINIO_ENDPOINT;
    const port = process.env.MINIO_PORT;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    const bucket = process.env.MINIO_BUCKET;
    
    return {
      client: new MinioClient({
        endPoint: endpoint,
        port: Number(port),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey,
        secretKey,
      }),
      bucket,
      type: 'minio',
    };
  }
}

// Tambahkan di sini agar storageConfig global
const storageConfig = initializeStorageClient();
console.log('=== INISIALISASI STORAGE SELESAI ===');

// Utility functions with enhanced retry mechanism
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced retry with exponential backoff and error classification
async function retry<T>(
  fn: () => Promise<T>, 
  retries = MAX_RETRIES,
  operation = 'unknown'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        Logger.info(`Operation ${operation} succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error as Error);
      if (!isRetryable || attempt === retries) {
        Logger.error(`Operation ${operation} failed permanently`, {
          attempt: attempt + 1,
          error: lastError.message,
          retryable: isRetryable
        });
        throw lastError;
      }
      
      const delay = RETRY_DELAY * Math.pow(EXPONENTIAL_BACKOFF_BASE, attempt);
      Logger.warn(`Operation ${operation} failed, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        totalRetries: retries + 1,
        error: lastError.message
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

// Enhanced error classification
function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /ECONNRESET/,
    /ETIMEDOUT/,
    /ENOTFOUND/,
    /socket hang up/,
    /network/i,
    /timeout/i,
    /temporary/i,
    /rate limit/i
  ];
  
  return retryablePatterns.some(pattern => pattern.test(error.message));
}

// Enhanced file upload with buffer support and detailed logging
async function uploadToStorage(localPath: string, destName: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Check if file exists
    await fs.access(localPath);
  } catch {
    Logger.warn(`File not found: ${localPath}`);
    return '';
  }

  return retry(async () => {
    if (storageConfig.type === 'supabase') {
      const fileBuffer = await fs.readFile(localPath);
      const { data, error } = await (storageConfig.client as StorageClient)
        .from(storageConfig.bucket)
        .upload(destName, fileBuffer, {
          contentType: getContentType(path.extname(localPath)),
          upsert: true,
        });
      
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
      
      const duration = (Date.now() - startTime) / 1000;
      Logger.debug(`Uploaded ${destName} to Supabase in ${duration}s`);
      return data.path;
    } else {
      await (storageConfig.client as MinioClient).fPutObject(
        storageConfig.bucket, 
        destName, 
        localPath
      );
      
      const duration = (Date.now() - startTime) / 1000;
      Logger.debug(`Uploaded ${destName} to MinIO in ${duration}s`);
  return destName;
    }
  }, MAX_RETRIES, `upload-${destName}`);
}

// Enhanced QR code upload with buffer (no temp file)
async function uploadQRCodeBuffer(qrBuffer: Buffer, destName: string): Promise<string> {
  const startTime = Date.now();
  
  return retry(async () => {
    if (storageConfig.type === 'supabase') {
      const { data, error } = await (storageConfig.client as StorageClient)
        .from(storageConfig.bucket)
        .upload(destName, qrBuffer, {
          contentType: 'image/png',
          upsert: true,
        });
      
      if (error) throw new Error(`Supabase QR upload failed: ${error.message}`);
      
      const duration = (Date.now() - startTime) / 1000;
      Logger.debug(`Uploaded QR ${destName} to Supabase in ${duration}s`);
      return data.path;
    } else {
      await (storageConfig.client as MinioClient).putObject(
        storageConfig.bucket,
        destName,
        qrBuffer,
        qrBuffer.length,
        { 'Content-Type': 'image/png' }
      );
      
      const duration = (Date.now() - startTime) / 1000;
      Logger.debug(`Uploaded QR ${destName} to MinIO in ${duration}s`);
      return destName;
    }
  }, MAX_RETRIES, `qr-upload-${destName}`);
}

// Helper function to determine content type
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

// Sanitizer functions
const sanitizers = {
  toInt: (v: any): number | null => {
  if (v === '' || v === undefined || v === null) return null;
  const n = parseInt(v as string, 10);
  return isNaN(n) ? null : n;
  },
  
  toFloat: (v: any): number | null => {
  if (v === '' || v === undefined || v === null) return null;
  const f = parseFloat(v as string);
  return isNaN(f) ? null : f;
  },
  
  toBool: (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['true', 't', '1', 'yes', 'y'].includes(v.toLowerCase());
  return false;
  },
  
  toDateObj: (d: string | null): Date | null => {
  if (!d || d.trim() === '') return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
  }
};

// Enhanced JSON loader with better error handling
async function loadJson<T>(file: string): Promise<T[]> {
  const filePath = path.join(dummyDir, file);
  
  try {
    await fs.access(filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as T[];
    Logger.info(`Loaded ${parsed.length} items from ${file}`);
    return parsed;
  } catch (error) {
    Logger.warn(`Dummy data file not found or invalid: ${file}. Returning empty array.`, {
      error: (error as Error).message
    });
    return [] as T[];
  }
}

// Enhanced batch processing with better progress tracking
async function processBatch<T, R>(
  items: T[], 
  processor: (item: T, index: number) => Promise<R>, 
  batchSize = BATCH_SIZE,
  operation = 'batch-processing'
): Promise<R[]> {
  const results: R[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);
  const startTime = Date.now();
  
  Logger.info(`Starting ${operation} for ${items.length} items in ${totalBatches} batches`);
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batchStartTime = Date.now();
    const currentBatch = Math.floor(i / batchSize) + 1;
    const batch = items.slice(i, i + batchSize);
    
    Logger.info(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} items)`);
    
    try {
      const batchResults = await Promise.all(
        batch.map((item, index) => processor(item, i + index))
      );
      results.push(...batchResults);
      
      const batchDuration = (Date.now() - batchStartTime) / 1000;
      const avgTimePerItem = batchDuration / batch.length;
      Logger.debug(`Batch ${currentBatch} completed in ${batchDuration}s (${avgTimePerItem.toFixed(3)}s per item)`);
      
    } catch (error) {
      Logger.error(`Batch ${currentBatch} failed`, {
        error: (error as Error).message,
        batchSize: batch.length,
        startIndex: i
      });
      throw error;
    }
    
    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < items.length) {
      await sleep(100);
    }
  }
  
  const totalDuration = (Date.now() - startTime) / 1000;
  Logger.info(`${operation} completed in ${totalDuration}s for ${items.length} items`);
  
  return results;
}

// Enhanced backup functionality
async function backupTableIfRequested(tableName: string) {
  if (process.env.BACKUP_BEFORE_SEED === 'true') {
    try {
      const backupDir = path.join(__dirname, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupDir, `${tableName}_${timestamp}.json`);
      
      Logger.info(`Creating backup for table: ${tableName}`);
      
      // Note: This is a simplified backup. In production, you'd want proper SQL dumps
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
      await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
      
      Logger.info(`Backup created: ${backupFile}`);
    } catch (error) {
      Logger.warn(`Failed to backup table ${tableName}`, { error: (error as Error).message });
    }
  }
}

/**
 * ENV yang didukung untuk jumlah data dummy:
 * - DUMMY_ROLE_COUNT
 * - DUMMY_CAPABILITY_COUNT
 * - DUMMY_COT_COUNT
 * - DUMMY_SIGNATURE_COUNT
 * - DUMMY_CERTIFICATE_COUNT
 * - DUMMY_PARTICIPANTSCOT_COUNT
 * - DUMMY_CURRICULUMSYLLABUS_COUNT
 * - DUMMY_USER_COUNT
 * - DUMMY_PARTICIPANT_COUNT
 * - IGNORE_DUMMY_JSON (true/false)
 */

// Utility untuk load data dari JSON atau generate otomatis
async function loadOrGenerate<T>(file: string, generator: () => T[], countEnv: string, defaultCount: number): Promise<T[]> {
  if (process.env.IGNORE_DUMMY_JSON === 'true') {
    Logger.info(`IGNORE_DUMMY_JSON aktif, generate data dummy untuk ${file}`);
    return generator();
  }
  const data = await loadJson<T>(file);
  if (data.length > 0) {
    Logger.info(`Menggunakan data dari ${file} (${data.length} item)`);
    return data;
  }
  Logger.info(`File ${file} kosong, generate data dummy (${defaultCount} item)`);
  return generator();
}

// Refactor seedRoles agar role wajib selalu ada
async function seedRoles() {
  Logger.info('Starting roles seeding');
  await backupTableIfRequested('roles');
  const coreRoles = ['super admin', 'supervisor', 'lcu', 'user'];
  for (const name of coreRoles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    Logger.info(`Ensured role exists: ${name}`);
  }
  // Tambahkan role lain dari roles.json jika ada
  const raw = await loadJson<any>('roles.json');
  const additionalRoles = raw.filter((r: any) => !coreRoles.includes(typeof r === 'string' ? r : r.name));
  const data = additionalRoles.map((r: any) => ({
    name: typeof r === 'string' ? r : r.name,
  }));
  if (data.length > 0) {
    await processBatch(data, async (role) => {
      await prisma.role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      });
    }, BATCH_SIZE, 'seed-additional-roles');
    Logger.info(`Seeded ${data.length} additional roles`);
  } else {
    Logger.info('No additional roles to seed');
  }
}

// Refactor seedCapabilities
async function seedCapabilities() {
  Logger.info('Starting capabilities seeding');
  await backupTableIfRequested('capabilities');
  const count = parseInt(process.env.DUMMY_CAPABILITY_COUNT || '3', 10);
    const numFields = [
      'totalDuration',
      'totalPracticeDurationCompetency',
      'totalPracticeDurationRegGse',
      'totalTheoryDurationCompetency',
      'totalTheoryDurationRegGse',
    ];
  const raw = await loadJson<any>('capabilities.json');
  let data: any[] = [];
  if (raw.length > 0) {
    data = raw.map(c => {
      const item: any = { ...c };
      numFields.forEach(f => {
        item[f] = item[f] !== undefined && item[f] !== null ? Number(item[f]) : null;
      });
      return item;
    });
    Logger.info(`Menggunakan data dari capabilities.json (${data.length} item)`);
  } else {
    data = Array.from({ length: count }, (_, i) => {
      // Generate training name yang sesuai dengan schema length constraint (max 50 chars)
      const trainingOptions = [
        'Forklift Training',
        'GSE Basic Training', 
        'Aircraft Ground Handling',
        'Baggage Tractor',
        'Pushback Training',
        'Catering Truck',
        'Air Conditioning Unit',
        'Ground Power Unit',
        'Cargo Loader',
        'Belt Loader',
        'Conveyor Belt',
        'Lavatory Service',
        'Water Service',
        'Fuel Truck',
        'De-icing Equipment'
      ];
      
      const selectedTraining = faker.helpers.arrayElement(trainingOptions);
      const trainingName = selectedTraining.length > 45 
        ? selectedTraining.substring(0, 45) + '...' 
        : selectedTraining;
      
      return {
        id: faker.string.uuid(),
        ratingCode: `RC${(i + 1).toString().padStart(2, '0')}`,
        trainingCode: `TC${(i + 1).toString().padStart(3, '0')}`,
        trainingName: trainingName,
        totalTheoryDurationRegGse: faker.number.int({ min: 10, max: 100 }),
        totalPracticeDurationRegGse: faker.number.int({ min: 10, max: 100 }),
        totalTheoryDurationCompetency: faker.number.int({ min: 10, max: 100 }),
        totalPracticeDurationCompetency: faker.number.int({ min: 10, max: 100 }),
        totalDuration: faker.number.int({ min: 50, max: 500 }),
      };
    });
    Logger.info(`File capabilities.json kosong, generate data dummy (${count} item)`);
  }
  if (data.length > 0) {
    await processBatch(data, async (capability) => {
      await prisma.capability.create({ data: capability });
    }, BATCH_SIZE, 'seed-capabilities');
    Logger.info(`Seeded ${data.length} capabilities`);
  } else {
    Logger.info('No capabilities to seed');
  }
}

/**
 * Seeder ini telah dioptimalkan untuk membuat data dummy User & Participant secara otomatis,
 * tanpa mengandalkan file JSON besar. Data User peserta akan selalu dibuat berelasi dengan Participant baru,
 * dan field relasi (participantId, idNumber) akan diisi dengan data valid (bukan 'dummy', '0', atau null).
 * Untuk user non-peserta (admin, supervisor, dsb), field relasi dibiarkan null.
 * Data penting dari users.json (superadmin, supervisor, dsb) tetap dipertahankan, namun relasi diatur otomatis.
 *
 * Opsi jumlah data dummy dapat diatur via ENV/flag jika diperlukan.
 */
// Refactor seedParticipantsAndUsers agar jumlah batch user penting dan user massal bisa diatur dari ENV
async function seedParticipantsAndUsers() {
  Logger.info('Starting participants & users seeding (multi-role batch, ENV configurable)');
  await backupTableIfRequested('participants');
  await backupTableIfRequested('users');

  // Fetch role IDs
  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map(r => [r.name.toLowerCase(), r.id]));
  const dinasList = ['TA', 'TB', 'TC', 'TF', 'TJ', 'TL', 'TM', 'TR', 'TU', 'TV', 'TZ'];

  // Ambil jumlah dari ENV atau default
  const superadminCount = parseInt(process.env.DUMMY_SUPERADMIN_COUNT || '1', 10);
  const supervisorCount = parseInt(process.env.DUMMY_SUPERVISOR_COUNT || '1', 10);
  const lcuCount = parseInt(process.env.DUMMY_LCU_COUNT || '1', 10);
  const userCount = parseInt(process.env.DUMMY_USER_COUNT || '5', 10);

  // Batch user penting
  const importantUsers: any[] = [];
  for (let i = 1; i <= superadminCount; i++) {
    importantUsers.push({
      email: `superadmin${i}@example.com`,
      idNumber: `SA${i.toString().padStart(3, '0')}`,
      name: `Super Admin ${i}`,
      password: await bcrypt.hash('Admin12345', 10),
      role: 'super admin',
      nik: `10000000000000${i.toString().padStart(2, '0')}`,
    });
  }
  for (let i = 1; i <= supervisorCount; i++) {
    importantUsers.push({
      email: `supervisor${i}@example.com`,
      idNumber: `SV${i.toString().padStart(3, '0')}`,
      name: `Supervisor ${i}`,
      password: await bcrypt.hash('Supervisor12345', 10),
      role: 'supervisor',
      dinas: dinasList[i % dinasList.length],
      nik: `20000000000000${i.toString().padStart(2, '0')}`,
    });
  }
  for (let i = 1; i <= lcuCount; i++) {
    importantUsers.push({
      email: `lcu${i}@example.com`,
      idNumber: `LCU${i.toString().padStart(3, '0')}`,
      name: `LCU ${i}`,
      password: await bcrypt.hash('Lcu12345', 10),
      role: 'lcu',
      dinas: dinasList[(i + 1) % dinasList.length],
      nik: `30000000000000${i.toString().padStart(2, '0')}`,
    });
  }
  const usedEmails = new Set<string>(importantUsers.map(u => u.email));
  const usedNIKs = new Set<string>(importantUsers.map(u => u.nik));
  const usedIdNumbers = new Set<string>(importantUsers.map(u => u.idNumber));

  // Upsert user penting
  await processBatch(importantUsers, async (user) => {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        idNumber: user.idNumber,
        name: user.name,
        password: user.password,
        roleId: roleMap[user.role.toLowerCase()],
        dinas: user.dinas || null,
        nik: user.nik,
        verifiedAccount: true,
      },
      update: {
        password: user.password,
        roleId: roleMap[user.role.toLowerCase()],
        dinas: user.dinas || undefined,
        nik: user.nik,
      },
    });
    Logger.info(`Seeded important user: ${user.email}`);
  }, BATCH_SIZE, 'seed-important-users');

  // Generate participants dan user role 'user' (berelasi)
  const participantCount = userCount;
  const participants: any[] = [];
  const participantUsers: any[] = [];
  for (let i = 0; i < participantCount; i++) {
      const gender = faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female';
    const participantId = faker.string.uuid();
    const idNumber = `P${(i + 1).toString().padStart(3, '0')}`;
    let email: string;
    do {
      email = `user${i + 1}@example.com`;
    } while (usedEmails.has(email));
    usedEmails.add(email);
    let nik: string;
    do {
      nik = faker.string.numeric(16);
    } while (usedNIKs.has(nik));
    usedNIKs.add(nik);
    let idNum: string;
    do {
      idNum = idNumber;
    } while (usedIdNumbers.has(idNum));
    usedIdNumbers.add(idNum);
    const dinas = faker.helpers.arrayElement(dinasList);
    const participant = {
      id: participantId,
      idNumber: idNum,
        name: faker.person.fullName({ sex: gender }),
      nik,
      dinas,
        bidang: faker.commerce.department(),
        company: faker.company.name(),
      email,
      phoneNumber: '08' + faker.string.numeric(10),
        nationality: 'Indonesia',
        placeOfBirth: faker.location.city(),
      dateOfBirth: faker.date.past({ years: 30, refDate: '2000-01-01' }),
      simAFileName: 'SIM_A.jpg',
      simAPath: `/simA/${participantId}.jpg`,
      simBFileName: 'SIM_B.jpg',
      simBPath: `/simB/${participantId}.jpg`,
      ktpFileName: 'ktp.jpg',
      ktpPath: `/ktp/${participantId}.jpg`,
      fotoFileName: 'foto.jpg',
      fotoPath: `/foto/${participantId}.jpg`,
      suratSehatButaWarnaFileName: 'surat_ket_sehat.jpg',
      suratSehatButaWarnaPath: `/suratSehat/${participantId}.jpg`,
      tglKeluarSuratSehatButaWarna: faker.date.past({ years: 10, refDate: '2015-01-01' }),
      suratBebasNarkobaFileName: 'surat_bebas_narkoba.jpg',
      suratBebasNarkobaPath: `/suratNarkoba/${participantId}.jpg`,
      tglKeluarSuratBebasNarkoba: faker.date.past({ years: 10, refDate: '2015-01-01' }),
      qrCodePath: `/qrcode/${participantId}.png`,
      qrCodeLink: `https://dummy-frontend/participant/detail/${participantId}`,
      gmfNonGmf: faker.helpers.arrayElement(['GMF', 'Non-GMF'])
    };
    // Upload semua file dummy peserta ke storage
    const filesToUpload = [
      { src: 'foto.jpg', dest: `/foto/${participantId}.jpg` },
      { src: 'SIM_A.jpg', dest: `/simA/${participantId}.jpg` },
      { src: 'SIM_B.jpg', dest: `/simB/${participantId}.jpg` },
      { src: 'ktp.jpg', dest: `/ktp/${participantId}.jpg` },
      { src: 'surat_ket_sehat.jpg', dest: `/suratSehat/${participantId}.jpg` },
      { src: 'surat_bebas_narkoba.jpg', dest: `/suratNarkoba/${participantId}.jpg` },
    ];
    for (const file of filesToUpload) {
      await uploadToStorage(path.join(sampleDir, file.src), file.dest);
    }
    participants.push(participant);
    participantUsers.push({
      email,
      idNumber: idNum,
      name: participant.name,
      password: await bcrypt.hash('User12345', 10),
      role: 'user',
      participantId,
      dinas,
      nik,
      verifiedAccount: true,
    });
  }

  // Insert participants
  await processBatch(participants, async (participant) => {
    await prisma.participant.create({ data: participant });
  }, 2, 'insert-participants');
    
  // Ambil semua participantId yang valid
  const allParticipants = await prisma.participant.findMany({ select: { id: true } });
  const validParticipantIds = new Set(allParticipants.map(p => p.id));

  // Data dari users.json, hanya yang valid dan tidak duplikat, dan participantId valid/null
  let usersFromJson = (await loadJson<any>('users.json')).filter(u =>
    u.email && !usedEmails.has(u.email) && u.nik && !usedNIKs.has(u.nik) && u.idNumber && !usedIdNumbers.has(u.idNumber)
  );
  usersFromJson = usersFromJson.filter(u => !u.participantId || validParticipantIds.has(u.participantId));
  // --- PATCH: filter NIK unik antar user JSON ---
  const filteredUsersFromJson: any[] = [];
  for (const u of usersFromJson) {
    if (usedNIKs.has(u.nik)) {
      Logger.warn(`Skip user from JSON karena NIK duplikat: ${u.email} (${u.nik})`);
      continue;
    }
    if (usedIdNumbers.has(u.idNumber)) {
      Logger.warn(`Skip user from JSON karena idNumber duplikat: ${u.email} (${u.idNumber})`);
      continue;
    }
    filteredUsersFromJson.push(u);
    usedEmails.add(u.email);
    usedNIKs.add(u.nik);
    usedIdNumbers.add(u.idNumber);
  }
  usersFromJson = filteredUsersFromJson;
  // --- END PATCH ---

  // Upsert user role 'user' (participant)
  await processBatch(participantUsers, async (user) => {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
      email: user.email,
      idNumber: user.idNumber,
      name: user.name,
      password: user.password,
        roleId: roleMap[user.role.toLowerCase()],
      participantId: user.participantId,
      dinas: user.dinas,
      nik: user.nik,
        verifiedAccount: true,
      },
      update: {
        password: user.password,
        roleId: roleMap[user.role.toLowerCase()],
        participantId: user.participantId,
        dinas: user.dinas,
        nik: user.nik,
      },
    });
  }, 2, 'seed-participant-users');

  // Upsert user dari JSON
  await processBatch(usersFromJson, async (user) => {
    const password = user.password && /^\$2[aby]\$/.test(user.password) ? user.password : await bcrypt.hash(user.password || 'User12345', 10);
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        idNumber: user.idNumber || null,
        name: user.name || user.email,
        password,
        roleId: roleMap[(user.role || 'user').toLowerCase()],
        participantId: user.participantId || null,
        dinas: user.dinas || null,
        nik: user.nik,
        verifiedAccount: true,
      },
      update: {
        password,
        roleId: roleMap[(user.role || 'user').toLowerCase()],
        dinas: user.dinas || undefined,
        nik: user.nik,
      },
    });
  }, BATCH_SIZE, 'seed-json-users');

  Logger.info(`Seeded ${participants.length} participants & ${participantUsers.length + importantUsers.length + usersFromJson.length} users (multi-role batch, ENV configurable)`);
}

// Refactor seedCots
async function seedCots() {
  Logger.info('Starting COTs seeding');
  await backupTableIfRequested('cots');
  const count = parseInt(process.env.DUMMY_COT_COUNT || '3', 10);
  const numFields = [];
  const raw = await loadJson<any>('cots.json');
  let data: any[] = [];
  if (raw.length > 0) {
    data = raw.map(c => {
      const item: any = { ...c };
      // Konversi field tanggal ke Date
      item.startDate = item.startDate ? new Date(item.startDate) : new Date();
      item.endDate = item.endDate ? new Date(item.endDate) : new Date();
      return item;
    });
    Logger.info(`Menggunakan data dari cots.json (${data.length} item)`);
  } else {
    data = Array.from({ length: count }, () => {
      // Generate names yang sesuai dengan schema length constraint (max 50 chars)
      const locations = [
        'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang',
        'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi'
      ];
      
      const generateInstructorName = () => {
        const name = faker.person.fullName();
        return name.length > 45 ? name.substring(0, 45) + '...' : name;
      };
      
      return {
        id: faker.string.uuid(),
        startDate: faker.date.recent({ days: 30 }),
        endDate: faker.date.future({ years: 1 }),
        trainingLocation: faker.helpers.arrayElement(locations),
        theoryInstructorRegGse: generateInstructorName(),
        theoryInstructorCompetency: generateInstructorName(),
        practicalInstructor1: generateInstructorName(),
        practicalInstructor2: generateInstructorName(),
        status: faker.helpers.arrayElement(['Menunggu', 'Berlangsung', 'Selesai']),
      };
    });
    Logger.info(`File cots.json kosong, generate data dummy (${count} item)`);
  }
  if (data.length > 0) {
    await processBatch(data, async (cot) => {
      await prisma.cOT.create({ data: cot });
    }, BATCH_SIZE, 'seed-cots');
    Logger.info(`Seeded ${data.length} COTs`);
  } else {
    Logger.info('No COTs to seed');
  }
}

// Refactor seedCapabilityCots
async function seedCapabilityCots() {
  Logger.info('Starting capabilityCots seeding');
  await backupTableIfRequested('capabilityCots');
  const count = parseInt(process.env.DUMMY_CAPABILITYCOT_COUNT || '20', 10);
  const raw = await loadJson<any>('capabilitycots.json');
  let data = raw.map(r => ({
    capabilityId: r.capabilityId ?? r[0],
    cotId: r.cotId ?? r[1]
  }));
  if (data.length === 0) {
    Logger.warn('No capabilityCots data found, generating dummy links');
    const [caps, cots] = await Promise.all([
      prisma.capability.findMany(),
      prisma.cOT.findMany(),
    ]);
    // --- PATCH: pastikan kombinasi unik ---
    const uniquePairs = new Set<string>();
    const maxPairs = caps.length * cots.length;
    const targetCount = Math.min(count, maxPairs);
    data = [];
    while (data.length < targetCount) {
      const cap = faker.helpers.arrayElement(caps);
      const cot = faker.helpers.arrayElement(cots);
      const key = `${cap.id}_${cot.id}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.add(key);
        data.push({ capabilityId: cap.id, cotId: cot.id });
      }
    }
    // --- END PATCH ---
  }
  if (data.length > 0) {
    await processBatch(data, async (capabilityCot) => {
      await prisma.capabilityCOT.create({ data: capabilityCot });
    }, BATCH_SIZE, 'seed-capability-cots');
    Logger.info(`Seeded ${data.length} capabilityCots`);
  } else {
    Logger.info('No capabilityCots to seed');
  }
}

// Refactor seedSignatures
async function seedSignatures() {
  Logger.info('Starting signatures seeding');
  await backupTableIfRequested('signatures');
  const count = parseInt(process.env.DUMMY_SIGNATURE_COUNT || '2', 10);
  const data = await loadOrGenerate('signatures.json', () => {
    return Array.from({ length: count }, (_, i) => {
      // Generate role and name yang sesuai dengan schema length constraint (max 50 chars)
      const roles = [
        'Manager', 'Supervisor', 'Director', 'Coordinator',
        'Head of Department', 'Senior Manager', 'Assistant Manager',
        'Team Leader', 'Administrator', 'Executive'
      ];
      
      const generateName = () => {
        const name = faker.person.fullName();
        return name.length > 45 ? name.substring(0, 45) + '...' : name;
      };
      
      const generateRole = () => {
        const role = faker.helpers.arrayElement(roles);
        return role.length > 45 ? role.substring(0, 45) + '...' : role;
      };
      
      return {
        id: randomUUID(),
        idNumber: `SIGNER${(i + 1).toString().padStart(3, '0')}`,
        role: generateRole(),
        name: generateName(),
        eSignFileName: `e-sign${i + 1}.png`,
        eSignPath: `/esign/${faker.string.uuid()}.png`,
        signatureType: i % 2 === 0 ? SignatureType.SIGNATURE1 : SignatureType.SIGNATURE2,
        status: true,
      };
    });
  }, 'DUMMY_SIGNATURE_COUNT', count);

  // --- PATCH: filter hanya field valid ---
  const validFields = [
    'id', 'idNumber', 'role', 'name', 'eSignFileName', 'eSignPath', 'signatureType', 'status'
  ];
  const filteredData = data.map((item) => {
    const filtered: any = {};
    for (const key of validFields) {
      if (item[key] !== undefined) filtered[key] = item[key];
    }
    // --- PATCH: pastikan status boolean ---
    if ('status' in filtered) {
      const v = filtered.status;
      if (typeof v !== 'boolean') {
        filtered.status = ['t', 'true', '1', 1, 'yes', 'y'].includes(String(v).toLowerCase());
      }
    }
    // --- END PATCH ---
    return filtered;
  });
  // --- END PATCH ---

  // Upload e-signature dummy ke storage
  for (let i = 0; i < filteredData.length; i++) {
    let eSignDest = filteredData[i].eSignPath;
    if (!eSignDest) {
      // Jika eSignPath kosong/null, generate path baru
      eSignDest = `/esign/${randomUUID()}.png`;
      filteredData[i].eSignPath = eSignDest;
      Logger.warn(`Signature ke-${i} tidak punya eSignPath, auto-generate: ${eSignDest}`);
    }
    const eSignSrc = path.join(sampleDir, `e-sign${(i % 2) + 1}.png`); // bergantian antara e-sign1.png dan e-sign2.png
    Logger.info(`Upload e-signature dummy: ${eSignSrc} -> ${eSignDest}`);
    await uploadToStorage(eSignSrc, eSignDest);
  }

  if (filteredData.length > 0) {
    await processBatch(filteredData, async (signature) => {
      await prisma.signature.create({ data: signature });
    }, BATCH_SIZE, 'seed-signatures');
    Logger.info(`Seeded ${filteredData.length} signatures`);
  } else {
    Logger.info('No signatures to seed');
  }
}

// Refactor seedCertificates
// async function seedCertificates() {
//   Logger.info('Starting certificates seeding');
//   await backupTableIfRequested('certificates');
//   const count = parseInt(process.env.DUMMY_CERTIFICATE_COUNT || '5', 10);
//   const numFields = ['theoryScore', 'practiceScore'];
//   const raw = await loadJson<any>('certificates.json');
//   const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//   let data = raw.filter(c => {
//       const sig = c.signatureId ?? c[6];
//       const cot = c.cotId ?? c[5];
//       return uuid.test(sig) && uuid.test(cot);
//   }).map(c => {
//     const item: any = { ...c };
//     numFields.forEach(f => {
//       item[f] = item[f] !== undefined && item[f] !== null ? Number(item[f]) : null;
//     });
//     return item;
//   });
//   if (data.length === 0) {
//     Logger.warn('No valid certificate entries found, generating dummy data');
//     const [cots, signatures] = await Promise.all([
//       prisma.cOT.findMany(),
//       prisma.signature.findMany(),
//     ]);
//     data = Array.from({ length: count }, () => {
//       const cot = faker.helpers.arrayElement(cots);
//       const sig = faker.helpers.arrayElement(signatures);
//       return {
//       id: randomUUID(),
//         cotId: cot.id,
//         signatureId: sig.id,
//         certificateNumber: `CERT-${cot.id.substring(0, 6).toUpperCase()}`,
//       attendance: true,
//         theoryScore: faker.number.int({ min: 60, max: 100 }),
//         practiceScore: faker.number.int({ min: 60, max: 100 }),
//       };
//     });
//   }
//   if (data.length > 0) {
//     await processBatch(data, async (certificate) => {
//       await prisma.certificate.create({ data: certificate });
//     }, BATCH_SIZE, 'seed-certificates');
//     Logger.info(`Seeded ${data.length} certificates`);
//   } else {
//     Logger.info('No certificates to seed');
//   }
// }

// Refactor seedParticipantsCot
async function seedParticipantsCot() {
  Logger.info('Starting participantsCot seeding');
  await backupTableIfRequested('participantsCot');
  const count = parseInt(process.env.DUMMY_PARTICIPANTSCOT_COUNT || '5', 10);
  const raw = await loadJson<any>('participantscot.json');
  let data = raw.map(r => ({
    id: r.id ?? faker.string.uuid(),
    participantId: r.participantId ?? r[0],
    cotId: r.cotId ?? r[1]
  }));
  if (data.length === 0) {
    Logger.warn('No participantsCot data found, generating dummy links');
    const [participants, cots] = await Promise.all([
      prisma.participant.findMany(),
      prisma.cOT.findMany(),
    ]);
    data = Array.from({ length: count }, () => {
      const p = faker.helpers.arrayElement(participants);
      const cot = faker.helpers.arrayElement(cots);
      return {
      id: randomUUID(),
      participantId: p.id,
        cotId: cot.id,
      };
    });
  }
  if (data.length > 0) {
    await processBatch(data, async (participantCot) => {
      await prisma.participantsCOT.create({ data: participantCot });
    }, BATCH_SIZE, 'seed-participants-cot');
    Logger.info(`Seeded ${data.length} participantsCot`);
  } else {
    Logger.info('No participantsCot to seed');
  }
}

// Refactor seedCurriculumSyllabus
async function seedCurriculumSyllabus() {
  Logger.info('Starting curriculumSyllabus seeding');
  await backupTableIfRequested('curriculumSyllabus');
  const count = parseInt(process.env.DUMMY_CURRICULUMSYLLABUS_COUNT || '3', 10);
  const numFields = ['theoryDuration', 'practiceDuration'];
  // --- PATCH: ambil capability ---
  const capabilities = await prisma.capability.findMany();
  if (capabilities.length === 0) throw new Error('No capabilities found, cannot seed curriculumSyllabus');
  // --- END PATCH ---
  const raw = await loadJson<any>('curriculumsyllabus.json');
  let data: any[] = [];
  if (raw.length > 0) {
    data = raw.map(r => {
      const item: any = { ...r };
      numFields.forEach(f => {
        item[f] = item[f] !== undefined && item[f] !== null ? Number(item[f]) : null;
      });
      // --- PATCH: pastikan ada capabilityId ---
      if (!item.capabilityId) {
        item.capabilityId = faker.helpers.arrayElement(capabilities).id;
      }
      // --- END PATCH ---
      return item;
    });
    Logger.info(`Menggunakan data dari curriculumsyllabus.json (${data.length} item)`);
  } else {
    data = Array.from({ length: count }, () => {
      // Generate curriculum name yang sesuai dengan schema length constraint (max 50 chars)
      const curriculumOptions = [
        'Basic Theory',
        'Advanced Practice', 
        'Safety Protocol',
        'Equipment Operation',
        'Maintenance Procedure',
        'Emergency Response',
        'Quality Control',
        'Technical Skills',
        'Ground Operations',
        'Aircraft Handling'
      ];
      
      const selectedName = faker.helpers.arrayElement(curriculumOptions);
      const name = selectedName.length > 45 
        ? selectedName.substring(0, 45) + '...' 
        : selectedName;
      
      return {
        id: faker.string.uuid(),
        capabilityId: faker.helpers.arrayElement(capabilities).id,
        theoryDuration: faker.number.int({ min: 10, max: 100 }),
        practiceDuration: faker.number.int({ min: 10, max: 100 }),
        name: name,
        type: faker.helpers.arrayElement(['Kompetensi', 'Reguler', 'Lainnya']),
      };
    });
    Logger.info(`File curriculumsyllabus.json kosong, generate data dummy (${count} item)`);
  }
  if (data.length > 0) {
    await processBatch(data, async (curriculumSyllabus) => {
      await prisma.curriculumSyllabus.create({ data: curriculumSyllabus });
    }, BATCH_SIZE, 'seed-curriculum-syllabus');
    Logger.info(`Seeded ${data.length} curriculumSyllabus`);
  } else {
    Logger.info('No curriculumSyllabus to seed');
  }
}

console.log('=== SEBELUM PANGGIL MAIN ===');
main();
console.log('=== SETELAH PANGGIL MAIN ===');

// Tambahkan log di awal fungsi main
async function main() {
  console.log('=== MASUK FUNGSI MAIN ===');
  const startTime = Date.now();
  
  try {
    Logger.info('Starting database seeding');
    
    validateConfiguration();
    
    Logger.info('Cleaning database');
    const cleanupTables = [
      'certificates', 'participantsCot', 'capabilityCots', 'users', 
      'signatures', 'participants', 'cots', 'curriculumSyllabus', 
      'capabilities', 'roles'
    ];
    
    for (const table of cleanupTables) {
      await backupTableIfRequested(table);
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      Logger.info(`Cleaned table ${table}`);
    }

    await seedRoles();
    await seedCapabilities();
    await seedCots();
    await seedCapabilityCots();
    await seedSignatures();
    // await seedCertificates();
    await seedParticipantsAndUsers();
    await seedParticipantsCot();
    await seedCurriculumSyllabus();

    await prisma.$executeRawUnsafe(
      'UPDATE "users" u SET "dinas" = p."dinas" FROM "participants" p WHERE p."id" = u."participantId" AND u."dinas" IS NULL;'
    );
    Logger.info('Updated user dinas from participants');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    Logger.info(`Seed completed successfully in ${duration}s`);
    
    const tablesToCheck = [
      'roles', 'capabilities', 'cots', 'capabilityCots', 'signatures',
      'certificates', 'participants', 'participantsCot', 'users', 'curriculumSyllabus'
    ];
    for (const t of tablesToCheck) {
      const [{ count }] = await prisma.$queryRawUnsafe<{ count: string }[]>(`SELECT count(*) FROM "${t}"`);
      Logger.info(`${t}: ${count} rows`);
    }
    
    if (process.env.EXPORT_LOGS === 'true') {
      const logFilePath = path.join(__dirname, `seed_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await Logger.exportLogs(logFilePath);
      Logger.info(`Logs exported to ${logFilePath}`);
    }
    
  } catch (error) {
    Logger.error('Seed failed', {
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n')
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    Logger.info('Prisma client disconnected');
  }
}

process.on('SIGINT', async () => {
  Logger.info('Received SIGINT, cleaning up...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.info('Received SIGTERM, cleaning up...');
  await prisma.$disconnect();
  process.exit(0);
});