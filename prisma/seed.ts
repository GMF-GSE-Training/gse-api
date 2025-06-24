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
import { ConfigService } from '@nestjs/config';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Constants
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const EXPONENTIAL_BACKOFF_BASE = 2;

// Initialize clients
const prisma = new PrismaClient();
const configService = new ConfigService();
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

  const storageType = configService.get('STORAGE_TYPE', 'minio') as 'minio' | 'supabase';
  
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
  const storageType = configService.get('STORAGE_TYPE', 'minio') as 'minio' | 'supabase';
  
  if (storageType === 'supabase') {
    const supabaseUrl = configService.get('SUPABASE_URL');
    const supabaseServiceKey = configService.get('SUPABASE_SERVICE_KEY');
    const supabaseBucket = configService.get('SUPABASE_BUCKET');
    
    return {
      client: new StorageClient(`${supabaseUrl}/storage/v1`, {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      }),
      bucket: supabaseBucket,
      type: 'supabase',
    };
  } else {
    const endpoint = configService.get('MINIO_ENDPOINT');
    const port = configService.get('MINIO_PORT');
    const accessKey = configService.get('MINIO_ACCESS_KEY');
    const secretKey = configService.get('MINIO_SECRET_KEY');
    const bucket = configService.get('MINIO_BUCKET');
    
    return {
      client: new MinioClient({
        endPoint: endpoint,
        port: Number(port),
        useSSL: configService.get('MINIO_USE_SSL') === 'true',
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

// Enhanced seeding functions with consistent batch processing
async function seedRoles() {
  Logger.info('Starting roles seeding');
  await backupTableIfRequested('roles');

  const raw = await loadJson<any>('roles.json');
  
  const data = raw.map((r) => {
    if (typeof r === 'string') return { name: r };
    if (Array.isArray(r) && r.length >= 2) return { id: r[0], name: r[1] };
    return { id: r.id ?? undefined, name: r.name ?? r };
  });
  
  if (data.length > 0) {
    await processBatch(data, async (role) => {
      await prisma.role.create({ data: role });
    }, BATCH_SIZE, 'seed-roles');
    
    Logger.info(`Seeded ${data.length} roles`);
  } else {
    Logger.info('No roles to seed');
  }
}

async function seedCapabilities() {
  Logger.info('Starting capabilities seeding');
  await backupTableIfRequested('capabilities');
  
  const raw = await loadJson<any>('capabilities.json');
  
  let data: any[] = [];
  if (raw.length === 0) {
    Logger.warn('No capabilities data found, generating dummy data');
    data = Array.from({ length: 10 }, (_, i) => ({
      id: faker.string.uuid(),
      ratingCode: `RC${(i + 1).toString().padStart(2, '0')}`,
      trainingCode: `TC${(i + 1).toString().padStart(3, '0')}`,
      trainingName: faker.lorem.words({ min: 2, max: 5 }),
      totalTheoryDurationRegGse: faker.number.int({ min: 10, max: 100 }),
      totalPracticeDurationRegGse: faker.number.int({ min: 10, max: 100 }),
      totalTheoryDurationCompetency: faker.number.int({ min: 10, max: 100 }),
      totalPracticeDurationCompetency: faker.number.int({ min: 10, max: 100 }),
      totalDuration: faker.number.int({ min: 50, max: 500 }),
    }));
  } else {
    const numFields = [
      'totalDuration',
      'totalPracticeDurationCompetency',
      'totalPracticeDurationRegGse',
      'totalTheoryDurationCompetency',
      'totalTheoryDurationRegGse',
    ];
    
    data = raw.map(c => {
      const item: any = { ...c };
      numFields.forEach(f => {
        item[f] = sanitizers.toInt(item[f]);
      });
      return item;
    });
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

// Enhanced participant seeding with improved error handling
async function seedParticipants() {
  Logger.info('Starting participants seeding');
  await backupTableIfRequested('participants');
  
  const participantsPath = path.join(dummyDir, 'participants.json');
  let rawParticipants: any[] = [];

  // Stream processing for large files
  if (fsSync.existsSync(participantsPath)) {
    try {
    const pipeline = chain([
        fsSync.createReadStream(participantsPath),
      parser(),
      streamArray(),
    ]);
      
    for await (const data of pipeline) {
      rawParticipants.push(data.value);
      }
      Logger.info(`Loaded ${rawParticipants.length} participants from file`);
    } catch (error) {
      Logger.error('Failed to load participants from file', { error: (error as Error).message });
    }
  }

  // Generate dummy data if no file exists
  if (rawParticipants.length === 0) {
    Logger.warn('Generating dummy participants...');
    rawParticipants = Array.from({ length: 50 }, (_, i) => {
      const gender = faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female';
      return {
        id: faker.string.uuid(),
        idNumber: `P${(i + 1).toString().padStart(3, '0')}`,
        name: faker.person.fullName({ sex: gender }),
        nik: faker.string.numeric(16),
        dinas: faker.helpers.arrayElement(['TA', 'TB', 'TC', 'TF', 'TJ', 'TL', 'TM', 'TR', 'TU', 'TV', 'TZ']),
        bidang: faker.commerce.department(),
        company: faker.company.name(),
        email: faker.internet.email().toLowerCase(),
        phoneNumber: faker.phone.number('08##########'),
        nationality: 'Indonesia',
        placeOfBirth: faker.location.city(),
        dateOfBirth: faker.date.past({ years: 30, refDate: '2000-01-01' }).toISOString().split('T')[0],
        gmfNonGmf: faker.helpers.arrayElement(['GMF', 'Non-GMF']),
      };
      });
  }

  if (rawParticipants.length === 0) {
    Logger.info('No participants to seed');
    return;
  }

  const localIp = Object.values(os.networkInterfaces())
    .flat()
    .find((x) => x?.family === 'IPv4' && !x.internal)?.address ?? 'localhost';
  
  const frontendUrl = process.env.FRONTEND_URL || `http://${localIp}:4200`;
  
  const failedParticipants: any[] = [];
  
  // Process participants in batches with enhanced error handling
  const processParticipant = async (p: any, index: number) => {
    try {
      // Clean null values
      Object.keys(p).forEach(key => {
      if (p[key] === '' || p[key] === undefined) p[key] = null;
      });

      // Convert dates
    const toDate = (d: string | null): Date | null => {
      if (!d || d.trim() === '') return null;
      const date = new Date(`${d}T00:00:00Z`);
      return isNaN(date.getTime()) ? null : date;
    };
      
      ['tglKeluarSuratBebasNarkoba', 'tglKeluarSuratSehatButaWarna', 'dateOfBirth']
        .forEach(field => p[field] = toDate(p[field]));
      
      // Upload files concurrently with individual error handling
      const uploadPromises = [
        uploadToStorage(path.join(sampleDir, predefinedFiles.foto), `foto/${p.id}.jpg`).catch(e => {
          Logger.warn(`Failed to upload foto for participant ${p.id}`, { error: e.message });
          return '';
        }),
        uploadToStorage(path.join(sampleDir, predefinedFiles.ktp), `ktp/${p.id}.jpg`).catch(e => {
          Logger.warn(`Failed to upload ktp for participant ${p.id}`, { error: e.message });
          return '';
        }),
        uploadToStorage(path.join(sampleDir, predefinedFiles.simA), `simA/${p.id}.jpg`).catch(e => {
          Logger.warn(`Failed to upload simA for participant ${p.id}`, { error: e.message });
          return '';
        }),
        uploadToStorage(path.join(sampleDir, predefinedFiles.simB), `simB/${p.id}.jpg`).catch(e => {
          Logger.warn(`Failed to upload simB for participant ${p.id}`, { error: e.message });
          return '';
        }),
        uploadToStorage(path.join(sampleDir, predefinedFiles.suratSehatButaWarna), `suratSehat/${p.id}.jpg`).catch(e => {
          Logger.warn(`Failed to upload suratSehat for participant ${p.id}`, { error: e.message });
          return '';
        }),
        uploadToStorage(path.join(sampleDir, predefinedFiles.suratBebasNarkoba), `suratNarkoba/${p.id}.jpg`).catch(e => {
          Logger.warn(`Failed to upload suratNarkoba for participant ${p.id}`, { error: e.message });
          return '';
        }),
      ];
      
      const [fotoPath, ktpPath, simAPath, simBPath, suratSehatPath, suratNarkobaPath] = 
        await Promise.all(uploadPromises);
      
      // Generate and upload QR code using buffer (no temp file)
    const url = `${frontendUrl}/participant/detail/${p.id}`;
    const qrDataUrl = await QRCode.toDataURL(url);
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      
      let qrCodePath = '';
      try {
        qrCodePath = await uploadQRCodeBuffer(qrBuffer, `qrcode/${p.id}.png`);
      } catch (error) {
        Logger.warn(`Failed to upload QR code for participant ${p.id}`, { error: (error as Error).message });
      }
      
      return {
        ...p,
        fotoPath,
        ktpPath,
        simAPath,
        simBPath,
        suratSehatButaWarnaPath: suratSehatPath,
        suratBebasNarkobaPath: suratNarkobaPath,
        qrCodePath,
        // Remove unused fields
        foto: undefined,
        ktp: undefined,
        simA: undefined,
        simB: undefined,
        suratSehatButaWarna: undefined,
        suratBebasNarkoba: undefined,
        qrCode: undefined,
      };
    } catch (error) {
      Logger.error(`Failed to process participant ${p.id || index}`, { 
        error: (error as Error).message,
        participantData: { id: p.id, name: p.name, email: p.email }
      });
      failedParticipants.push({ ...p, processingError: (error as Error).message });
      throw error;
    }
  };
  
  try {
    const processedParticipants = await processBatch(
      rawParticipants, 
      processParticipant, 
      10, // Smaller batch size for file uploads
      'process-participants'
    );
    
    // Insert in batches
    await processBatch(processedParticipants, async (participant) => {
      await prisma.participant.create({ data: participant });
    }, BATCH_SIZE, 'insert-participants');
    
    Logger.info(`Seeded ${processedParticipants.length} participants`);
    
    if (failedParticipants.length > 0) {
      const failedFilePath = path.join(__dirname, 'failed_participants.json');
      await fs.writeFile(failedFilePath, JSON.stringify(failedParticipants, null, 2));
      Logger.warn(`${failedParticipants.length} participants failed processing. Details saved to ${failedFilePath}`);
    }
    
  } catch (error) {
    Logger.error('Critical failure in participant seeding', { error: (error as Error).message });
    
    // Save failed data for debugging
    const failedFilePath = path.join(__dirname, 'failed_participants_debug.json');
    await fs.writeFile(failedFilePath, JSON.stringify({
      rawParticipants,
      failedParticipants,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    throw error;
  }
}

// Enhanced user seeding with better password management
async function seedUsers() {
  Logger.info('Starting users seeding');
  await backupTableIfRequested('users');
  
  const coreRoles = ['super admin', 'supervisor', 'lcu', 'user'];
  
  await processBatch(coreRoles, async (roleName) => {
    await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName },
      update: {}
    });
  }, BATCH_SIZE, 'seed-core-roles');

  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map(r => [r.name.toLowerCase(), r.id]));
  const dinasList = ['TA', 'TB', 'TC', 'TF', 'TJ', 'TL', 'TM', 'TR', 'TU', 'TV', 'TZ'];
  
  Logger.info('Pre-hashing common passwords...');
  const commonPasswords = {
    'Admin12345': await bcrypt.hash('Admin12345', 10),
    'Supervisor12345': await bcrypt.hash('Supervisor12345', 10),
    'Lcu12345': await bcrypt.hash('Lcu12345', 10),
    'User12345': await bcrypt.hash('User12345', 10),
  };
  
  const upsertUser = async (userData: any, index: number) => {
    try {
      const passwordHash = commonPasswords[userData.passwordPlain as keyof typeof commonPasswords] ||
        await bcrypt.hash(userData.passwordPlain, 10);
      
    await prisma.user.upsert({
        where: { email: userData.email },
      create: {
          email: userData.email,
          idNumber: userData.idNumber ?? null,
          name: userData.name ?? userData.email,
          password: passwordHash,
          roleId: roleMap[userData.role.toLowerCase()],
          participantId: userData.participantId ?? null,
          dinas: userData.dinas ?? null,
        verifiedAccount: true,
      },
      update: {
          password: passwordHash,
          roleId: roleMap[userData.role.toLowerCase()],
          dinas: userData.dinas ?? undefined,
      },
    });
    } catch (error) {
      Logger.error(`Failed to upsert user ${userData.email || index}`, {
        error: (error as Error).message,
        userData: { email: userData.email, idNumber: userData.idNumber }
      });
      throw error;
    }
  };
  
  const adminUsers = [
    ...Array.from({ length: 5 }, (_, i) => ({
      email: `superadmin${i + 1}@example.com`,
      idNumber: `SA${(i + 1).toString().padStart(3, '0')}`,
      name: `Super Admin ${i + 1}`,
      passwordPlain: 'Admin12345',
      role: 'super admin',
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      email: `supervisor${i + 1}@example.com`,
      idNumber: `SP${(i + 1).toString().padStart(3, '0')}`,
      name: `Supervisor ${i + 1}`,
      dinas: dinasList[i],
      passwordPlain: 'Supervisor12345',
      role: 'supervisor',
    })),
    ...Array.from({ length: 11 }, (_, i) => ({
      email: `lcu${i + 1}@example.com`,
      idNumber: `LCU${(i + 1).toString().padStart(3, '0')}`,
      name: `LCU ${i + 1}`,
      dinas: dinasList[i % dinasList.length],
      passwordPlain: 'Lcu12345',
      role: 'lcu',
    })),
  ];
  
  await processBatch(adminUsers, upsertUser, 20, 'seed-admin-users');
  
  const participants = await prisma.participant.findMany({ take: 30 });
  const participantUsers = participants.map((p, idx) => ({
    email: p.email ?? `participant${idx + 1}@example.com`,
    idNumber: p.idNumber,
      name: p.name,
      participantId: p.id,
    dinas: p.dinas,
      passwordPlain: 'User12345',
      role: 'user',
  }));
  
  await processBatch(participantUsers, upsertUser, 20, 'seed-participant-users');
  
  const usersFromJson = await loadJson<any>('users.json');
  if (usersFromJson.length > 0) {
  const existingIds = await prisma.user.findMany({ select: { idNumber: true } });
    const usedIdNumbers = new Set(existingIds.map(r => r.idNumber).filter(Boolean) as string[]);

    const jsonUserProcessor = async (u: any, index: number) => {
      try {
  const bcryptRegex = /^\$2[aby]\$/;
    const passwordToStore = bcryptRegex.test(u.password)
          ? u.password
      : await bcrypt.hash(u.password, 10);

        let idNumberToUse = u.idNumber ?? null;
    if (idNumberToUse && usedIdNumbers.has(idNumberToUse)) {
          idNumberToUse = null;
    }
    if (idNumberToUse) usedIdNumbers.add(idNumberToUse);

    await prisma.user.upsert({
      where: { email: u.email },
          update: {},
      create: {
        email: u.email,
        idNumber: idNumberToUse,
        name: u.name,
        password: passwordToStore,
        roleId: roleMap[(u.role || 'user').toLowerCase()],
        participantId: u.participantId ?? null,
        verifiedAccount: true,
      },
    });
      } catch (error) {
        Logger.error(`Failed to process JSON user ${u.email || index}`, {
          error: (error as Error).message,
          userData: { email: u.email, idNumber: u.idNumber }
        });
        throw error;
      }
    };
    
    await processBatch(usersFromJson, jsonUserProcessor, 20, 'seed-json-users');
  }
  
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: string }[]>(`SELECT count(*) FROM "users"`);
  Logger.info(`Users table now has ${count} rows`);
}

async function seedCots() {
  Logger.info('Starting COTs seeding');
  await backupTableIfRequested('cots');

  const raw = await loadJson<any>('cots.json');
  
  let data: any[] = [];
  if (raw.length === 0) {
    Logger.warn('No COTs data found, generating dummy data');
    data = Array.from({ length: 5 }, () => ({
        id: faker.string.uuid(),
        startDate: faker.date.recent({ days: 30 }),
      endDate: faker.date.future({ years: 1 }),
        trainingLocation: faker.location.city(),
        theoryInstructorRegGse: faker.person.fullName(),
        theoryInstructorCompetency: faker.person.fullName(),
        practicalInstructor1: faker.person.fullName(),
        practicalInstructor2: faker.person.fullName(),
        status: faker.helpers.arrayElement(['Menunggu', 'Berlangsung', 'Selesai']),
    }));
  } else {
    data = raw.map(c => ({
      id: c.id ?? faker.string.uuid(),
      startDate: sanitizers.toDateObj(c.startDate) ?? new Date(),
      endDate: sanitizers.toDateObj(c.endDate) ?? new Date(),
    trainingLocation: c.trainingLocation ?? 'N/A',
    theoryInstructorRegGse: c.theoryInstructorRegGse ?? 'N/A',
    theoryInstructorCompetency: c.theoryInstructorCompetency ?? 'N/A',
    practicalInstructor1: c.practicalInstructor1 ?? 'N/A',
    practicalInstructor2: c.practicalInstructor2 ?? 'N/A',
    status: c.status ?? 'Menunggu',
  }));
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

async function seedCapabilityCots() {
  Logger.info('Starting capabilityCots seeding');
  await backupTableIfRequested('capabilityCots');
  
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
    data = caps.flatMap(cap => 
      cots.map(cot => ({
        capabilityId: cap.id,
        cotId: cot.id
      }))
    );
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

async function seedSignatures() {
  Logger.info('Starting signatures seeding');
  await backupTableIfRequested('signatures');
  
  const signaturesToCreate = [
    {
      id: randomUUID(),
      idNumber: 'SIGNER001',
      role: 'Manager',
      name: 'Manager Signatory',
      eSignFileName: 'e-sign1.png',
      signatureType: SignatureType.SIGNATURE1,
      status: true,
    },
    {
      id: randomUUID(),
      idNumber: 'SIGNER002',
      role: 'Supervisor',
      name: 'Supervisor Signatory',
      eSignFileName: 'e-sign2.png',
      signatureType: SignatureType.SIGNATURE2,
      status: true,
    },
  ];
  
  const data = await Promise.all(signaturesToCreate.map(async (s, index) => {
    try {
    const localPath = path.join(sampleDir, s.eSignFileName);
      let eSignPath = '';
      try {
        eSignPath = await uploadToStorage(localPath, `esign/${s.id}.png`);
      } catch (error) {
        Logger.warn(`Failed to upload eSign for signature ${s.idNumber}`, { error: (error as Error).message });
      }
      
    return {
        ...s,
      eSignPath,
      };
    } catch (error) {
      Logger.error(`Failed to process signature ${s.idNumber || index}`, {
        error: (error as Error).message,
        signatureData: { idNumber: s.idNumber, name: s.name }
      });
      throw error;
    }
  }));
  
  if (data.length > 0) {
    await processBatch(data, async (signature) => {
      await prisma.signature.create({ data: signature });
    }, BATCH_SIZE, 'seed-signatures');
    
    Logger.info(`Seeded ${data.length} signatures`);
  } else {
    Logger.info('No signatures to seed');
  }
}

async function seedCertificates() {
  Logger.info('Starting certificates seeding');
  await backupTableIfRequested('certificates');
  
  const raw = await loadJson<any>('certificates.json');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  let data = raw
    .filter(c => {
      const sig = c.signatureId ?? c[6];
      const cot = c.cotId ?? c[5];
      return uuid.test(sig) && uuid.test(cot);
    })
    .map(c => ({
      id: c.id ?? faker.string.uuid(),
      cotId: c.cotId ?? c[5],
      signatureId: c.signatureId ?? c[6],
      certificateNumber: c.certificateNumber ?? 'N/A',
      attendance: sanitizers.toBool(c.attendance),
      theoryScore: sanitizers.toFloat(c.theoryScore) ?? 0,
      practiceScore: sanitizers.toFloat(c.practiceScore) ?? 0,
    }));
  
  if (data.length === 0) {
    Logger.warn('No valid certificate entries found, generating dummy data');
    const [cots, signatures] = await Promise.all([
      prisma.cOT.findMany(),
      prisma.signature.findMany({ take: 1 }),
    ]);
    const sigId = signatures[0]?.id ?? randomUUID();
    data = cots.map(c => ({
      id: randomUUID(),
      cotId: c.id,
      signatureId: sigId,
      certificateNumber: `CERT-${c.id.substring(0, 6).toUpperCase()}`,
      attendance: true,
      theoryScore: 80,
      practiceScore: 85,
    }));
  }

  if (data.length > 0) {
    await processBatch(data, async (certificate) => {
      await prisma.certificate.create({ data: certificate });
    }, BATCH_SIZE, 'seed-certificates');
    
    Logger.info(`Seeded ${data.length} certificates`);
  } else {
    Logger.info('No certificates to seed');
  }
}

async function seedParticipantsCot() {
  Logger.info('Starting participantsCot seeding');
  await backupTableIfRequested('participantsCot');
  
  const raw = await loadJson<any>('participantscot.json');
  let data = raw.map(r => ({
    id: r.id ?? faker.string.uuid(),
    participantId: r.participantId ?? r[0],
    cotId: r.cotId ?? r[1]
  }));

  if (data.length === 0) {
    Logger.warn('No participantsCot data found, generating dummy links');
    const [participants, cots] = await Promise.all([
      prisma.participant.findMany({ take: 20 }),
      prisma.cOT.findMany(),
    ]);
    data = participants.map((p, idx) => ({
      id: randomUUID(),
      participantId: p.id,
      cotId: cots[idx % cots.length].id,
    }));
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

async function seedCurriculumSyllabus() {
  Logger.info('Starting curriculumSyllabus seeding');
  await backupTableIfRequested('curriculumSyllabus');
  
  const raw = await loadJson<any>('curriculumsyllabus.json');
  let data = raw.map(r => ({
    id: r.id ?? faker.string.uuid(),
    capabilityId: r.capabilityId ?? r[0],
    name: r.name ?? 'N/A',
    theoryDuration: sanitizers.toInt(r.theoryDuration) ?? 0,
    practiceDuration: sanitizers.toInt(r.practiceDuration) ?? 0,
    type: r.type ?? 'REGULAR',
  }));

  if (data.length === 0) {
    Logger.warn('No curriculumSyllabus data found, generating dummy syllabus');
    const caps = await prisma.capability.findMany();
    data = caps.map(c => ({
      id: randomUUID(),
      capabilityId: c.id,
      name: `${c.trainingName} - Intro`,
      theoryDuration: 2,
      practiceDuration: 3,
      type: 'REGULAR',
    }));
  }

  if (data.length > 0) {
    await processBatch(data, async (syllabus) => {
      await prisma.curriculumSyllabus.create({ data: syllabus });
    }, BATCH_SIZE, 'seed-curriculum-syllabus');
    
    Logger.info(`Seeded ${data.length} curriculumSyllabus`);
  } else {
    Logger.info('No curriculumSyllabus to seed');
  }
}

async function main() {
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
    await seedCertificates();
    await seedParticipants();
    await seedParticipantsCot();
    await seedUsers();
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

main();