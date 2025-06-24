export interface StorageProvider {
  upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string>;
  download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }>;
  delete(filePath: string, requestId?: string): Promise<void>;
  exists(filePath: string, requestId?: string): Promise<boolean>;
  getSignedUrl(filePath: string, expiresIn: number, requestId?: string): Promise<string>;
} 