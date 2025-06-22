export interface StorageProvider {
  upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string>;
  download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }>;
  delete(filePath: string, requestId?: string): Promise<void>;
} 