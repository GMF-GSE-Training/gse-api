import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

const minio = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: Number(process.env.MINIO_PORT!),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});
const minioBucket = process.env.MINIO_BUCKET!;

const storageType = process.env.STORAGE_TYPE || 'minio';

if (storageType === 'supabase') {
  // Helper Minio tidak boleh dipakai di mode supabase
  console.warn('[minio.helper] Dipanggil saat STORAGE_TYPE=supabase. Semua fungsi akan throw error.');
}

// Helper untuk mengubah stream ke Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Helper untuk ambil file dari Minio sebagai Buffer
export async function getFileBufferFromMinio(path: string): Promise<Buffer> {
  if (storageType === 'supabase') {
    throw new Error('getFileBufferFromMinio tidak boleh dipakai saat STORAGE_TYPE=supabase');
  }
  const stream = await minio.getObject(minioBucket, path);
  if (!stream) throw new Error('File not found in Minio: ' + path);
  return streamToBuffer(stream as Readable);
} 