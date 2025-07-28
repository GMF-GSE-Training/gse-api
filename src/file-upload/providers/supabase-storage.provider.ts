import { StorageClient } from '@supabase/storage-js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from '../storage-provider.interface';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private client: StorageClient;
  private bucket: string;
  private logger = new Logger(SupabaseStorageProvider.name);

  constructor(private config: ConfigService) {
    const url = `${this.config.get('SUPABASE_URL')}/storage/v1`;
    const key = this.config.get('SUPABASE_SERVICE_KEY');
    this.bucket = this.config.get('SUPABASE_BUCKET');
    this.client = new StorageClient(url, { apikey: key, Authorization: `Bearer ${key}` });
  }

  async upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string> {
    this.logger.log(`Uploading file to Supabase: ${fileName}`, requestId);
    
    try {
      // Validate input parameters
      if (!file || !file.buffer) {
        throw new Error('Invalid file object: missing buffer');
      }
      
      if (!Buffer.isBuffer(file.buffer)) {
        throw new Error('Invalid file buffer: not a Buffer instance');
      }
      
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid fileName: must be a non-empty string');
      }
      
      // Normalize file path for cross-platform compatibility
      const normalizedFileName = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
      
      // Prepare upload options compatible with @supabase/storage-js v2.7.3
      const uploadOptions = {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
        cacheControl: '3600',
        // Remove duplex as it's not supported in this version
        metadata: {
          originalName: file.originalname || 'unknown',
          uploadedAt: new Date().toISOString(),
          platform: process.platform,
          requestId: requestId || 'unknown'
        }
      };
      
      this.logger.debug(`Upload attempt:`, {
        fileName: normalizedFileName,
        bufferSize: file.buffer.length,
        contentType: uploadOptions.contentType,
        platform: process.platform,
        requestId
      });
      
      // Perform upload with proper error handling
      const { data, error } = await this.client
        .from(this.bucket)
        .upload(normalizedFileName, file.buffer, uploadOptions);
      
      if (error) {
        this.logger.error(`Supabase upload error:`, {
          error: error.message,
          fileName: normalizedFileName,
          requestId
        });
        throw new Error(`Supabase upload failed: ${error.message}`);
      }
      
      if (!data || !data.path) {
        throw new Error('Upload succeeded but no path returned');
      }
      
      this.logger.log(`File uploaded successfully to: ${data.path}`, requestId);
      return data.path;
      
    } catch (error: any) {
      this.logger.error(`Upload failed:`, {
        error: error.message,
        stack: error.stack,
        fileName,
        fileSize: file?.buffer?.length,
        platform: process.platform,
        requestId
      });
      
      // Re-throw with enhanced error message
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
  }

  async download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }> {
    this.logger.log(`Downloading file from Supabase: ${filePath}`, requestId);
    const { data, error } = await this.client.from(this.bucket).download(filePath);
    if (error || !data) throw new Error(`Supabase download failed: ${error?.message || 'No data'}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    return { buffer, mimeType: 'application/octet-stream' };
  }

  async delete(filePath: string, requestId?: string): Promise<void> {
    this.logger.log(`Deleting file from Supabase: ${filePath}`, requestId);
    const { error } = await this.client.from(this.bucket).remove([filePath]);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  async exists(filePath: string, requestId?: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from(this.bucket)
        .list(filePath.split('/').slice(0, -1).join('/'), { search: filePath.split('/').pop() });
      return !error && data.length > 0;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number, requestId?: string): Promise<string> {
    this.logger.log(`Generating signed URL for Supabase: ${filePath}`, requestId);
    const { data, error } = await this.client
      .from(this.bucket)
      .createSignedUrl(filePath, expiresIn);
    if (error) throw new Error(`Supabase signed URL failed: ${error.message}`);
    return data.signedUrl;
  }

  getPublicUrl(filePath: string, bucketOverride?: string): string {
    const bucket = bucketOverride || this.bucket;
    return `${this.config.get('SUPABASE_URL')}/storage/v1/object/public/${bucket}/${filePath}`;
  }
} 